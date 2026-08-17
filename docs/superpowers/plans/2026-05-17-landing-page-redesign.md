# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre `src/app/page.tsx` selon la spec [2026-05-17-landing-page-redesign-design.md](../specs/2026-05-17-landing-page-redesign-design.md) - palette nébuleuse violet auto-portée (sans dépendre de `.dark` sur `<html>`), hero single-screen avec CTA Spotify vert + lien démo.

**Architecture:** Page autonome qui peint son propre fond inline (radial mauve) au lieu de dépendre du `ThemeProvider`. Trois nouveaux composants isolés sous `src/components/landing/`. Logique d'auth Spotify factorée dans un helper testable (`src/lib/auth/start-spotify-signin.ts`) partagé avec le bouton existant `/login`.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind v4, NextAuth (Spotify), TypeScript strict, vitest (node env, pas de jsdom dispo).

**Note testing :** Le projet n'a pas d'infra de tests composants React (vitest en env `node`, pas de jsdom/RTL). On garde TDD strict sur la **logique** (auth helper), et on traite l'UI par **vérification visuelle manuelle + build + type-check**, comme c'est la norme dans le repo.

---

## File Structure

| Path | Action | Responsabilité |
|---|---|---|
| `src/lib/auth/start-spotify-signin.ts` | Create | Helper async réutilisable : récupère le CSRF token et POST vers `/api/auth/signin/spotify`. Pas de React. |
| `src/lib/auth/start-spotify-signin.test.ts` | Create | Test du helper avec `fetch` mocké. |
| `src/components/spotify-login-button.tsx` | Modify | Délègue à `startSpotifySignin()` au lieu de dupliquer le code. Style inchangé. |
| `src/components/landing/landing-header.tsx` | Create | Wordmark `loopstat.` + lien `Tarifs`. |
| `src/components/landing/landing-footer.tsx` | Create | Variante minimale du footer (couleurs en dur pour ne pas dépendre du thème). |
| `src/components/landing/spotify-cta-button.tsx` | Create | Bouton vert Spotify + icône SVG officielle, utilise `startSpotifySignin()`. |
| `src/app/page.tsx` | Modify | Refactor complet selon la spec. |

---

## Task 1 : Factoriser la logique d'auth Spotify (TDD)

**Files:**
- Create: `src/lib/auth/start-spotify-signin.ts`
- Create: `src/lib/auth/start-spotify-signin.test.ts`
- Modify: `src/components/spotify-login-button.tsx`

- [ ] **Step 1 : Créer le dossier `src/lib/auth/` si absent**

```bash
mkdir -p src/lib/auth
```

- [ ] **Step 2 : Écrire le test qui échoue**

Crée `src/lib/auth/start-spotify-signin.test.ts` :

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { startSpotifySignin } from "./start-spotify-signin";

describe("startSpotifySignin", () => {
  beforeEach(() => {
    // jsdom n'est pas chargé, on stub manuellement document/window
    const docMock = {
      createElement: vi.fn().mockImplementation((tag: string) => ({
        tag,
        appendChild: vi.fn(),
        submit: vi.fn(),
        setAttribute: vi.fn(),
        type: "",
        name: "",
        value: "",
        method: "",
        action: "",
      })),
      body: { appendChild: vi.fn() },
    };
    const winMock = { location: { origin: "http://127.0.0.1:3000" } };

    vi.stubGlobal("document", docMock);
    vi.stubGlobal("window", winMock);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ csrfToken: "fake-csrf-123" }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches the CSRF token from /api/auth/csrf", async () => {
    await startSpotifySignin("/dashboard");
    expect(fetch).toHaveBeenCalledWith("/api/auth/csrf", {
      credentials: "include",
    });
  });

  it("submits a form to /api/auth/signin/spotify with csrf and callback", async () => {
    await startSpotifySignin("/dashboard");
    const createEl = vi.mocked(document.createElement);
    // 1 form + 2 hidden inputs = 3 createElement calls
    expect(createEl).toHaveBeenCalledTimes(3);
    expect(createEl).toHaveBeenNthCalledWith(1, "form");
    expect(createEl).toHaveBeenNthCalledWith(2, "input");
    expect(createEl).toHaveBeenNthCalledWith(3, "input");
  });
});
```

- [ ] **Step 3 : Lancer le test pour confirmer qu'il échoue**

```bash
pnpm vitest run src/lib/auth/start-spotify-signin.test.ts
```

Attendu : `Error: Cannot find module './start-spotify-signin'` ou équivalent.

- [ ] **Step 4 : Implémenter le helper minimal**

Crée `src/lib/auth/start-spotify-signin.ts` :

```ts
/**
 * Démarre le flow OAuth Spotify : récupère le CSRF token, puis POST vers
 * /api/auth/signin/spotify via form submit (le navigateur suit le 302 vers
 * Spotify en préservant les cookies).
 *
 * Doit être appelé uniquement côté client (utilise document/window).
 */
