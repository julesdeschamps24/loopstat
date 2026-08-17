# Pivot identité : Spotify OAuth → Google Sign In - design spec

**Date** : 2026-05-18
**Auteur** : Jules + Claude (brainstorming session)
**Sous-projet** : A (Identity layer) - premier d'une série de 5 sous-projets pour le pivot complet "drop Spotify Web API"

## Contexte et motivation

Suite aux changements Spotify Web API du 11 février 2026 :
- Dev mode = **5 users max** (hard cap), grandfathered si déjà au-dessus
- Extended Quota Mode nécessite **250 000 MAU** (impossible pour early stage)
- Cette restriction kille toute ambition commerciale tant qu'on dépend de
  Spotify OAuth pour l'identité

Décision stratégique : **pivot complet** vers un modèle JSON-upload + MusicBrainz,
avec **Google Sign In** comme provider d'identité (remplace Spotify OAuth).

Une branche `personal/spotify-version` est préservée sur GitHub pour usage
personnel (continue de fonctionner avec OAuth Spotify + auto-update).

## Scope de ce sous-projet (A)

**Inclus** : remplacer l'auth Spotify par Google dans la pipeline NextAuth, mettre
à jour le schema users, refactor login + landing UI, conserver les données
utilisateur existantes (ré-identification par email).

**Exclus** (autres sous-projets) :
- B : onboarding JSON-first (workflow upload comme entrée principale)
- C : MusicBrainz catalog (worker enrich)
- D : cleanup Spotify-dependent features (drop poll-recent, /api/now-playing,
  spotify_tokens table)
- E : suppression définitive de la colonne `users.spotify_id` après vérification
  que toutes les features fonctionnent (ce sous-projet la laisse en place
  pour faciliter le rollback)

## Décisions de design

| Sujet | Décision | Alternative écartée |
|---|---|---|
| Auth provider | Google uniquement | Google + Apple ; Google + email magic link ; email magic link only |
| Library | NextAuth v5 (existant) | Auth0, Clerk, Supabase Auth - pas worth la migration |
| User identification post-login | par `email` (NOT NULL UNIQUE) | par Google `sub` ID |
| Existing user re-identification | match `email` (lower-cased) | Drop puis recréer (risque de perte data) |
| `spotify_id` column | **kept (nullable)** dans ce sous-projet, dropped en E | drop immédiatement (risque rollback) |
| `spotify_tokens` table | **kept** (orphan rows tolérées) | drop ici (risque cascade FK) |

## Schema changes

### Migration drizzle

```sql
-- migration: pivot_auth_google
-- 1. Backfill any users without email (devraient être absents - single user)
-- (manual check needed before running)

-- 2. Email becomes NOT NULL UNIQUE
ALTER TABLE users
  ALTER COLUMN email SET NOT NULL,
  ADD CONSTRAINT users_email_unique UNIQUE (email);

-- 3. Make spotify_id nullable (drop in subproject E later)
ALTER TABLE users
  ALTER COLUMN spotify_id DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS users_spotify_id_unique;
```

### `src/db/schema.ts` diff

```ts
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  spotifyId: text("spotify_id"),                          // was UNIQUE NOT NULL
  email: text("email").notNull().unique(),                // was nullable
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  // ... rest unchanged
});
```

## NextAuth configuration

### Provider swap dans `src/auth.ts`

```ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";

export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
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
    async signIn({ account, profile }) {
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
    },
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
      // (unchanged - same logic, just doesn't reference Spotify)
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
        /* fall through */
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
  pages: { signIn: "/login" },
});
```

Note : la fonction `isSpotifyConfigured()` est renommée en `isAuthConfigured()` et
checke maintenant Google. Tous les callers doivent être mis à jour.

## Type augmentation

`src/types/next-auth.d.ts` : retirer `spotifyId` de l'interface `Session.user`.

## Components / pages à modifier

### Drop entirely

- `src/lib/auth/start-spotify-signin.ts` + son `.test.ts`
- `src/components/spotify-login-button.tsx`
- `src/lib/spotify/scopes.ts`

### Refactor

| File | Changement |
|---|---|
| `src/auth.ts` | Provider swap (voir au-dessus) |
| `src/types/next-auth.d.ts` | Retirer `spotifyId` |
| `src/components/landing/spotify-cta-button.tsx` → renommé `google-sign-in-button.tsx` | Bouton Google brand (icône G colorée officielle, fond blanc, texte foncé selon brand guidelines) |
| `src/app/page.tsx` (landing) | "Continuer avec Spotify" → "Continuer avec Google", import du nouveau bouton |
| `src/app/login/page.tsx` | Bouton Google + `SetupNeeded` adapté (mention Google Cloud Console au lieu de Spotify Developer Dashboard) |
| `src/components/app-header.tsx` ligne 35 | `session.user.spotifyId` fallback retiré (utiliser email ou displayName seulement) |
| `.env.example` + `.env.local` | Commenter `SPOTIFY_CLIENT_ID/SECRET`, ajouter `GOOGLE_CLIENT_ID/SECRET` |

