# Auth Pivot (Spotify → Google) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer Spotify OAuth par Google Sign In comme provider d'identité unique, conformément au spec [2026-05-18-auth-pivot-google-design.md](../specs/2026-05-18-auth-pivot-google-design.md).

**Architecture:** Provider swap dans `src/auth.ts` (Spotify → Google via NextAuth v5). Schema migration : `users.email` devient NOT NULL UNIQUE, `users.spotify_id` devient nullable. User existant ré-identifié par email au login Google. Aucun changement aux FK qui pointent toutes vers `users.id` UUID inchangé.

**Tech Stack:** NextAuth v5 (déjà installé), Drizzle ORM, Postgres, vitest (env `node`).

**Note testing :** TDD strict sur le `signIn` callback (logique pure avec db mockée). Composants UI et migration : type-check + vérification manuelle.

---

## File Structure

| Path | Action | Responsabilité |
|---|---|---|
| `drizzle/0004_*.sql` (généré) | Create | Migration SQL : email NOT NULL UNIQUE, spotify_id NULL |
| `src/db/schema.ts` | Modify | Update users : email notNull/unique, spotifyId nullable |
| `src/auth.ts` | Modify (rewrite) | Provider swap Spotify → Google, callbacks réécrits |
| `src/auth.test.ts` | Create | TDD du signIn callback Google |
| `src/types/next-auth.d.ts` | Modify | Drop spotifyId du Session.user et JWT |
| `src/components/landing/google-sign-in-button.tsx` | Create | Bouton Google brand officiel |
| `src/components/landing/spotify-cta-button.tsx` | Delete | Drop |
| `src/components/spotify-login-button.tsx` | Delete | Drop |
| `src/lib/auth/start-spotify-signin.ts` + `.test.ts` | Delete | Drop |
| `src/lib/spotify/scopes.ts` | Delete | Drop |
| `src/app/page.tsx` (landing) | Modify | Bouton Google au lieu de Spotify |
| `src/app/login/page.tsx` | Modify | UI Google + SetupNeeded adapté |
| `src/components/app-header.tsx` | Modify | Drop session.user.spotifyId fallback |
| `.env.example` | Modify | SPOTIFY_* commenté, GOOGLE_CLIENT_ID/SECRET ajoutés |
| `docs/google-auth-setup.md` | Create | Doc one-time setup Google Cloud Console |

---

## Task 1 : Pré-flight check + schema migration

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0004_<random>.sql` (généré par drizzle-kit)

- [ ] **Step 1 : Pré-flight check (manuel)**

```bash
docker exec loopstat_postgres psql -U loopstat -d loopstat -c "SELECT count(*) AS users_without_email FROM users WHERE email IS NULL;"
```

Attendu : `0`. Si > 0, la migration `email SET NOT NULL` échouera. **Si ≠ 0, STOP** et reporter au controller — il faut soit backfiller les emails manquants, soit revoir le spec.

- [ ] **Step 2 : Modifier `src/db/schema.ts`**

Dans `src/db/schema.ts`, remplace les 2 lignes du `users` table :

```ts
// Avant
spotifyId: text("spotify_id").notNull().unique(),
email: text("email"),

// Après
spotifyId: text("spotify_id"),
email: text("email").notNull().unique(),
```

- [ ] **Step 3 : Générer la migration**

```bash
pnpm drizzle-kit generate --name=pivot_auth_google
```

Vérifier le SQL généré dans `drizzle/0004_*.sql`. Il doit contenir :
- `ALTER COLUMN email SET NOT NULL`
- `ADD CONSTRAINT users_email_unique UNIQUE (email)` (ou équivalent)
- `ALTER COLUMN spotify_id DROP NOT NULL`
- `DROP CONSTRAINT users_spotify_id_unique` (ou équivalent)

Si le SQL généré semble étrange (drop+recreate au lieu d'ALTER), c'est OK tant que le résultat final est équivalent.

- [ ] **Step 4 : Appliquer la migration**

```bash
pnpm drizzle-kit migrate
```

Attendu : success log. Vérifier :

```bash
docker exec loopstat_postgres psql -U loopstat -d loopstat -c "\d users" | grep -E "email|spotify_id"
```

Doit montrer `email` NOT NULL et `spotify_id` nullable.

- [ ] **Step 5 : Vérifier tsc + tests**

```bash
pnpm tsc --noEmit
pnpm vitest run
```

Attendu : tsc clean (le schema change est compatible avec les usages actuels de `users.email` puisque les callers font déjà des fallback `?? null`). Tests verts (83 passent).

- [ ] **Step 6 : Commit**

```bash
git add src/db/schema.ts drizzle/0004_*.sql drizzle/meta/0004_snapshot.json drizzle/meta/_journal.json
git commit -m "$(cat <<'EOF'
feat(schema): pivot users.email NOT NULL UNIQUE, spotify_id nullable