export async function startSpotifySignin(callbackPath: string): Promise<void> {
  const csrfRes = await fetch("/api/auth/csrf", { credentials: "include" });
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/auth/signin/spotify";

  const csrfInput = document.createElement("input");
  csrfInput.type = "hidden";
  csrfInput.name = "csrfToken";
  csrfInput.value = csrfToken;
  form.appendChild(csrfInput);

  const cbInput = document.createElement("input");
  cbInput.type = "hidden";
  cbInput.name = "callbackUrl";
  cbInput.value = `${window.location.origin}${callbackPath}`;
  form.appendChild(cbInput);

  document.body.appendChild(form);
  form.submit();
}
```

- [ ] **Step 5 : Relancer le test, vérifier qu'il passe**

```bash
pnpm vitest run src/lib/auth/start-spotify-signin.test.ts
```

Attendu : `2 passed`.

- [ ] **Step 6 : Refactor `SpotifyLoginButton` pour utiliser le helper**

Remplace **intégralement** le contenu de `src/components/spotify-login-button.tsx` par :

```tsx
"use client";

import { useState } from "react";
import { cn, gradientCta } from "@/lib/utils";
import { startSpotifySignin } from "@/lib/auth/start-spotify-signin";

export function SpotifyLoginButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await startSpotifySignin("/dashboard");
    } catch (e) {
      console.error("signin failed", e);
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => void handleClick()}
      className={cn(
        gradientCta,
        "w-full rounded-full px-6 py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed",
      )}
    >
      {loading ? "Redirection vers Spotify…" : "Se connecter avec Spotify"}
    </button>
  );
}
```

- [ ] **Step 7 : Vérifier qu'aucun test existant n'a régressé**

```bash
pnpm vitest run
pnpm tsc --noEmit
```

Attendu : tous les tests passent, type-check propre.

- [ ] **Step 8 : Commit**

```bash
git add src/lib/auth/start-spotify-signin.ts src/lib/auth/start-spotify-signin.test.ts src/components/spotify-login-button.tsx
git commit -m "$(cat <<'EOF'
refactor(auth): extract startSpotifySignin helper for reuse

Sortie de la logique CSRF + form-submit hors de SpotifyLoginButton vers
src/lib/auth/start-spotify-signin.ts. Permet à un second bouton (landing
hero) de réutiliser le flow sans dupliquer ~30 lignes de DOM manipulation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 : Composant `LandingHeader`

**Files:**
- Create: `src/components/landing/landing-header.tsx`

- [ ] **Step 1 : Créer le dossier**

```bash
mkdir -p src/components/landing
```

- [ ] **Step 2 : Créer le composant**

Crée `src/components/landing/landing-header.tsx` :

```tsx
import Link from "next/link";

export function LandingHeader() {
  return (
    <header className="flex w-full items-center justify-between px-8 py-6">
      <Link
        href="/"
        className="text-lg font-bold tracking-tight"
        style={{ color: "#f4f0ff", letterSpacing: "-0.02em" }}
      >
        loopstat<span style={{ color: "#7c3aed" }}>.</span>
      </Link>
      <Link
        href="/pricing"
        className="text-sm transition hover:opacity-80"
        style={{ color: "#a89ec8" }}
      >
        Tarifs
      </Link>
    </header>
  );
}
```

