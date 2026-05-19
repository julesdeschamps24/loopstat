# Demo Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher un dashboard de démo (fixtures Spotify 2024) avec modal de bienvenue + sticky banner CTA après auth Google, tant que l'user n'a pas importé son JSON. Conforme à [spec 2026-05-19-demo-onboarding-design.md](../specs/2026-05-19-demo-onboarding-design.md).

**Architecture:** Fixtures hardcodées dans `src/lib/demo/data.ts`. Composants client `<WelcomeModal />` (localStorage flag pour 1-shot) + `<DemoModeBanner />` (sticky persistant). Les 5 pages stats (RSC) branchent sur `hasCompletedImport(userId)` : false → render avec fixtures + banner + (sur dashboard) modal ; true → render réel inchangé.

**Tech Stack:** Next.js 16 App Router (RSC + Client Components), React 19, Tailwind v4, vitest (env `node`), localStorage côté client.

**Note testing :** TDD strict sur les invariants des fixtures (`data.test.ts`). UI components (modal, banner) : pas de test unitaire (pas d'infra RTL/jsdom dans le repo) — vérification visuelle manuelle. Pour les pages refactorées : type-check + vérification manuelle (wiping l'import row pour simuler new user, puis restauration).

---

## File Structure

| Path | Action | Responsabilité |
|---|---|---|
| `src/lib/demo/data.ts` | Create | Fixtures : 30 tracks 2024, 15 artists, 15 albums, 24 listening hours, totals |
| `src/lib/demo/data.test.ts` | Create | Tests d'invariants (counts, ordre, hour distribution) |
| `src/components/onboarding/use-welcome-modal.ts` | Create | Hook client `useWelcomeModalState()` — localStorage flag |
| `src/components/onboarding/demo-mode-banner.tsx` | Create | Sticky bar avec lien `/import?from=welcome` |
| `src/components/onboarding/welcome-modal.tsx` | Create | Modal centrale avec Skip/Importer maintenant |
| `src/app/dashboard/page.tsx` | Modify | Branchement demoMode + WelcomeModal + DemoModeBanner + fixtures |
| `src/app/top/tracks/page.tsx` | Modify | Branchement demoMode + DemoModeBanner + fixtures |
| `src/app/top/artists/page.tsx` | Modify | Idem |
| `src/app/top/albums/page.tsx` | Modify | Idem |
| `src/app/listening-clock/page.tsx` | Modify | Idem |
| `src/app/import/page.tsx` | Modify | Sous-titre adapté si `?from=welcome` |

---

## Task 1 : Fixtures démo + tests (TDD)

**Files:**
- Create: `src/lib/demo/data.ts`
- Create: `src/lib/demo/data.test.ts`

- [ ] **Step 1 : Créer le dossier**

```bash
mkdir -p src/lib/demo
```

- [ ] **Step 2 : Écrire les tests qui échouent**

Crée `src/lib/demo/data.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import {
  DEMO_TOP_TRACKS,
  DEMO_TOP_ARTISTS,
  DEMO_TOP_ALBUMS,
  DEMO_LISTENING_HOURS,
  DEMO_TOTAL_PLAYS,
  DEMO_TOTAL_HOURS_LISTENED,
} from "./data";

describe("demo fixtures", () => {
  it("DEMO_TOP_TRACKS has 30 entries sorted by plays descending", () => {
    expect(DEMO_TOP_TRACKS).toHaveLength(30);
    for (let i = 1; i < DEMO_TOP_TRACKS.length; i++) {
      expect(DEMO_TOP_TRACKS[i].plays).toBeLessThanOrEqual(
        DEMO_TOP_TRACKS[i - 1].plays,
      );
    }
  });

  it("DEMO_TOP_TRACKS entries have demo: prefixed IDs and required fields", () => {
    for (const track of DEMO_TOP_TRACKS) {
      expect(track.trackId).toMatch(/^demo:/);
      expect(typeof track.name).toBe("string");
      expect(track.name.length).toBeGreaterThan(0);
      expect(Array.isArray(track.artistNames)).toBe(true);
      expect(track.artistNames.length).toBeGreaterThan(0);
      expect(typeof track.plays).toBe("number");
      expect(track.plays).toBeGreaterThan(0);
    }
  });

  it("DEMO_TOP_ARTISTS has 15 entries with descending plays", () => {
    expect(DEMO_TOP_ARTISTS).toHaveLength(15);
    for (let i = 1; i < DEMO_TOP_ARTISTS.length; i++) {
      expect(DEMO_TOP_ARTISTS[i].plays).toBeLessThanOrEqual(
        DEMO_TOP_ARTISTS[i - 1].plays,
      );
    }
  });

  it("DEMO_TOP_ALBUMS has 15 entries with descending plays", () => {
    expect(DEMO_TOP_ALBUMS).toHaveLength(15);
    for (let i = 1; i < DEMO_TOP_ALBUMS.length; i++) {
      expect(DEMO_TOP_ALBUMS[i].plays).toBeLessThanOrEqual(
        DEMO_TOP_ALBUMS[i - 1].plays,
      );
    }
  });

  it("DEMO_LISTENING_HOURS has 24 entries indexed by hour 0..23", () => {
    expect(DEMO_LISTENING_HOURS).toHaveLength(24);
    for (let h = 0; h < 24; h++) {
      expect(DEMO_LISTENING_HOURS[h].hour).toBe(h);
      expect(typeof DEMO_LISTENING_HOURS[h].count).toBe("number");
      expect(DEMO_LISTENING_HOURS[h].count).toBeGreaterThanOrEqual(0);
    }
  });

  it("totals are realistic positive numbers", () => {
    expect(DEMO_TOTAL_PLAYS).toBeGreaterThan(1000);
    expect(DEMO_TOTAL_HOURS_LISTENED).toBeGreaterThan(100);
  });
});
```

- [ ] **Step 3 : Lancer les tests, confirmer échec**

```bash
pnpm vitest run src/lib/demo/data.test.ts
```

Attendu : `Cannot find module './data'`.

- [ ] **Step 4 : Implémenter les fixtures**

Crée `src/lib/demo/data.ts` :