Préparation du pivot identité (Spotify OAuth → Google Sign In) selon
docs/superpowers/specs/2026-05-18-auth-pivot-google-design.md.

email devient l'identifiant canonique des users (matched au login Google).
spotify_id reste en place mais nullable — sera droppé en sous-projet E
après vérification que toutes les features marchent post-pivot.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 : Refactor `src/auth.ts` (TDD sur signIn callback)

**Files:**
- Create: `src/auth.test.ts`
- Modify: `src/auth.ts` (rewrite complet)

- [ ] **Step 1 : Écrire les tests qui échouent**

Crée `src/auth.test.ts` :

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the db module before importing auth
const findFirstMock = vi.fn();
const updateMock = vi.fn();
const insertMock = vi.fn();

vi.mock("@/db/client", () => ({
  db: {
    query: { users: { findFirst: findFirstMock } },
    update: () => ({ set: () => ({ where: () => updateMock() }) }),
    insert: () => ({ values: () => insertMock() }),
  },
}));

// Recreate the signIn callback shape so we can test it in isolation. The
// real callback in src/auth.ts has the exact same logic — this test file
// duplicates only the *behavior under test* (not the NextAuth handler shell).
async function signInCallback(args: {
  account: { provider: string } | null;
  profile: { email?: string; name?: string; picture?: string } | null;
}): Promise<boolean> {
  const { signInCallback: real } = await import("./auth");
  return real(args);
}

