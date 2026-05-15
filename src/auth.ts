import NextAuth, { customFetch } from "next-auth";
import Spotify from "next-auth/providers/spotify";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, spotifyTokens } from "@/db/schema";
import { encryptToken } from "@/lib/crypto";
import { SPOTIFY_SCOPES } from "@/lib/spotify/scopes";

export const isSpotifyConfigured = Boolean(
  process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET,
);

// Canonical Spotify OAuth redirect URI. Derived from AUTH_URL (set in
// .env.local for dev = http://127.0.0.1:3000, in Vercel for prod =
// https://loopstat.tech) so the value sent at /authorize and /api/token
// matches exactly what's registered in the Spotify dashboard.
const SPOTIFY_REDIRECT_URI = `${(
  process.env.AUTH_URL ?? "http://127.0.0.1:3000"
).replace(/\/$/, "")}/api/auth/callback/spotify`;

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Spotify({
      clientId: process.env.SPOTIFY_CLIENT_ID ?? "missing",
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? "missing",
      authorization: {
        url: "https://accounts.spotify.com/authorize",
        params: {
          scope: SPOTIFY_SCOPES,
          redirect_uri: SPOTIFY_REDIRECT_URI,
        },
      },
      [customFetch]: async (...args) => {
        const [input, init] = args;
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        if (url.includes("/api/token") && init?.body instanceof URLSearchParams) {
          // Auth.js recomputes redirect_uri from the incoming Host header
          // (trustHost: true). Override with our pinned value so the token
          // exchange matches the authorize step byte-for-byte and Spotify
          // doesn't reject with invalid_grant.
          init.body.set("redirect_uri", SPOTIFY_REDIRECT_URI);
        }
        return fetch(input as Parameters<typeof fetch>[0], init);
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ account, profile }) {
      if (!account || account.provider !== "spotify" || !profile?.id) return false;
      const spotifyId = String(profile.id);

      const existing = await db.query.users.findFirst({
        where: eq(users.spotifyId, spotifyId),
      });

      const userRow = existing
        ? (
            await db
              .update(users)
              .set({
                email: profile.email ?? existing.email,
                displayName:
                  (profile as { display_name?: string }).display_name ?? existing.displayName,
                avatarUrl:
                  (profile as { images?: { url: string }[] }).images?.[0]?.url ??
                  existing.avatarUrl,
                country: (profile as { country?: string }).country ?? existing.country,
                product: (profile as { product?: string }).product ?? existing.product,
                deletedAt: null,
              })
              .where(eq(users.id, existing.id))
              .returning()
          )[0]
        : (
            await db
              .insert(users)
              .values({
                spotifyId,
                email: profile.email ?? null,
                displayName: (profile as { display_name?: string }).display_name ?? null,
                avatarUrl:
                  (profile as { images?: { url: string }[] }).images?.[0]?.url ?? null,
                country: (profile as { country?: string }).country ?? null,
                product: (profile as { product?: string }).product ?? null,
              })
              .returning()
          )[0];

      if (account.access_token && account.refresh_token && account.expires_at) {
        await db
          .insert(spotifyTokens)
          .values({
            userId: userRow.id,
            accessToken: encryptToken(account.access_token),
            refreshToken: encryptToken(account.refresh_token),
            expiresAt: new Date(account.expires_at * 1000),
            scope: account.scope ?? null,
          })
          .onConflictDoUpdate({
            target: spotifyTokens.userId,
            set: {
              accessToken: encryptToken(account.access_token),
              refreshToken: encryptToken(account.refresh_token),
              expiresAt: new Date(account.expires_at * 1000),
              scope: account.scope ?? null,
            },
          });
      }

      return true;
    },
    async jwt({ token, profile }) {
      if (profile?.id) {
        const u = await db.query.users.findFirst({
          where: eq(users.spotifyId, String(profile.id)),
        });
        if (u) {
          token.userId = u.id;
          token.spotifyId = u.spotifyId;
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
        session.user.spotifyId = token.spotifyId as string;
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