- [ ] **Step 3 : Vérifier type-check**

```bash
pnpm tsc --noEmit
```

Attendu : pas d'erreur.

- [ ] **Step 4 : Commit**

```bash
git add src/components/landing/landing-header.tsx
git commit -m "$(cat <<'EOF'
feat(landing): add LandingHeader with wordmark + pricing link

Header minimal pour la nouvelle page d'accueil. Wordmark cliquable
"loopstat." (point en violet) + lien Tarifs. Couleurs en dur pour
ne pas dépendre du ThemeProvider (la landing est en force-dark).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 : Composant `LandingFooter`

**Files:**
- Create: `src/components/landing/landing-footer.tsx`

- [ ] **Step 1 : Créer le composant**

Crée `src/components/landing/landing-footer.tsx` :

```tsx
import Link from "next/link";

const LINK_COLOR = "#5a5070";

export function LandingFooter() {
  return (
    <footer
      className="flex flex-wrap items-center justify-between gap-4 border-t px-8 py-5 text-xs"
      style={{
        borderTopColor: "rgba(56, 50, 90, 0.4)",
        color: LINK_COLOR,
      }}
    >
      <div>© 2026 loopstat</div>
      <nav className="flex gap-4">
        <Link
          href="/terms"
          className="transition hover:opacity-80"
          style={{ color: LINK_COLOR }}
        >
          CGU
        </Link>
        <Link
          href="/privacy"
          className="transition hover:opacity-80"
          style={{ color: LINK_COLOR }}
        >
          Confidentialité
        </Link>
        <Link
          href="/legal"
          className="transition hover:opacity-80"
          style={{ color: LINK_COLOR }}
        >
          Mentions légales
        </Link>
      </nav>
    </footer>
  );
}
```

- [ ] **Step 2 : Vérifier type-check**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3 : Commit**

```bash
git add src/components/landing/landing-footer.tsx
git commit -m "$(cat <<'EOF'
feat(landing): add minimal LandingFooter variant

Variante allégée du LegalFooter (qui dépend de text-muted-foreground et
ne marche donc pas hors du ThemeProvider). Mêmes liens, couleurs en dur
pour rester cohérent avec la palette force-dark de la landing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 : Composant `SpotifyCtaButton`

**Files:**
- Create: `src/components/landing/spotify-cta-button.tsx`

- [ ] **Step 1 : Créer le composant**

Crée `src/components/landing/spotify-cta-button.tsx` :

```tsx
"use client";

import { useState } from "react";
import { startSpotifySignin } from "@/lib/auth/start-spotify-signin";

function SpotifyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm5.5 17.3a.75.75 0 0 1-1 .25c-2.8-1.7-6.3-2.1-10.4-1.1a.75.75 0 1 1-.3-1.5c4.5-1 8.3-.6 11.4 1.3.4.2.5.7.3 1.05zm1.5-3.3a.94.94 0 0 1-1.3.3c-3.2-2-8.1-2.6-11.9-1.4a.94.94 0 1 1-.55-1.8c4.3-1.3 9.7-.7 13.4 1.6.4.3.6.9.4 1.3zm.1-3.5C15.5 8.3 8.7 8.05 5.1 9.15a1.13 1.13 0 1 1-.65-2.15c4.1-1.2 11.6-1 16 1.6a1.13 1.13 0 1 1-1.15 1.95z" />
    </svg>
  );
}

export function SpotifyCtaButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await startSpotifySignin("/dashboard");
    } catch (e) {
      console.error("signin failed", e);
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => void handleClick()}
      className="inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 text-[15px] font-bold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      style={{ background: "#1ed760", color: "#0a0a0a" }}
    >
      <SpotifyIcon />
      {loading ? "Redirection…" : "Continuer avec Spotify"}
    </button>
  );
}
```

- [ ] **Step 2 : Vérifier type-check**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3 : Commit**