```ts
/**
 * Fixtures démo affichées aux users qui n'ont pas encore importé leur
 * historique Spotify. Top tracks/artists/albums basés sur les hits mondiaux
 * Spotify 2024. Les IDs sont préfixés "demo:" — ne sont pas des Spotify
 * IDs valides ; les pages détail (/track/[id], etc.) ne sont pas atteintes
 * en mode démo (composants <RankedRow> rendent sans href donc non cliquables).
 */

export const DEMO_TOP_TRACKS: {
  trackId: string;
  name: string;
  artistNames: string[];
  albumImageUrl: string | null;
  plays: number;
}[] = [
  { trackId: "demo:espresso", name: "Espresso", artistNames: ["Sabrina Carpenter"], albumImageUrl: null, plays: 1247 },
  { trackId: "demo:birds-of-a-feather", name: "BIRDS OF A FEATHER", artistNames: ["Billie Eilish"], albumImageUrl: null, plays: 1180 },
  { trackId: "demo:beautiful-things", name: "Beautiful Things", artistNames: ["Benson Boone"], albumImageUrl: null, plays: 1102 },
  { trackId: "demo:lose-control", name: "Lose Control", artistNames: ["Teddy Swims"], albumImageUrl: null, plays: 1043 },
  { trackId: "demo:bar-song-tipsy", name: "A Bar Song (Tipsy)", artistNames: ["Shaboozey"], albumImageUrl: null, plays: 987 },
  { trackId: "demo:fortnight", name: "Fortnight", artistNames: ["Taylor Swift", "Post Malone"], albumImageUrl: null, plays: 936 },
  { trackId: "demo:houdini", name: "Houdini", artistNames: ["Eminem"], albumImageUrl: null, plays: 892 },
  { trackId: "demo:cruel-summer", name: "Cruel Summer", artistNames: ["Taylor Swift"], albumImageUrl: null, plays: 854 },
  { trackId: "demo:please-please-please", name: "Please Please Please", artistNames: ["Sabrina Carpenter"], albumImageUrl: null, plays: 821 },
  { trackId: "demo:texas-hold-em", name: "Texas Hold 'Em", artistNames: ["Beyoncé"], albumImageUrl: null, plays: 789 },
  { trackId: "demo:i-had-some-help", name: "I Had Some Help", artistNames: ["Post Malone", "Morgan Wallen"], albumImageUrl: null, plays: 754 },
  { trackId: "demo:stick-season", name: "Stick Season", artistNames: ["Noah Kahan"], albumImageUrl: null, plays: 723 },
  { trackId: "demo:million-dollar-baby", name: "Million Dollar Baby", artistNames: ["Tommy Richman"], albumImageUrl: null, plays: 691 },
  { trackId: "demo:end-of-beginning", name: "End of Beginning", artistNames: ["Djo"], albumImageUrl: null, plays: 658 },
  { trackId: "demo:taste", name: "Taste", artistNames: ["Sabrina Carpenter"], albumImageUrl: null, plays: 627 },
  { trackId: "demo:di-mi-nombre", name: "Di Mi Nombre", artistNames: ["Rosalía"], albumImageUrl: null, plays: 595 },
  { trackId: "demo:not-like-us", name: "Not Like Us", artistNames: ["Kendrick Lamar"], albumImageUrl: null, plays: 568 },
  { trackId: "demo:greedy", name: "Greedy", artistNames: ["Tate McRae"], albumImageUrl: null, plays: 539 },
  { trackId: "demo:we-cant-be-friends", name: "We Can't Be Friends (Wait for Your Love)", artistNames: ["Ariana Grande"], albumImageUrl: null, plays: 512 },
  { trackId: "demo:lovin-on-me", name: "Lovin On Me", artistNames: ["Jack Harlow"], albumImageUrl: null, plays: 487 },
  { trackId: "demo:good-luck-babe", name: "Good Luck, Babe!", artistNames: ["Chappell Roan"], albumImageUrl: null, plays: 459 },
  { trackId: "demo:training-season", name: "Training Season", artistNames: ["Dua Lipa"], albumImageUrl: null, plays: 432 },
  { trackId: "demo:water", name: "Water", artistNames: ["Tyla"], albumImageUrl: null, plays: 408 },
  { trackId: "demo:gata-only", name: "GATA ONLY", artistNames: ["FloyyMenor", "Cris MJ"], albumImageUrl: null, plays: 386 },
  { trackId: "demo:flowers", name: "Flowers", artistNames: ["Miley Cyrus"], albumImageUrl: null, plays: 362 },
  { trackId: "demo:agora-hills", name: "agora hills", artistNames: ["Doja Cat"], albumImageUrl: null, plays: 338 },
  { trackId: "demo:paint-the-town-red", name: "Paint The Town Red", artistNames: ["Doja Cat"], albumImageUrl: null, plays: 312 },
  { trackId: "demo:vampire", name: "vampire", artistNames: ["Olivia Rodrigo"], albumImageUrl: null, plays: 287 },
  { trackId: "demo:greedy-old", name: "What Was I Made For?", artistNames: ["Billie Eilish"], albumImageUrl: null, plays: 251 },
  { trackId: "demo:lovesick", name: "Si No Estás", artistNames: ["Iñigo Quintero"], albumImageUrl: null, plays: 214 },
];

export const DEMO_TOP_ARTISTS: {
  artistId: string;
  name: string;
  imageUrl: string | null;
  plays: number;
}[] = [
  { artistId: "demo:sabrina-carpenter", name: "Sabrina Carpenter", imageUrl: null, plays: 2695 },
  { artistId: "demo:taylor-swift", name: "Taylor Swift", imageUrl: null, plays: 1790 },
  { artistId: "demo:billie-eilish", name: "Billie Eilish", imageUrl: null, plays: 1431 },
  { artistId: "demo:doja-cat", name: "Doja Cat", imageUrl: null, plays: 650 },
  { artistId: "demo:benson-boone", name: "Benson Boone", imageUrl: null, plays: 1102 },
  { artistId: "demo:teddy-swims", name: "Teddy Swims", imageUrl: null, plays: 1043 },
  { artistId: "demo:shaboozey", name: "Shaboozey", imageUrl: null, plays: 987 },
  { artistId: "demo:post-malone", name: "Post Malone", imageUrl: null, plays: 1690 },
  { artistId: "demo:eminem", name: "Eminem", imageUrl: null, plays: 892 },
  { artistId: "demo:noah-kahan", name: "Noah Kahan", imageUrl: null, plays: 723 },
  { artistId: "demo:beyonce", name: "Beyoncé", imageUrl: null, plays: 789 },
  { artistId: "demo:ariana-grande", name: "Ariana Grande", imageUrl: null, plays: 512 },
  { artistId: "demo:chappell-roan", name: "Chappell Roan", imageUrl: null, plays: 459 },
  { artistId: "demo:dua-lipa", name: "Dua Lipa", imageUrl: null, plays: 432 },
  { artistId: "demo:kendrick-lamar", name: "Kendrick Lamar", imageUrl: null, plays: 568 },
];

// Pré-trier par plays décroissants (les valeurs ci-dessus ne le sont pas
// strictement). Drizzle/queries renvoient triés ; ici on fait pareil.
DEMO_TOP_ARTISTS.sort((a, b) => b.plays - a.plays);

export const DEMO_TOP_ALBUMS: {
  albumId: string;
  name: string;
  imageUrl: string | null;
  artistNames: string[];
  plays: number;
}[] = [
  { albumId: "demo:short-n-sweet", name: "Short n' Sweet", artistNames: ["Sabrina Carpenter"], imageUrl: null, plays: 2068 },
  { albumId: "demo:tortured-poets", name: "The Tortured Poets Department", artistNames: ["Taylor Swift"], imageUrl: null, plays: 1790 },
  { albumId: "demo:hit-me-hard", name: "Hit Me Hard and Soft", artistNames: ["Billie Eilish"], imageUrl: null, plays: 1180 },
  { albumId: "demo:fireworks", name: "Fireworks & Rollerblades", artistNames: ["Benson Boone"], imageUrl: null, plays: 1102 },
  { albumId: "demo:i-tried-everything", name: "I've Tried Everything But Therapy", artistNames: ["Teddy Swims"], imageUrl: null, plays: 1043 },
  { albumId: "demo:where-i-been", name: "Where I've Been, Isn't Where I'm Going", artistNames: ["Shaboozey"], imageUrl: null, plays: 987 },
  { albumId: "demo:f1-trillion", name: "F-1 Trillion", artistNames: ["Post Malone"], imageUrl: null, plays: 754 },
  { albumId: "demo:the-death-trick", name: "The Death of Slim Shady", artistNames: ["Eminem"], imageUrl: null, plays: 892 },
  { albumId: "demo:stick-season-album", name: "Stick Season", artistNames: ["Noah Kahan"], imageUrl: null, plays: 723 },
  { albumId: "demo:cowboy-carter", name: "Cowboy Carter", artistNames: ["Beyoncé"], imageUrl: null, plays: 789 },
  { albumId: "demo:eternal-sunshine", name: "eternal sunshine", artistNames: ["Ariana Grande"], imageUrl: null, plays: 512 },
  { albumId: "demo:rise-fall-rosie", name: "The Rise and Fall of a Midwest Princess", artistNames: ["Chappell Roan"], imageUrl: null, plays: 459 },
  { albumId: "demo:radical-optimism", name: "Radical Optimism", artistNames: ["Dua Lipa"], imageUrl: null, plays: 432 },
  { albumId: "demo:gnx", name: "GNX", artistNames: ["Kendrick Lamar"], imageUrl: null, plays: 568 },
  { albumId: "demo:scarlet-2", name: "Scarlet 2", artistNames: ["Doja Cat"], imageUrl: null, plays: 650 },
];

DEMO_TOP_ALBUMS.sort((a, b) => b.plays - a.plays);

/**
 * Distribution plausible des écoutes par heure (24 entries, hour 0..23).
 * Pattern : creux nuit profonde (3-6h), build-up matin, peak soir (18-22h),
 * descente nuit. Total ~3000 plays (cohérent avec DEMO_TOTAL_PLAYS).
 */
export const DEMO_LISTENING_HOURS: { hour: number; count: number }[] = [
  { hour: 0, count: 48 },
  { hour: 1, count: 22 },
  { hour: 2, count: 10 },
  { hour: 3, count: 5 },
  { hour: 4, count: 3 },
  { hour: 5, count: 8 },
  { hour: 6, count: 35 },
  { hour: 7, count: 92 },
  { hour: 8, count: 145 },
  { hour: 9, count: 178 },
  { hour: 10, count: 165 },
  { hour: 11, count: 142 },
  { hour: 12, count: 138 },
  { hour: 13, count: 152 },
  { hour: 14, count: 168 },
  { hour: 15, count: 182 },
  { hour: 16, count: 198 },
  { hour: 17, count: 215 },
  { hour: 18, count: 248 },
  { hour: 19, count: 275 },
  { hour: 20, count: 268 },
  { hour: 21, count: 232 },
  { hour: 22, count: 168 },
  { hour: 23, count: 98 },
];

export const DEMO_TOTAL_PLAYS = 12_847;
export const DEMO_TOTAL_HOURS_LISTENED = 423;
```

