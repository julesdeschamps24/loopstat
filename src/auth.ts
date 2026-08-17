import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { validateCredentials } from "@/lib/auth/validate";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";

// Brute-force guard : 10 tentatives de login / 30 s par IP, et 5 / 30 s par
// couple IP+email. Fenêtre courte = déblocage rapide pour un humain qui se
// trompe ; ça throttle quand même un script à ~10 essais/30 s (le coût
// bcrypt côté serveur ralentit le reste). In-memory : suffisant, l'app
// tourne en un seul process.
const LOGIN_WINDOW_MS = 30 * 1000;
const LOGIN_MAX_PER_IP = 10;
const LOGIN_MAX_PER_IP_EMAIL = 5;

/**
 * SignIn callback isolé pour testabilité. Exporté séparément du handler
 * NextAuth pour permettre des tests unitaires avec db mockée.
 */
export async function signInCallback(args: {
  account: { provider: string } | null;
  profile: { email?: string; name?: string; picture?: string } | null;
}): Promise<boolean> {
  const { account, profile } = args;
  if (!account || account.provider !== "google" || !profile?.email) {
    return false;
  }
  const email = profile.email.toLowerCase();

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existing) {
    await db
      .update(users)
      .set({
        displayName: profile.name ?? existing.displayName,
        avatarUrl: profile.picture ?? existing.avatarUrl,
        deletedAt: null,
      })
      .where(eq(users.id, existing.id));
  } else {
    await db.insert(users).values({
      email,
      displayName: profile.name ?? null,
      avatarUrl: profile.picture ?? null,
    });
  }

  return true;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "missing",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "missing",
    }),
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (creds, request) => {
        const v = validateCredentials(
          typeof creds?.email === "string" ? creds.email : "",
          typeof creds?.password === "string" ? creds.password : "",
        );
        if (!v.ok) return null;

        const ip = clientIpFromHeaders(request.headers);
        const byIp = checkRateLimit(`login:${ip}`, LOGIN_MAX_PER_IP, LOGIN_WINDOW_MS);
        const byIpEmail = checkRateLimit(
          `login:${ip}:${v.email}`,
          LOGIN_MAX_PER_IP_EMAIL,
          LOGIN_WINDOW_MS,
        );
        if (!byIp.ok || !byIpEmail.ok) return null;
        const u = await db.query.users.findFirst({ where: eq(users.email, v.email) });
        if (!u?.passwordHash) return null;
        const ok = await verifyPassword(creds.password as string, u.passwordHash);
        if (!ok) return null;
        return { id: u.id, email: u.email, name: u.displayName, image: u.avatarUrl };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    signIn: ({ account, profile }) => {
      // Credentials sign-in is already validated by the provider's authorize().
      if (account?.provider === "credentials") return true;
      return signInCallback({
        account: account ?? null,
        profile: profile
          ? {
              email: profile.email ?? undefined,
              name: profile.name ?? undefined,
              picture: profile.picture ?? undefined,
            }
          : null,
      });
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "credentials" && user?.id) {
        // Credentials sign-in: authorize() returns the DB user, so user.id is
        // our uuid. (For Google, user.id is the Google `sub`, NOT our uuid -
        // that path must resolve the uuid via profile.email below.)
        token.userId = user.id;
        token.displayName = user.name ?? null;
        token.avatarUrl = user.image ?? null;
      } else if (profile?.email) {
        const u = await db.query.users.findFirst({
          where: eq(users.email, profile.email.toLowerCase()),
        });
        if (u) {
          token.userId = u.id;
          token.displayName = u.displayName;
          token.avatarUrl = u.avatarUrl;
        }
      }
      return token;
    },
    async redirect({ url, baseUrl }) {
      // Auth.js v5 ne propage pas le callbackUrl du form POST → après login il
      // retombe sur la page d'origine ("/" ou "/connexion"). Ces routes ne sont
      // jamais une destination post-authentification valide : rediriger vers
      // /dashboard. Les autres routes same-origin sont préservées.
      const isNotADestination = (pathname: string) =>
        pathname === "/" ||
        pathname === "/connexion" ||
        pathname === "/inscription";

      if (url.startsWith("/")) {
        return isNotADestination(url) ? `${baseUrl}/dashboard` : `${baseUrl}${url}`;
      }
      try {
        const parsed = new URL(url);
        if (parsed.origin === baseUrl) {
          return isNotADestination(parsed.pathname) ? `${baseUrl}/dashboard` : url;
        }
      } catch {
        // not a valid absolute URL - fall through
      }
      return `${baseUrl}/dashboard`;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
        session.user.name = (token.displayName as string) ?? session.user.name;
        session.user.image = (token.avatarUrl as string) ?? session.user.image;
      }
      return session;
    },
  },
  pages: {
    signIn: "/connexion",
  },
});