### Bouton Google design

```tsx
// src/components/landing/google-sign-in-button.tsx
"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

function GoogleIcon() {
  // SVG officiel "G" multi-couleurs récupéré depuis
  // https://developers.google.com/identity/branding-guidelines
  // (le plan d'implémentation fournit le SVG complet - ~600 caractères
  // de path data pour les 4 segments coloriés)
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      {/* paths officiels Google G, 4 fills : #4285F4 / #34A853 / #FBBC05 / #EA4335 */}
    </svg>
  );
}

export function GoogleSignInButton() {
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => {
        setLoading(true);
        void signIn("google", { callbackUrl: "/dashboard" });
      }}
      className="inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 text-[15px] font-bold transition hover:opacity-90 disabled:opacity-50"
      style={{ background: "#ffffff", color: "#1f1f1f", border: "1px solid #dadce0" }}
    >
      <GoogleIcon />
      {loading ? "Redirection…" : "Continuer avec Google"}
    </button>
  );
}
```

Couleurs et padding respectent les brand guidelines Google
(https://developers.google.com/identity/branding-guidelines).

## Setup Google Cloud Console (à faire UNE FOIS)

Documenté dans `docs/google-auth-setup.md` (nouveau fichier) :

1. Aller sur https://console.cloud.google.com → New Project (ou existant)
2. APIs & Services → Credentials → Create credentials → OAuth client ID
3. Type : Web application
4. Authorized redirect URIs :
   - `http://127.0.0.1:3000/api/auth/callback/google` (dev)
   - `https://loopstat.tech/api/auth/callback/google` (prod)
5. Copier `Client ID` et `Client Secret`
6. Renseigner dans `.env.local` :
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```
7. Configurer le consent screen (External, Testing) avec scopes minimaux
   (`openid`, `email`, `profile`) - pas besoin de verification Google tant
   qu'on est en mode Testing (max 100 testeurs whitelistés gratuits - déjà
   plus large que Spotify dev mode)
8. Quand prêt pour prod : passer en mode "In Production" (Google review ~
   1-4 sem, conditions OAuth Verification - moins strictes que Spotify)

## Migration utilisateur existant

Tu as actuellement un seul user en DB :
- `id = 606faa26-da96-4e7c-935d-2a803eaefc01`
- `email = julesdeschamps24@gmail.com` (déjà set ✓)
- `spotify_id = n07s8i1pakilc4ko4vcplrb5o`

Au premier login Google avec `julesdeschamps24@gmail.com`, le signIn callback
matchera ton user existant (par email), update displayName/avatarUrl avec les
données Google, et ton historique (153k streams, premium status, etc.) reste
intact. `spotify_id` est laissé inchangé (nullable mais conservé pour
rollback).

**Pré-flight check obligatoire** avant migration : query

```sql
SELECT count(*) FROM users WHERE email IS NULL;
```

doit retourner `0` (sinon la migration `email SET NOT NULL` échouera).

## Stratégie de test

### Tests unitaires

- `src/auth.test.ts` (nouveau) : test du signIn callback Google
  - email matches existing user → update + return true
  - email is new → insert + return true
  - profile.email is null → return false
  - account.provider !== "google" → return false
  - lower-casing email avant lookup

### Vérifications manuelles

- Setup Google Cloud Console + ajouter `.env.local` GOOGLE_*
- Run migration : `pnpm drizzle-kit migrate`
- Vérifier pré-flight : `SELECT count(*) FROM users WHERE email IS NULL;` = 0
- Login via Google avec ton email (whitelist testeur si encore en mode Testing)
- Vérifier `/dashboard` charge avec tes 153k streams visibles
- Vérifier `/u/judescha` (profile public) marche encore
- Vérifier `/settings/billing` montre ton premium trialing
- Logout + login again → rapide, pas de re-création user

### Non-régression

- `pnpm tsc --noEmit` clean
- `pnpm vitest run` all green (les tests `start-spotify-signin.test.ts` seront
  supprimés, on devrait passer de 83 → 80 tests + 4-5 nouveaux pour signIn
  Google = ~85 final)

## Hors-scope explicite

- Onboarding JSON-first (sub-projet B)
- Suppression `spotify_tokens` table (sub-projet D)
- Suppression `users.spotify_id` column (sub-projet E)
- Migration des comptes Premium / `stripe_customer_id` (rien à faire - les FK
  pointent toutes vers `users.id` UUID qui ne change pas)
- Multi-provider (ex. Google + Apple plus tard) - peut être ajouté
  ultérieurement, NextAuth supporte trivialement
- Email magic link comme fallback - choix conscient d'écarter pour simplicité
- "Sign in with Apple" - Apple Developer Account à $99/an, pas worth pour MVP
- Renommage de variables d'env ou de fichiers `src/lib/spotify/*` (gardés
  intacts ici, nettoyés en D)