describe("auth signIn callback (Google)", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    updateMock.mockReset().mockResolvedValue(undefined);
    insertMock.mockReset().mockResolvedValue(undefined);
  });

  it("rejects if account is null", async () => {
    const ok = await signInCallback({ account: null, profile: { email: "x@y.z" } });
    expect(ok).toBe(false);
  });

  it("rejects if provider is not google", async () => {
    const ok = await signInCallback({
      account: { provider: "spotify" },
      profile: { email: "x@y.z" },
    });
    expect(ok).toBe(false);
  });

  it("rejects if profile.email is missing", async () => {
    const ok = await signInCallback({
      account: { provider: "google" },
      profile: { name: "no email" },
    });
    expect(ok).toBe(false);
  });

  it("updates existing user when email matches", async () => {
    findFirstMock.mockResolvedValue({
      id: "existing-uuid",
      email: "jules@example.com",
      displayName: "Old name",
      avatarUrl: "old-url",
    });
    const ok = await signInCallback({
      account: { provider: "google" },
      profile: { email: "JULES@example.com", name: "New name", picture: "new-url" },
    });
    expect(ok).toBe(true);
    expect(findFirstMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("inserts new user when email is unknown", async () => {
    findFirstMock.mockResolvedValue(undefined);
    const ok = await signInCallback({
      account: { provider: "google" },
      profile: { email: "new@example.com", name: "New user", picture: "url" },
    });
    expect(ok).toBe(true);
    expect(findFirstMock).toHaveBeenCalledTimes(1);
    expect(updateMock).not.toHaveBeenCalled();
    expect(insertMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2 : Lancer les tests, confirmer l'échec**

```bash
pnpm vitest run src/auth.test.ts
```

Attendu : tests failent car `signInCallback` n'est pas encore exporté depuis `src/auth.ts`.

- [ ] **Step 3 : Réécrire `src/auth.ts`**

Remplace **intégralement** `src/auth.ts` par :

```ts
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
    signIn: signInCallback,
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
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
pnpm vitest run src/auth.test.ts
```

Attendu : `5 passed`.

- [ ] **Step 5 : Vérifier tsc + tous tests**

```bash
pnpm tsc --noEmit
pnpm vitest run
```

Attendu : tsc OK (peut signaler des refs à `isSpotifyConfigured` ou à `session.user.spotifyId` qui sont dans d'autres fichiers — sera fixé Tasks 3, 5, 6). À ce stade c'est **OK que tsc échoue** sur ces refs spécifiques (on fix dans les tâches suivantes). Si tsc échoue sur autre chose, escalate.

**Note pour l'implémenteur** : si tsc échoue sur `isSpotifyConfigured`, `session.user.spotifyId`, ou les fichiers spotify-*, c'est attendu. Continue vers Task 3.

- [ ] **Step 6 : Commit**

```bash
git add src/auth.ts src/auth.test.ts
git commit -m "$(cat <<'EOF'
refactor(auth): replace Spotify provider with Google + TDD signIn

NextAuth provider swap : Spotify → Google. SignIn callback exporté pour
TDD (mocked db). User lookup par email lowercased au lieu de spotifyId.

isSpotifyConfigured() renommé en isAuthConfigured(). Les autres callers
(login page, etc.) seront mis à jour dans les tâches suivantes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 : Type augmentation cleanup

**Files:**
- Modify: `src/types/next-auth.d.ts`

- [ ] **Step 1 : Mettre à jour le fichier**

Remplace `src/types/next-auth.d.ts` par :

```ts
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  }
}
```

(Diff : `spotifyId: string` retiré de `Session.user`, `spotifyId?: string` retiré de `JWT`.)

- [ ] **Step 2 : Vérifier tsc**

```bash
pnpm tsc --noEmit
```

Attendu : il restera des erreurs sur `app-header.tsx` (utilise `session.user.spotifyId`) — fixé Task 6. Et probablement sur login/page.tsx + landing/page.tsx + SpotifyLoginButton — fixé Tasks 4-7. Continue.

- [ ] **Step 3 : Commit**

```bash
git add src/types/next-auth.d.ts
git commit -m "$(cat <<'EOF'
refactor(types): drop spotifyId from Session.user + JWT augmentation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 : Composant `<GoogleSignInButton />`

**Files:**
- Create: `src/components/landing/google-sign-in-button.tsx`

- [ ] **Step 1 : Créer le composant**

Crée `src/components/landing/google-sign-in-button.tsx` :

```tsx
"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
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
      className="inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 text-[15px] font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        background: "#ffffff",
        color: "#1f1f1f",
        border: "1px solid #dadce0",
      }}
    >
      <GoogleIcon />
      {loading ? "Redirection…" : "Continuer avec Google"}
    </button>
  );
}
```

(SVG paths officiels Google "G" multi-couleurs, dimension 18x18 conforme aux brand guidelines.)

- [ ] **Step 2 : Vérifier tsc**

```bash
pnpm tsc --noEmit
```

Erreurs résiduelles (app-header, landing, login) toujours attendues — fix dans Tasks 5-7.

- [ ] **Step 3 : Commit**

```bash
git add src/components/landing/google-sign-in-button.tsx
git commit -m "$(cat <<'EOF'
feat(landing): add GoogleSignInButton with official brand asset

Bouton Google Sign In conforme aux brand guidelines (icône G multi-couleurs,
fond blanc, bord #dadce0, texte #1f1f1f). Utilise next-auth/react signIn().

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 : Refactor landing page (`src/app/page.tsx`)

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1 : Remplacer le composant CTA**

Dans `src/app/page.tsx`, fais 2 changements :

(a) Remplacer l'import :
```ts
// Avant
import { SpotifyCtaButton } from "@/components/landing/spotify-cta-button";

// Après
import { GoogleSignInButton } from "@/components/landing/google-sign-in-button";
```

(b) Remplacer `<SpotifyCtaButton />` par `<GoogleSignInButton />` dans le JSX (cherche la balise et remplace).

- [ ] **Step 2 : Vérifier tsc**

```bash
pnpm tsc --noEmit
```

Erreurs résiduelles dans login/page.tsx + app-header — fixé Tasks 6-7. Continue.

- [ ] **Step 3 : Commit**

```bash
git add src/app/page.tsx
git commit -m "$(cat <<'EOF'
refactor(landing): swap SpotifyCtaButton for GoogleSignInButton

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 : Refactor `/login` page

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1 : Réécrire `src/app/login/page.tsx`**

Remplace **intégralement** par :

```tsx
import Link from "next/link";
import { ExternalLink, Music } from "lucide-react";
import { isAuthConfigured } from "@/auth";
import { LegalFooter } from "@/components/legal-footer";
import { GoogleSignInButton } from "@/components/landing/google-sign-in-button";

// Force dynamic rendering so isAuthConfigured() is evaluated at each
// request against the current runtime env, rather than being baked into a
// statically prerendered HTML at build time.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  if (!isAuthConfigured()) {
    return <SetupNeeded />;
  }

  return (
    <>
      <main id="main" className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center space-y-6">
          <div className="space-y-2">
            <div className="mx-auto size-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Music className="size-6 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold">Bienvenue 👋</h1>
            <p className="text-sm text-muted-foreground">
              Connecte-toi pour voir tes stats Spotify.
            </p>
          </div>
          <GoogleSignInButton />
          <p className="text-xs text-muted-foreground">
            En te connectant, tu acceptes nos{" "}
            <Link href="/terms" className="underline hover:text-foreground">
              CGU
            </Link>{" "}
            et notre{" "}
            <Link href="/privacy" className="underline hover:text-foreground">
              politique de confidentialité
            </Link>
            .
          </p>
        </div>
      </main>
      <LegalFooter />
    </>
  );
}

function SetupNeeded() {
  return (
    <main id="main" className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl rounded-2xl border bg-card p-8 space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs uppercase tracking-wider text-muted-foreground">
            Setup requis (1 fois, ~5 min)
          </div>
          <h1 className="text-2xl font-semibold">
            Configure ton client OAuth Google
          </h1>
          <p className="text-sm text-muted-foreground">
            Google demande qu&apos;une app cliente soit enregistrée pour
            authentifier les users via OAuth. Setup en 5 min, gratuit, jusqu&apos;à
            100 testeurs whitelistés sans verification Google.
          </p>
        </div>

        <ol className="space-y-4 text-sm">
          <Step n={1}>
            Va sur{" "}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noreferrer"
              className="text-primary inline-flex items-center gap-1 hover:underline"
            >
              console.cloud.google.com/apis/credentials
              <ExternalLink className="size-3" />
            </a>
            <br />
            Crée un projet si tu n&apos;en as pas, puis clique{" "}
            <kbd className="rounded bg-accent px-1.5 py-0.5 text-xs">
              + Create credentials → OAuth client ID
            </kbd>
            .
          </Step>
          <Step n={2}>
            Type : <strong>Web application</strong>
            <br />
            Name : <code className="text-foreground">loopstat</code>
            <br />
            <strong>Authorized redirect URIs</strong> — ajoute :
            <pre className="mt-2 rounded-lg bg-accent px-3 py-2 text-xs overflow-x-auto">
              <code>http://127.0.0.1:3000/api/auth/callback/google</code>
            </pre>
          </Step>
          <Step n={3}>
            Clique <kbd className="rounded bg-accent px-1.5 py-0.5 text-xs">Create</kbd>.
            <br />
            Copie <strong>Client ID</strong> et <strong>Client secret</strong>{" "}
            depuis le dialog.
          </Step>
          <Step n={4}>
            Configure le consent screen (
            <a
              href="https://console.cloud.google.com/apis/credentials/consent"
              target="_blank"
              rel="noreferrer"
              className="text-primary inline-flex items-center gap-1 hover:underline"
            >
              ici
              <ExternalLink className="size-3" />
            </a>
            ) : External, Testing, ajoute ton email dans &quot;Test users&quot;.
          </Step>
          <Step n={5}>
            Colle les 2 valeurs dans{" "}
            <code className="text-foreground">.env.local</code> :
            <pre className="mt-2 rounded-lg bg-accent px-3 py-2 text-xs overflow-x-auto">
              <code>
                GOOGLE_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxx{"\n"}
                GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxx
              </code>
            </pre>
            Puis redémarre le serveur ({" "}
            <kbd className="rounded bg-accent px-1.5 py-0.5 text-xs">Ctrl+C</kbd>{" "}
            puis <code>pnpm dev</code> ).
          </Step>
        </ol>

        <div className="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
          <span>Cette page disparaîtra automatiquement une fois configuré.</span>
          <Link href="/" className="hover:text-foreground">
            ← Retour
          </Link>
        </div>
      </div>
    </main>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="size-7 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
        {n}
      </span>
      <div className="flex-1 pt-0.5">{children}</div>
    </li>
  );
}
```

- [ ] **Step 2 : Vérifier tsc**

```bash
pnpm tsc --noEmit
```

Erreur résiduelle attendue : app-header.tsx (référence à `session.user.spotifyId`). Fixé Task 7.

- [ ] **Step 3 : Commit**

```bash
git add src/app/login/page.tsx
git commit -m "$(cat <<'EOF'
refactor(login): swap Spotify Developer setup for Google Cloud Console

UI login utilise GoogleSignInButton. SetupNeeded fallback adapté avec
les 5 étapes pour configurer un OAuth client sur Google Cloud Console
(gratuit, ~5 min, jusqu'à 100 testeurs whitelistés sans verification).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7 : Cleanup `app-header.tsx` + drop dead Spotify files

**Files:**
- Modify: `src/components/app-header.tsx`
- Delete: `src/components/spotify-login-button.tsx`
- Delete: `src/components/landing/spotify-cta-button.tsx`
- Delete: `src/lib/auth/start-spotify-signin.ts`
- Delete: `src/lib/auth/start-spotify-signin.test.ts`
- Delete: `src/lib/spotify/scopes.ts`

- [ ] **Step 1 : Patch `app-header.tsx` ligne 35**

Lire d'abord le fichier pour repérer le contexte de la ligne 35.

```bash
sed -n '30,40p' /Users/poney53/Documents/Projets/loopstat/src/components/app-header.tsx
```

Repérer la ligne :
```tsx
{session.user.name ?? session.user.spotifyId}
```

La remplacer par :
```tsx
{session.user.name ?? session.user.email ?? "Compte"}
```

Utiliser `Edit` tool ciblé.

- [ ] **Step 2 : Supprimer les fichiers Spotify devenus dead**

```bash
rm src/components/spotify-login-button.tsx
rm src/components/landing/spotify-cta-button.tsx
rm src/lib/auth/start-spotify-signin.ts
rm src/lib/auth/start-spotify-signin.test.ts
rm src/lib/spotify/scopes.ts
```

- [ ] **Step 3 : Vérifier qu'aucun import résiduel n'est cassé**

```bash
pnpm tsc --noEmit
```

Si tsc se plaint d'imports dangling (ex. un autre fichier importe `scopes` ou `SpotifyLoginButton`), grep + retirer. Probable suspect : `src/auth.ts` qui importait `SPOTIFY_SCOPES`. Vérifier que c'est déjà nettoyé par Task 2 (devrait l'être).

- [ ] **Step 4 : Vérifier tous les tests**

```bash
pnpm vitest run
```

Attendu : `~80 passed` (les 3 tests `start-spotify-signin` sont supprimés, on conserve les autres + ajoute 5 du signIn callback Task 2). Plus précisément : 83 baseline - 3 supprimés + 5 ajoutés = **85 passed**.

- [ ] **Step 5 : Commit**

```bash
git add src/components/app-header.tsx
git add -u  # capture les deletions
git commit -m "$(cat <<'EOF'
chore(spotify): drop dead login button + scopes + signin helper

Suppression des fichiers Spotify-auth devenus inutiles après le pivot Google :
- spotify-login-button.tsx
- spotify-cta-button.tsx
- start-spotify-signin.ts + test
- scopes.ts (SPOTIFY_SCOPES n'est plus référencé)

app-header.tsx : fallback session.user.spotifyId → session.user.email.

Les fichiers src/lib/spotify/* restants (client, catalog, types, top, image-url)
sont gardés intacts ici — utilisés par le worker poll-recent, /api/now-playing,
et pages /album|artist|track. Seront droppés en sub-projet D.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8 : Docs Google Cloud Console + `.env.example`

**Files:**
- Create: `docs/google-auth-setup.md`
- Modify: `.env.example`

- [ ] **Step 1 : Créer `docs/google-auth-setup.md`**

```markdown
# Google OAuth setup (one-time)

Loopstat utilise Google Sign In comme provider d'identité unique (depuis le
pivot mai 2026, suite aux restrictions Spotify dev mode à 5 users max).

## Configuration

1. Va sur https://console.cloud.google.com/apis/credentials
2. Si pas de projet : crée-en un (nom au choix, ex. "loopstat")
3. **+ Create credentials → OAuth client ID**
   - Type : **Web application**
   - Name : `loopstat`
   - **Authorized redirect URIs** :
     - `http://127.0.0.1:3000/api/auth/callback/google` (dev)
     - `https://loopstat.tech/api/auth/callback/google` (prod)
4. Copie **Client ID** + **Client secret**
5. Configure le consent screen :
   - https://console.cloud.google.com/apis/credentials/consent
   - User Type : **External**, Publishing status : **Testing**
   - Scopes : `openid`, `email`, `profile` (par défaut)
   - Test users : ajoute ton email Google
6. Renseigne dans `.env.local` (et `.env.production` pour la prod) :
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=GOCSPX-...
   ```

## Limites du mode Testing

- Jusqu'à **100 testeurs whitelistés** (ajoutés dans Test users du consent screen)
- Pas de verification Google requise
- Largement suffisant pour beta

## Passage en production

Quand prêt pour le launch public :
- Consent screen → **Publish app**
- Google review pendant 1-4 semaines (OAuth Verification)
- Conditions OAuth : moins strictes que Spotify (juste : privacy policy URL,
  app domain verified, scopes justifiés)
- Une fois validé : tous les Google users peuvent s'inscrire (pas de cap)
```

- [ ] **Step 2 : Mettre à jour `.env.example`**

Lire d'abord :
```bash
cat /Users/poney53/Documents/Projets/loopstat/.env.example
```

Remplacer les sections `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` par :

```
# Google OAuth — https://console.cloud.google.com/apis/credentials
# Voir docs/google-auth-setup.md pour la procédure
# Redirect URI to register: http://127.0.0.1:3000/api/auth/callback/google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

(Garde tout le reste : AUTH_SECRET, AUTH_URL, DATABASE_URL, etc.)

- [ ] **Step 3 : Vérifier tsc + tests**

```bash
pnpm tsc --noEmit
pnpm vitest run
```

Attendu : clean, 85 passed.

- [ ] **Step 4 : Commit**

```bash
git add docs/google-auth-setup.md .env.example
git commit -m "$(cat <<'EOF'
docs(auth): add Google OAuth setup guide + update .env.example

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9 : Vérification manuelle end-to-end (user-driven)

**Files:** none modified, manual operations only.

Cette tâche n'écrit pas de code. Elle valide que l'implémentation marche bout en bout. **L'implémenteur fournit les instructions, l'utilisateur fait les actions** (ou l'implémenteur arrête le subagent flow ici pour redonner la main au controller).

- [ ] **Step 1 : Setup Google Cloud Console** (utilisateur, 5 min)

Suivre `docs/google-auth-setup.md`. Renseigner `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` dans `.env.local`.

- [ ] **Step 2 : Démarrer le dev server**

```bash
pnpm dev
```

Attendu : Ready in <2s sur `http://127.0.0.1:3000`.

- [ ] **Step 3 : Vérifier la landing**

Ouvrir `http://127.0.0.1:3000/` :
- Hero violet/lavande inchangé
- Bouton "Continuer avec Google" (blanc, icône G multi-couleurs) au lieu du vert Spotify

- [ ] **Step 4 : Login flow**

Cliquer "Continuer avec Google" → redirige vers Google → consent screen apparaît
(en mode Testing, doit montrer "App not verified, only testers can sign in") →
sélectionner ton compte Google (`julesdeschamps24@gmail.com`) → autoriser →
redirige vers `/dashboard`.

- [ ] **Step 5 : Vérifier que l'historique est préservé**

Sur `/dashboard` : tes 153k streams sont visibles dans les widgets (top tracks,
listening hours, etc.). Si pas le cas → l'email lookup a foiré, escalate.

- [ ] **Step 6 : Vérifier que le Premium status est préservé**

Aller sur `/settings/billing` : status "Premium (essai)" avec date trial end.

- [ ] **Step 7 : Vérifier le profil public**

Aller sur `/u/judescha` (en fenêtre incognito) : la page s'affiche correctement.

- [ ] **Step 8 : Logout + re-login**

Cliquer Logout (sidebar bottom), revenir sur `/`, re-cliquer "Continuer avec
Google". Doit être rapide (Google se souvient), arrive sur `/dashboard` directement.

- [ ] **Step 9 : Vérifier la DB**

```bash
docker exec loopstat_postgres psql -U loopstat -d loopstat -c "SELECT id, email, spotify_id, display_name FROM users;"
```

Doit montrer :
- `id` : `606faa26-...` (UUID inchangé)
- `email` : `julesdeschamps24@gmail.com`
- `spotify_id` : `n07s8i1pakilc4ko4vcplrb5o` (toujours là, nullable)
- `display_name` : peut avoir été mis à jour par Google (ex. "Jules Deschamps")

- [ ] **Step 10 : Commit final (si nécessaire)**

S'il y a eu des ajustements pendant la vérif (ex. correction du SVG path,
ajustement de copy), commit. Sinon, rien à faire — la branche est prête.

---

## Task 10 : Push final

- [ ] **Step 1 : Vérification finale**

```bash
git status
git log --oneline -10
pnpm tsc --noEmit
pnpm vitest run
```

Working tree clean, ~85 tests passants, tsc clean.

- [ ] **Step 2 : Push**

```bash
git push
```

---

## Self-Review

**Spec coverage :**
- ✅ Schema migration (email NOT NULL UNIQUE, spotify_id NULL) : Task 1
- ✅ NextAuth provider swap : Task 2
- ✅ signIn callback Google avec lookup par email lowercased : Task 2 (+ TDD)
- ✅ jwt callback Google : Task 2
- ✅ session callback (drop spotifyId) : Task 2
- ✅ redirect callback (unchanged) : Task 2
- ✅ Type augmentation (drop spotifyId) : Task 3
- ✅ GoogleSignInButton avec brand assets : Task 4
- ✅ Landing page refactor : Task 5
- ✅ Login page refactor + SetupNeeded adapté : Task 6
- ✅ app-header.tsx ligne 35 : Task 7
- ✅ Drop spotify-login-button + start-spotify-signin + scopes : Task 7
- ✅ .env.example + docs/google-auth-setup.md : Task 8
- ✅ Vérification user existant ré-identifié par email : Task 9 step 5
- ✅ Pré-flight check users sans email : Task 1 step 1
- ✅ Préservation `users.id` UUID (FK Stripe, streams, etc.) : implicite, vérifié Task 9 step 6
- ✅ Non-régression /u/<username> : Task 9 step 7

**Type consistency :**
- `signInCallback({ account, profile })` même signature dans Task 2 export + Task 2 test ✓
- `isAuthConfigured()` exporté Task 2, importé Task 6 ✓
- `GoogleSignInButton` exporté Task 4, importé Tasks 5 & 6 ✓
- `users.email` typé string (notNull) post-migration, utilisé Task 7 (session.user.email fallback) ✓

**Pas de placeholder :** scan effectué, aucun "TBD" ou "implement later". SVG paths Google fournis en complet, code complet à chaque étape.

**Scope :** 10 tasks (dont 1 user-driven), tient en une session d'implémentation ~3-4h + ~30 min utilisateur. Décomposé proprement par responsabilité.