```bash
git add src/components/landing/spotify-cta-button.tsx
git commit -m "$(cat <<'EOF'
feat(landing): add SpotifyCtaButton with hero styling

Bouton CTA pour la nouvelle landing : pill vert #1ed760, icône SVG
officielle Spotify, texte foncé. Utilise le helper startSpotifySignin
factoré en Task 1, donc 0 duplication d'auth.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 : Refactor de `src/app/page.tsx`

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1 : Remplacer intégralement le contenu**

Réécris `src/app/page.tsx` :

```tsx
import Link from "next/link";

import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { SpotifyCtaButton } from "@/components/landing/spotify-cta-button";

export default function HomePage() {
  return (
    <main
      id="main"
      className="flex min-h-screen flex-col"
      style={{
        background:
          "radial-gradient(ellipse at top, #1a0d2e 0%, #070710 60%)",
        color: "#f4f0ff",
      }}
    >
      <LandingHeader />

      <section className="flex flex-1 flex-col items-center justify-center gap-7 px-6 py-12 text-center">
        <h1
          className="text-[40px] font-bold leading-none sm:text-[64px]"
          style={{ letterSpacing: "-0.03em" }}
        >
          Ton Spotify,
          <br />
          <span style={{ color: "#c4b5fd" }}>en chiffres</span>.
        </h1>

        <p
          className="max-w-xl text-base sm:text-lg"
          style={{ color: "#a89ec8", lineHeight: 1.5 }}
        >
          Tops, historique d&apos;écoute, listening clock - toutes tes stats
          Spotify, gratuites et sans pub.
        </p>

        <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
          <SpotifyCtaButton />
          <Link
            href="/u/demo"
            className="inline-flex items-center gap-1.5 px-3 py-3.5 text-[15px] font-medium transition hover:underline"
            style={{ color: "#c4b5fd" }}
          >
            Voir un exemple <span style={{ opacity: 0.6 }}>→</span>
          </Link>
        </div>

        <p className="text-[13px]" style={{ color: "#5a5070" }}>
          Gratuit · 30 secondes · sans pub
        </p>
      </section>

      <LandingFooter />
    </main>
  );
}
```

- [ ] **Step 2 : Vérifier type-check**

```bash
pnpm tsc --noEmit
```

Attendu : pas d'erreur.

- [ ] **Step 3 : Lancer le build pour valider la prod**

```bash
pnpm build
```

Attendu : build successful, pas de warning bloquant.

- [ ] **Step 4 : Lancer le dev server pour vérification visuelle manuelle**

```bash
pnpm dev
```

- [ ] **Step 5 : Vérification visuelle desktop (1280×800)**

Dans Chromium DevTools, set viewport à 1280×800. Ouvre `http://127.0.0.1:3000/`.

Vérifie :
- [ ] Fond radial mauve visible en haut, dégradé vers `#070710` en bas
- [ ] Header : `loopstat.` à gauche (le `.` en violet), `Tarifs` à droite, aligné verticalement
- [ ] H1 centré, taille ~64px, "en chiffres" en lavande pâle, point final en blanc
- [ ] Sous-titre lisible, gris-mauve, max 520px de large
- [ ] CTA vert Spotify avec icône à gauche, texte noir, pill arrondi
- [ ] Lien "Voir un exemple →" à droite du CTA, lavande
- [ ] Trust line "Gratuit · 30 secondes · sans pub" dessous, gris foncé
- [ ] Footer en bas : copyright à gauche, 3 liens à droite, border-top subtile

- [ ] **Step 6 : Vérification visuelle mobile (375×812)**

Switch viewport à 375×812.

Vérifie :
- [ ] H1 passe à ~40px sans débordement
- [ ] CTA et lien démo s'empilent verticalement, pas côte-à-côte
- [ ] Footer wrap : copyright sur une ligne, liens sur la suivante (acceptable)
- [ ] Pas de scroll horizontal

- [ ] **Step 7 : Vérification light mode forcé**

DevTools → Rendering → Emulate CSS media feature `prefers-color-scheme: light`.