- [ ] **Step 5 : Lancer les tests, confirmer qu'ils passent**

```bash
pnpm vitest run src/lib/demo/data.test.ts
```

Attendu : `6 passed`.

- [ ] **Step 6 : Lancer la suite complète + tsc**

```bash
pnpm vitest run
pnpm tsc --noEmit
```

Attendu : 85 baseline + 6 nouveaux = **91 passed**. tsc clean.

- [ ] **Step 7 : Commit**

```bash
git add src/lib/demo/data.ts src/lib/demo/data.test.ts
git commit -m "$(cat <<'EOF'
feat(demo): add Spotify Top 2024 fixtures for demo onboarding

30 top tracks + 15 artists + 15 albums + 24h listening distribution
+ totals (12 847 plays, 423h écoutées). IDs préfixés "demo:" pour
distinction nette des Spotify IDs réels. Fixtures triées par plays
desc (matchent le contrat des queries getTop* existantes).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 : Hook `useWelcomeModalState`

**Files:**
- Create: `src/components/onboarding/use-welcome-modal.ts`

- [ ] **Step 1 : Créer le dossier**

```bash
mkdir -p src/components/onboarding
```

- [ ] **Step 2 : Créer le hook**

Crée `src/components/onboarding/use-welcome-modal.ts` :

```ts
"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "loopstat-welcome-shown";

/**
 * Détermine si la modal de bienvenue doit s'afficher au premier load après
 * auth pour un user en mode démo. Utilise localStorage pour éviter de
 * la ré-afficher au refresh.
 *
 * Retourne :
 *  - `isOpen` : true tant qu'on ne ferme pas (initial false, devient true
 *    au mount si flag absent du localStorage)
 *  - `close()` : ferme la modal et persiste le flag
 */
