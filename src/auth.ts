import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";

// Read at request time, not module-load. Next/Turbopack may otherwise inline
// `process.env.X` at `next build` (where the var is intentionally absent in
// our Docker build stage) and bake the result into the compiled output.
export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
}

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
  ],
  session: { strategy: "jwt" },
  callbacks: {
    signIn: ({ account, profile }) =>
      signInCallback({
        account: account ?? null,
        profile: profile
          ? {
              email: profile.email ?? undefined,
              name: profile.name ?? undefined,
              picture: profile.picture ?? undefined,
            }
          : null,
      }),
    async jwt({ token, profile }) {
      if (profile?.email) {
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
      // retombe sur la page d'origine ("/" ou "/login"). Ces routes ne sont
      // jamais une destination post-authentification valide : rediriger vers
      // /dashboard. Les autres routes same-origin sont préservées.
      const isNotADestination = (pathname: string) =>
        pathname === "/" || pathname === "/login";

      if (url.startsWith("/")) {
        return isNotADestination(url) ? `${baseUrl}/dashboard` : `${baseUrl}${url}`;
      }
      try {
        const parsed = new URL(url);
        if (parsed.origin === baseUrl) {
          return isNotADestination(parsed.pathname) ? `${baseUrl}/dashboard` : url;
        }
      } catch {
        // not a valid absolute URL — fall through
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
    signIn: "/login",
  },
});