Vérifie :
- [ ] La landing reste **identique** (palette violette inchangée - c'est le point clé du force-dark)

- [ ] **Step 8 : Vérification flow OAuth (non-régression)**

Clique sur "Continuer avec Spotify" → tu dois être redirigé vers Spotify pour autoriser, puis revenir sur `/dashboard`. **Aucun changement de comportement** vs avant.

Vérifie aussi `/login` :
- [ ] Le bouton de `/login` (SpotifyLoginButton, qui utilise maintenant le helper factoré) déclenche le même flow OAuth sans erreur.

- [ ] **Step 9 : Vérification lien démo**

Clique sur "Voir un exemple →" → tu dois arriver sur `/u/demo` (qui renvoie un 404 tant que le profil démo n'a pas été seedé - c'est attendu, voir spec).

- [ ] **Step 10 : Vérification accessibilité au clavier**

Recharge la page, presse `Tab` plusieurs fois :
- [ ] Focus visible (outline violet) sur : wordmark → Tarifs → CTA → lien démo → 3 liens footer
- [ ] Aucun élément interactif n'est sauté

- [ ] **Step 11 : Lancer la suite de tests complète**

```bash
pnpm vitest run
```

Attendu : tous les tests passent (y compris le nouveau test Task 1).

- [ ] **Step 12 : Commit**

```bash
git add src/app/page.tsx
git commit -m "$(cat <<'EOF'
feat(landing): redesign homepage with nébuleuse violet palette

Refonte de src/app/page.tsx selon docs/superpowers/specs/2026-05-17-landing-page-redesign-design.md.

Hero single-screen sur fond radial mauve auto-porté (peint inline,
indépendant du ThemeProvider - la landing reste violette même en
prefers-color-scheme: light). CTA vert Spotify officiel + lien "Voir
un exemple →" vers /u/demo (profil démo à créer dans une spec séparée).

Composants nouveaux : LandingHeader, LandingFooter, SpotifyCtaButton
(sous src/components/landing/). Auth Spotify factorée dans
src/lib/auth/start-spotify-signin.ts (Task 1).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 : Push final

- [ ] **Step 1 : Vérification finale de l'état git**

```bash
git status
git log --oneline -6
```

Attendu : working tree clean (modulo Dockerfile/`.superpowers/`/`scripts/` pré-existants), 5 nouveaux commits sur main (Tasks 1-5).

- [ ] **Step 2 : Push sur `origin/main`**

```bash
git push origin main
```

Attendu : `5 commits → origin/main`.

---

## Self-Review

**Couverture de la spec :**
- ✅ Palette violet/mauve : Task 5 step 1, peinte inline sur le `<main>` racine
- ✅ Typography Inter : déjà chargé via `--font-inter` au layout, hérité (pas besoin de font override sur la page)
- ✅ CTA Spotify green + icône SVG : Task 4
- ✅ Lien "Voir un exemple →" vers `/u/demo` : Task 5 step 1
- ✅ Header wordmark + lien Tarifs : Task 2
- ✅ Footer minimal couleurs en dur : Task 3
- ✅ Force dark sans `ThemeProvider` : Task 5 step 1 (background inline + Task 5 step 7 vérif explicite)
- ✅ Sidebar masquée sur `/` : déjà géré par `sidebar.tsx:34` (PUBLIC_PATHS), rien à faire
- ✅ Profil démo : explicitement hors-scope, lien 404 acceptable (vérifié Task 5 step 9)
- ✅ Accessibilité focus + clavier : Task 5 step 10
- ✅ Build + type-check + tests : Tasks 1, 2, 3, 4, 5 (steps de vérif systématiques)
- ✅ Non-régression `/login` OAuth : Task 5 step 8

**Cohérence des types :**
- `startSpotifySignin(callbackPath: string): Promise<void>` - utilisé identiquement en Tasks 1, 4. ✅
- Pas d'autre interface inter-tâches. ✅

**Pas de placeholder :** scan effectué, pas de "TBD" ni "implement later". ✅

**Scope :** tient en une seule session courte (~30-45 min d'exécution). Pas besoin de décomposer.