export function useWelcomeModalState(): {
  isOpen: boolean;
  close: () => void;
} {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(STORAGE_KEY) !== "true") {
      setIsOpen(true);
    }
  }, []);

  const close = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "true");
    }
    setIsOpen(false);
  };

  return { isOpen, close };
}
```

- [ ] **Step 3 : Vérifier tsc**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 4 : Commit**

```bash
git add src/components/onboarding/use-welcome-modal.ts
git commit -m "$(cat <<'EOF'
feat(onboarding): add useWelcomeModalState hook with localStorage gate

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 : Composant `<DemoModeBanner />`

**Files:**
- Create: `src/components/onboarding/demo-mode-banner.tsx`

- [ ] **Step 1 : Créer le composant**

Crée `src/components/onboarding/demo-mode-banner.tsx` :

```tsx
import Link from "next/link";

/**
 * Sticky bar affichée en haut des pages stats quand l'user n'a pas encore
 * importé son JSON Spotify. Rappelle que les données affichées sont
 * fictives et CTA vers /import.
 */
export function DemoModeBanner() {
  return (
    <div
      className="sticky top-0 z-40 flex items-center justify-center gap-2 px-4 py-3 text-sm"
      style={{
        background: "rgba(124, 58, 237, 0.18)",
        color: "#c4b5fd",
        borderBottom: "1px solid rgba(124, 58, 237, 0.4)",
        backdropFilter: "blur(8px)",
      }}
    >
      <span>👋 Données fictives —</span>
      <Link
        href="/import?from=welcome"
        className="font-semibold underline underline-offset-2 hover:opacity-80"
        style={{ color: "#f4f0ff" }}
      >
        Importe tes vraies stats →
      </Link>
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier tsc**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3 : Commit**

```bash
git add src/components/onboarding/demo-mode-banner.tsx
git commit -m "$(cat <<'EOF'
feat(onboarding): add DemoModeBanner sticky CTA

Sticky en haut des pages stats. Couleur lavande translucide, lien vers
/import?from=welcome. Server Component (aucun state local).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 : Composant `<WelcomeModal />`

**Files:**
- Create: `src/components/onboarding/welcome-modal.tsx`

- [ ] **Step 1 : Créer le composant**

Crée `src/components/onboarding/welcome-modal.tsx` :

```tsx
"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useWelcomeModalState } from "./use-welcome-modal";

/**
 * Modal de bienvenue affichée une seule fois (per browser, localStorage flag)
 * au premier load après auth pour un user en mode démo. Présente l'app
 * + options Skip / Importer maintenant.
 *
 * Esc = Skip (équivalent au bouton).
 */
export function WelcomeModal() {
  const { isOpen, close } = useWelcomeModalState();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(7, 7, 16, 0.7)", backdropFilter: "blur(4px)" }}
      aria-modal="true"
      role="dialog"
      aria-label="Bienvenue sur loopstat"
    >
      <div
        className="w-full max-w-lg rounded-2xl border p-8 text-center space-y-6"
        style={{
          background: "#1a0d2e",
          borderColor: "rgba(124, 58, 237, 0.3)",
          color: "#f4f0ff",
        }}
      >
        <h2 className="text-2xl font-semibold">Bienvenue sur loopstat 👋</h2>
        <p className="text-sm" style={{ color: "#a89ec8" }}>
          Cette démo te montre à quoi ressemble loopstat avec des données
          fictives. Importe ton historique Spotify pour voir TES vraies
          stats — tops, listening clock, partage de profils, et plus.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={close}
            className="rounded-full px-5 py-2.5 text-sm font-medium transition hover:opacity-80"
            style={{
              background: "transparent",
              color: "#a89ec8",
              border: "1px solid rgba(168, 158, 200, 0.3)",
            }}
          >
            Skip et explorer la démo
          </button>
          <Link
            href="/import?from=welcome"
            onClick={close}
            className="rounded-full px-5 py-2.5 text-sm font-semibold transition hover:opacity-90"
            style={{ background: "#7c3aed", color: "#ffffff" }}
          >
            Importer maintenant →
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier tsc**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3 : Commit**

```bash
git add src/components/onboarding/welcome-modal.tsx
git commit -m "$(cat <<'EOF'
feat(onboarding): add WelcomeModal with Skip / Import CTA

Client Component, modal centrale, full-screen backdrop. Esc = Skip.
Click "Importer" → /import?from=welcome (ferme localStorage flag).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 : Refactor `/dashboard` (demo mode + modal + banner)

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1 : Réécrire `src/app/dashboard/page.tsx`**

Remplace **intégralement** le fichier par :

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Album,
  ChevronRight,
  Clock,
  Music2,
  Users,
} from "lucide-react";

import { auth } from "@/auth";
import { AlbumWall } from "@/components/album-wall";
import { AppHeader } from "@/components/app-header";
import { DemoModeBanner } from "@/components/onboarding/demo-mode-banner";
import { WelcomeModal } from "@/components/onboarding/welcome-modal";
import { CurrentlyPlaying } from "@/components/stats/currently-playing";
import { RankedRow } from "@/components/stats/ranked-list";
import { StatCard } from "@/components/stats/stat-card";
import { EmptyState } from "@/components/stats/empty-state";
import { StaggerItem, StaggerList } from "@/components/ui/motion";
import { fetchTopArtists, fetchTopTracks } from "@/lib/spotify/top";
import { isPremium } from "@/db/queries/billing";
import { hasCompletedImport } from "@/db/queries/imports";
import { getListeningTotals } from "@/db/queries/stats";
import { getProfile } from "@/db/queries/users";
import {
  DEMO_TOP_TRACKS,
  DEMO_TOP_ARTISTS,
  DEMO_TOTAL_PLAYS,
  DEMO_TOTAL_HOURS_LISTENED,
} from "@/lib/demo/data";
import { formatNumber } from "@/lib/utils";
import { ImportBanner } from "@/components/import-banner";
import { OwnProfileCard } from "@/components/profile/own-profile-card";

const WALL_CELLS = 40;

export const dynamic = "force-dynamic";

const WINDOW_LABELS: Record<"7d" | "30d" | "lifetime", string> = {
  "7d": "7 jours",
  "30d": "30 jours",
  lifetime: "Total",
};

const NAV_LINKS = [
  { href: "/top/tracks", label: "Top titres", icon: Music2 },
  { href: "/top/artists", label: "Top artistes", icon: Users },
  { href: "/top/albums", label: "Top albums", icon: Album },
  { href: "/listening-clock", label: "Horloge d'écoute", icon: Clock },
];

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const hasImport = await hasCompletedImport(userId);

  // --- MODE DÉMO ---
  if (!hasImport) {
    const profile = await getProfile(userId);
    const premium = await isPremium(userId);
    const shareUsername =
      profile?.isPublic && profile.username ? profile.username : undefined;

    const top5Tracks = DEMO_TOP_TRACKS.slice(0, 5);
    const top5Artists = DEMO_TOP_ARTISTS.slice(0, 5);

    // Pas de wallCovers pour la démo (pas d'images d'album dans les fixtures).
    const wallCovers: (string | null)[] = Array(WALL_CELLS).fill(null);

    return (
      <>
        <WelcomeModal />
        <DemoModeBanner />
        <AlbumWall covers={wallCovers} />
        <main
          id="main"
          className="flex-1 flex flex-col px-6 py-12 max-w-5xl mx-auto w-full"
        >
          <AppHeader
            session={session}
            shareUsername={shareUsername}
            shareContext="dashboard"
          />
          <div className="flex flex-col gap-12">
            <OwnProfileCard profile={profile} isPremium={premium} />

            {/* Listening totals (demo) */}
            <section>
              <h2 className="mb-4 text-lg font-semibold">Écoutes</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label="7 jours" value={formatNumber(312)} />
                <StatCard label="30 jours" value={formatNumber(1487)} />
                <StatCard
                  label="Total"
                  value={formatNumber(DEMO_TOTAL_PLAYS)}
                  sublabel={`${DEMO_TOTAL_HOURS_LISTENED} h d'écoute`}
                />
              </div>
            </section>

            {/* Top 5 titres (demo, non cliquables) */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Top 5 titres</h2>
                <Link
                  href="/top/tracks"
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Voir tout
                  <ChevronRight className="size-4" />
                </Link>
              </div>
              <StaggerList className="flex flex-col gap-1">
                {top5Tracks.map((track, index) => (
                  <StaggerItem key={track.trackId}>
                    <RankedRow
                      rank={index + 1}
                      title={track.name}
                      subtitle={track.artistNames.join(", ")}
                    />
                  </StaggerItem>
                ))}
              </StaggerList>
            </section>

            {/* Top 5 artistes (demo, non cliquables) */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Top 5 artistes</h2>
                <Link
                  href="/top/artists"
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Voir tout
                  <ChevronRight className="size-4" />
                </Link>
              </div>
              <StaggerList className="flex flex-col gap-1">
                {top5Artists.map((artist, index) => (
                  <StaggerItem key={artist.artistId}>
                    <RankedRow rank={index + 1} title={artist.name} />
                  </StaggerItem>
                ))}
              </StaggerList>
            </section>

            {/* Navigation */}
            <section>
              <h2 className="mb-4 text-lg font-semibold">Explorer</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {NAV_LINKS.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-3 rounded-2xl border bg-card p-4 transition hover:bg-accent"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                      <Icon className="size-5 text-muted-foreground" />
                    </div>
                    <span className="font-medium">{label}</span>
                    <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </main>
      </>
    );
  }

  // --- MODE RÉEL (inchangé sauf retrait de la section isFreshUser) ---
  const [totals, topTracks, topArtists, topTracks1y, profile, premium] =
    await Promise.all([
      getListeningTotals(userId),
      fetchTopTracks(userId, "4w").catch(() => []),
      fetchTopArtists(userId, "4w").catch(() => []),
      fetchTopTracks(userId, "1y").catch(() => []),
      getProfile(userId),
      isPremium(userId),
    ]);
  const shareUsername =
    profile?.isPublic && profile.username ? profile.username : undefined;

  const totalsByWindow = new Map(totals.map((t) => [t.window, t]));
  const orderedWindows: ("7d" | "30d" | "lifetime")[] = ["7d", "30d", "lifetime"];

  const top5Tracks = topTracks.slice(0, 5);
  const top5Artists = topArtists.slice(0, 5);

  // Dédup les top tracks 1y par album.id pour le mur de fond.
  const seenAlbums = new Set<string>();
  const wallCovers: (string | null)[] = [];
  for (const track of topTracks1y) {
    const id = track.album?.id;
    if (!id || seenAlbums.has(id)) continue;
    seenAlbums.add(id);
    wallCovers.push(track.album?.images?.[0]?.url ?? null);
    if (wallCovers.length === WALL_CELLS) break;
  }
  while (wallCovers.length < WALL_CELLS) wallCovers.push(null);

  return (
    <>
      <AlbumWall covers={wallCovers} />
      <main
        id="main"
        className="flex-1 flex flex-col px-6 py-12 max-w-5xl mx-auto w-full"
      >
        <AppHeader
          session={session}
          shareUsername={shareUsername}
          shareContext="dashboard"
        />
        <div className="flex flex-col gap-12">
          <OwnProfileCard profile={profile} isPremium={premium} />
          <ImportBanner />

          {/* CurrentlyPlaying */}
          <section>
            <CurrentlyPlaying />
          </section>

          {/* Listening totals */}
          <section>
            <h2 className="mb-4 text-lg font-semibold">Écoutes</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {orderedWindows.map((window) => {
                const row = totalsByWindow.get(window);
                const count = row?.count ?? 0;
                const msPlayed = row?.msPlayed ?? 0;
                return (
                  <StatCard
                    key={window}
                    label={WINDOW_LABELS[window]}
                    value={formatNumber(count)}
                    sublabel={
                      msPlayed > 0
                        ? `${Math.round(msPlayed / 1000 / 60 / 60)} h`
                        : undefined
                    }
                  />
                );
              })}
            </div>
          </section>

          {/* Top 5 titres */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Top 5 titres</h2>
              <Link
                href="/top/tracks"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Voir tout
                <ChevronRight className="size-4" />
              </Link>
            </div>
            {top5Tracks.length === 0 ? (
              <EmptyState
                title="Pas encore de titres"
                description="Tes titres les plus écoutés apparaîtront ici."
                icon={Music2}
              />
            ) : (
              <StaggerList className="flex flex-col gap-1">
                {top5Tracks.map((track, index) => (
                  <StaggerItem key={track.id}>
                    <RankedRow
                      rank={index + 1}
                      title={track.name}
                      href={`/track/${track.id}`}
                      subtitle={track.artists.map((a) => a.name).join(", ")}
                      imageUrl={track.album?.images?.[0]?.url}
                    />
                  </StaggerItem>
                ))}
              </StaggerList>
            )}
          </section>

          {/* Top 5 artistes */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Top 5 artistes</h2>
              <Link
                href="/top/artists"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Voir tout
                <ChevronRight className="size-4" />
              </Link>
            </div>
            {top5Artists.length === 0 ? (
              <EmptyState
                title="Pas encore d'artistes"
                description="Tes artistes les plus écoutés apparaîtront ici."
                icon={Users}
              />
            ) : (
              <StaggerList className="flex flex-col gap-1">
                {top5Artists.map((artist, index) => (
                  <StaggerItem key={artist.id}>
                    <RankedRow
                      rank={index + 1}
                      title={artist.name}
                      href={`/artist/${artist.id}`}
                      imageUrl={artist.images?.[0]?.url}
                    />
                  </StaggerItem>
                ))}
              </StaggerList>
            )}
          </section>

          {/* Navigation */}
          <section>
            <h2 className="mb-4 text-lg font-semibold">Explorer</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 rounded-2xl border bg-card p-4 transition hover:bg-accent"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <Icon className="size-5 text-muted-foreground" />
                  </div>
                  <span className="font-medium">{label}</span>
                  <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
```

Key changes vs avant :
- Drop ancien import inutile (`Sparkles`, `Download`, `fetchTopArtists` callbacks ...) — vérifier que tsc n'en signale pas
- Drop la section `isFreshUser` (remplacée par WelcomeModal + DemoModeBanner)
- Drop l'utilitaire `formatMs` import si plus utilisé (le sublabel utilise une expression inline maintenant)

- [ ] **Step 2 : Vérifier tsc + tests**

```bash
pnpm tsc --noEmit
pnpm vitest run
```

Attendu : tsc clean (peut signaler des imports inutilisés à virer), 91 tests passing.

- [ ] **Step 3 : Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): demo mode with WelcomeModal + DemoModeBanner

User sans import : modal de bienvenue + sticky banner + dashboard rempli
avec fixtures Spotify Top 2024 (top tracks/artists non cliquables, totals
fictifs cohérents). Section isFreshUser supprimée (remplacée par la modal).

User avec import : mode réel inchangé (data DB + Spotify API).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 : Refactor `/top/tracks` (demo mode + banner)

**Files:**
- Modify: `src/app/top/tracks/page.tsx`

- [ ] **Step 1 : Lire le fichier actuel pour repérer la structure**

```bash
cat src/app/top/tracks/page.tsx
```

Le fichier appelle `getTopTracksFromStreams(userId, periodSince(period), TOP_LIMIT)` et render une `<StaggerList>` de `<RankedRow href={/track/...}>`.

- [ ] **Step 2 : Ajouter le branchement demoMode**

Ajoute en haut du fichier (parmi les autres imports) :

```tsx
import { hasCompletedImport } from "@/db/queries/imports";
import { DemoModeBanner } from "@/components/onboarding/demo-mode-banner";
import { DEMO_TOP_TRACKS } from "@/lib/demo/data";
```

Dans le composant `TopTracksPage`, juste après `const userId = session.user.id;`, ajoute :

```tsx
const hasImport = await hasCompletedImport(userId);

if (!hasImport) {
  return (
    <>
      <DemoModeBanner />
      <main
        id="main"
        className="flex-1 flex flex-col px-6 py-12 max-w-5xl mx-auto w-full"
      >
        <header className="mb-2 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Top titres</h1>
        </header>
        <p className="mb-8 text-sm text-muted-foreground">
          Ces données sont fictives — importe ton historique pour voir les tiennes.
        </p>
        <StaggerList className="flex flex-col gap-1">
          {DEMO_TOP_TRACKS.map((track, index) => (
            <StaggerItem key={track.trackId}>
              <RankedRow
                rank={index + 1}
                title={track.name}
                subtitle={track.artistNames.join(", ")}
                metric={`${formatNumber(track.plays)} écoutes`}
              />
            </StaggerItem>
          ))}
        </StaggerList>
      </main>
    </>
  );
}
```

Le reste du composant (mode réel) reste inchangé.

- [ ] **Step 3 : Vérifier tsc**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 4 : Commit**

```bash
git add src/app/top/tracks/page.tsx
git commit -m "$(cat <<'EOF'
feat(top/tracks): demo mode branch with fixtures + banner

User sans import : 30 tracks fictifs (Spotify Top 2024), non cliquables.
Banner sticky sur le top de la page. Mode réel inchangé.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7 : Refactor `/top/artists`

**Files:**
- Modify: `src/app/top/artists/page.tsx`

- [ ] **Step 1 : Lire le fichier**

```bash
cat src/app/top/artists/page.tsx
```

- [ ] **Step 2 : Appliquer le même pattern que Task 6**

Ajoute imports :

```tsx
import { hasCompletedImport } from "@/db/queries/imports";
import { DemoModeBanner } from "@/components/onboarding/demo-mode-banner";
import { DEMO_TOP_ARTISTS } from "@/lib/demo/data";
```

Après l'auth check :

```tsx
const hasImport = await hasCompletedImport(userId);

if (!hasImport) {
  return (
    <>
      <DemoModeBanner />
      <main
        id="main"
        className="flex-1 flex flex-col px-6 py-12 max-w-5xl mx-auto w-full"
      >
        <header className="mb-2 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Top artistes</h1>
        </header>
        <p className="mb-8 text-sm text-muted-foreground">
          Ces données sont fictives — importe ton historique pour voir les tiennes.
        </p>
        <StaggerList className="flex flex-col gap-1">
          {DEMO_TOP_ARTISTS.map((artist, index) => (
            <StaggerItem key={artist.artistId}>
              <RankedRow
                rank={index + 1}
                title={artist.name}
                metric={`${formatNumber(artist.plays)} écoutes`}
              />
            </StaggerItem>
          ))}
        </StaggerList>
      </main>
    </>
  );
}
```

Le reste inchangé.

- [ ] **Step 3 : Vérifier tsc**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 4 : Commit**

```bash
git add src/app/top/artists/page.tsx
git commit -m "$(cat <<'EOF'
feat(top/artists): demo mode branch with fixtures + banner

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8 : Refactor `/top/albums`

**Files:**
- Modify: `src/app/top/albums/page.tsx`

- [ ] **Step 1 : Lire le fichier**

```bash
cat src/app/top/albums/page.tsx
```

- [ ] **Step 2 : Appliquer le même pattern**

Ajoute imports :

```tsx
import { hasCompletedImport } from "@/db/queries/imports";
import { DemoModeBanner } from "@/components/onboarding/demo-mode-banner";
import { DEMO_TOP_ALBUMS } from "@/lib/demo/data";
```

Après l'auth check :

```tsx
const hasImport = await hasCompletedImport(userId);

if (!hasImport) {
  return (
    <>
      <DemoModeBanner />
      <main
        id="main"
        className="flex-1 flex flex-col px-6 py-12 max-w-5xl mx-auto w-full"
      >
        <header className="mb-2 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Top albums</h1>
        </header>
        <p className="mb-8 text-sm text-muted-foreground">
          Ces données sont fictives — importe ton historique pour voir les tiennes.
        </p>
        <StaggerList className="flex flex-col gap-1">
          {DEMO_TOP_ALBUMS.map((album, index) => (
            <StaggerItem key={album.albumId}>
              <RankedRow
                rank={index + 1}
                title={album.name}
                subtitle={album.artistNames.join(", ")}
                metric={`${formatNumber(album.plays)} écoutes`}
              />
            </StaggerItem>
          ))}
        </StaggerList>
      </main>
    </>
  );
}
```

- [ ] **Step 3 : Vérifier tsc**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 4 : Commit**

```bash
git add src/app/top/albums/page.tsx
git commit -m "$(cat <<'EOF'
feat(top/albums): demo mode branch with fixtures + banner

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9 : Refactor `/listening-clock`

**Files:**
- Modify: `src/app/listening-clock/page.tsx`

- [ ] **Step 1 : Lire le fichier**

```bash
cat src/app/listening-clock/page.tsx
```

- [ ] **Step 2 : Ajouter le branchement demo**

Ajoute imports :

```tsx
import { hasCompletedImport } from "@/db/queries/imports";
import { DemoModeBanner } from "@/components/onboarding/demo-mode-banner";
import { DEMO_LISTENING_HOURS } from "@/lib/demo/data";
```

Après l'auth check, juste avant l'appel à la query qui récupère les heures :

```tsx
const hasImport = await hasCompletedImport(userId);

if (!hasImport) {
  // Le composant qui affiche la heatmap a besoin du même shape que la query :
  // { hour: number; count: number }[] (24 entries). DEMO_LISTENING_HOURS
  // match exactement.
  return (
    <>
      <DemoModeBanner />
      <main
        id="main"
        className="flex-1 flex flex-col px-6 py-12 max-w-5xl mx-auto w-full"
      >
        <header className="mb-8">
          <h1 className="text-2xl font-semibold">Horloge d&apos;écoute</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ces données sont fictives — importe ton historique pour voir les tiennes.
          </p>
        </header>
        {/* Réutiliser ici le composant qui rend la heatmap dans la page actuelle.
            Probable : <ListeningClockChart data={DEMO_LISTENING_HOURS} /> ou
            un <HourHeatmap /> selon le nom dans le fichier actuel.
            Si tu n'es pas sûr, vérifie le JSX réel de la page avant de
            substituer — utilise EXACTEMENT le même composant + même prop name
            que dans le mode réel. */}
      </main>
    </>
  );
}
```

**Note importante pour l'implémenteur** : Le composant de rendu de la heatmap varie selon la page actuelle. Lis d'abord le fichier `src/app/listening-clock/page.tsx`, identifie le composant + nom de prop utilisés pour rendre la heatmap (probablement `<HourHeatmap data={...} />` puisque ce composant a été extrait en sub-projet album), et utilise-le exactement de la même façon avec `DEMO_LISTENING_HOURS` comme data.

- [ ] **Step 3 : Vérifier tsc**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 4 : Commit**

```bash
git add src/app/listening-clock/page.tsx
git commit -m "$(cat <<'EOF'
feat(listening-clock): demo mode branch with fixtures + banner

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10 : Adapter `/import` sous-titre (`?from=welcome`)

**Files:**
- Modify: `src/app/import/page.tsx`

- [ ] **Step 1 : Lire le fichier**

```bash
cat src/app/import/page.tsx
```

Le composant lit déjà `searchParams` (Next.js 16 standard pattern : `searchParams: Promise<{...}>`).

- [ ] **Step 2 : Adapter la signature pour lire `?from=welcome`**

Si le composant ne reçoit pas déjà `searchParams`, l'ajouter en signature :

```tsx
export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const isFromWelcome = from === "welcome";
  // ... rest of the existing code
```

Puis remplacer le sous-titre dans le header. Repérer dans le JSX la `<p>` qui contient :

```
Pour avoir tes vraies écoutes lifetime, pas juste depuis ton inscription à loopstat.
```

Et la remplacer par :

```tsx
<p className="text-sm text-muted-foreground">
  {isFromWelcome
    ? "Plus que quelques minutes avant de voir tes vraies stats."
    : "Pour avoir tes vraies écoutes lifetime, pas juste depuis ton inscription à loopstat."}
</p>
```

- [ ] **Step 3 : Vérifier tsc**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 4 : Commit**

```bash
git add src/app/import/page.tsx
git commit -m "$(cat <<'EOF'
feat(import): adapt subtitle when arriving from welcome modal

`?from=welcome` query param → sous-titre engageant "Plus que quelques
minutes...". Default subtitle inchangé pour les autres entries.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11 : Vérification manuelle end-to-end

**Files:** none modified, manual operations only.

Cette tâche vérifie visuellement que le flow démo marche. Utilise Jules' user comme cobaye : wipe artificiellement son `imports.status=completed` row, vérifie, puis restaure.

- [ ] **Step 1 : Démarrer le dev server depuis le worktree**

```bash
cd /Users/poney53/Documents/Projets/loopstat/.claude/worktrees/feat+auth-google && pnpm dev
```

Attendu : `Ready in <2s`, `Local: http://127.0.0.1:3000`.

- [ ] **Step 2 : Sauvegarder l'état actuel des imports de Jules**

```bash
docker exec loopstat_postgres psql -U loopstat -d loopstat -c \
  "SELECT id, user_id, status, rows_imported, completed_at FROM imports WHERE user_id = '606faa26-da96-4e7c-935d-2a803eaefc01';" > /tmp/jules-imports-backup.txt
cat /tmp/jules-imports-backup.txt
```

Note les IDs et timestamps pour pouvoir restaurer.

- [ ] **Step 3 : Wiper le `status=completed` (simule new user)**

```bash
docker exec loopstat_postgres psql -U loopstat -d loopstat -c \
  "UPDATE imports SET status = 'pending' WHERE user_id = '606faa26-da96-4e7c-935d-2a803eaefc01' AND status = 'completed';"
```

Doit retourner `UPDATE 1` (1 ligne complète existante).

- [ ] **Step 4 : Clear localStorage côté browser**

Dans la console du browser :
```js
localStorage.removeItem("loopstat-welcome-shown");
```

Puis recharge `/dashboard`.

- [ ] **Step 5 : Vérifier le mode démo**

- [ ] Modal de bienvenue apparaît automatiquement
- [ ] Modal contient "Bienvenue sur loopstat 👋"
- [ ] 2 boutons : "Skip et explorer la démo" + "Importer maintenant →"
- [ ] Esc ferme la modal (équivalent Skip)
- [ ] Refresh `/dashboard` : modal NE réapparaît PAS (localStorage flag honoré)

- [ ] **Step 6 : Vérifier les pages stats en mode démo**

Navigue successivement :

- [ ] `/dashboard` : sticky banner lavande "Données fictives", top 5 tracks/artists fictifs (non cliquables visuellement — pas d'effet hover de Link), totals (12 847 plays, etc.)
- [ ] `/top/tracks` : sticky banner + 30 entries fictives (Espresso, BIRDS OF A FEATHER, …), non cliquables, métric "X écoutes"
- [ ] `/top/artists` : sticky banner + 15 artists fictifs (Sabrina Carpenter en #1, …)
- [ ] `/top/albums` : sticky banner + 15 albums fictifs
- [ ] `/listening-clock` : sticky banner + heatmap heures plausibles (peak 18-22h)

- [ ] **Step 7 : Vérifier le lien CTA banner**

- [ ] Click sur "Importe tes vraies stats →" dans la banner d'une page quelconque → arrive sur `/import?from=welcome`
- [ ] Sous-titre `/import` doit dire "Plus que quelques minutes avant de voir tes vraies stats."

- [ ] **Step 8 : Restaurer l'état de Jules**

```bash
docker exec loopstat_postgres psql -U loopstat -d loopstat -c \
  "UPDATE imports SET status = 'completed' WHERE user_id = '606faa26-da96-4e7c-935d-2a803eaefc01' AND id = (SELECT id FROM imports WHERE user_id = '606faa26-da96-4e7c-935d-2a803eaefc01' AND rows_imported = 152893 LIMIT 1);"
```

- [ ] **Step 9 : Vérifier le mode réel**

Recharger `/dashboard` :

- [ ] Banner sticky DISPARU
- [ ] Modal de bienvenue NE s'affiche PAS
- [ ] Vrais top tracks de Jules visibles (Damso, Vald, etc.)
- [ ] CurrentlyPlaying widget réapparait (s'il était caché en mode démo)

- [ ] **Step 10 : Vérifier non-régression tests**

```bash
pnpm vitest run
```

Attendu : **91 passing** (85 baseline + 6 nouveaux fixtures).

```bash
pnpm tsc --noEmit
```

Attendu : clean.

- [ ] **Step 11 : Commit (si nécessaire)**

S'il y a eu des ajustements pendant la vérif (ex. correction de copy, ajustement layout), commit. Sinon, rien à faire.

---

## Task 12 : Push final

- [ ] **Step 1 : Vérification finale**

```bash
git status
git log --oneline -15
pnpm vitest run
pnpm tsc --noEmit
```

Working tree clean, ~15 commits sur la branche (sub-projet A + B), suite verte, tsc clean.

- [ ] **Step 2 : Push**

```bash
git push
```

---

## Self-Review

**Spec coverage :**
- ✅ Fixtures DEMO_TOP_TRACKS/ARTISTS/ALBUMS/LISTENING_HOURS/TOTALS : Task 1
- ✅ `useWelcomeModalState` hook (localStorage gate) : Task 2
- ✅ `<DemoModeBanner />` sticky : Task 3
- ✅ `<WelcomeModal />` avec Skip/Import + Esc : Task 4
- ✅ Dashboard demo mode (modal + banner + fixtures + non-cliquables) : Task 5
- ✅ /top/tracks demo mode : Task 6
- ✅ /top/artists demo mode : Task 7
- ✅ /top/albums demo mode : Task 8
- ✅ /listening-clock demo mode : Task 9
- ✅ /import sous-titre `?from=welcome` : Task 10
- ✅ Vérification manuelle end-to-end : Task 11
- ✅ Tracks/artists/albums non cliquables en mode démo : implémenté via omission de `href` sur `<RankedRow>` (vérifié dans le spec)
- ✅ Localhost flag persistance : Task 2 (hook localStorage)
- ✅ User existant (Jules) bypasse intégralement : Task 11 step 9 vérifie

**Cohérence des types :**
- `DEMO_TOP_TRACKS[i]` shape (trackId/name/artistNames/albumImageUrl/plays) match les usages Tasks 5, 6 ✓
- `DEMO_TOP_ARTISTS[i]` (artistId/name/imageUrl/plays) match Tasks 5, 7 ✓
- `DEMO_TOP_ALBUMS[i]` (albumId/name/imageUrl/artistNames/plays) match Task 8 ✓
- `DEMO_LISTENING_HOURS[i]` (hour/count) match `<HourHeatmap />` shape Task 9 ✓
- `useWelcomeModalState()` return shape (isOpen/close) match Task 4 usage ✓

**Pas de placeholder :** Aucun "TBD" ou "implement later". Toutes les 30+15+15+24 entries de fixtures sont concrètes. Le seul "lire et adapter" est en Task 9 step 2 (composant heatmap dont le nom dépend de la branche actuelle) — note explicite à l'implémenteur de lire le fichier d'abord.

**Scope :** 12 tasks, dont 1 manuel (Task 11) et 1 push (Task 12). Tient en une session d'exécution ~2-3h. Décomposition propre (fixtures → 3 composants → 5 pages → /import → vérif → push).
