# Import Discoverability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre l'import découvrable : grosse bannière en haut du `/dashboard` tant que l'user n'a pas importé, petit lien discret dans la sidebar une fois l'import fait.

**Architecture:** Server-side state detection via une nouvelle query `hasCompletedImport(userId)`. Le `RootLayout` (rendu async) appelle cette query et passe le booléen en prop à `<Sidebar />` (client component). Le `<ImportBanner />` est un server component standalone qui fait sa propre query (mounted dans `/dashboard` uniquement, retourne `null` si l'user a importé).

**Tech Stack:** Next.js 16 App Router, Drizzle ORM, React 19, Tailwind 4. Pas de nouveau test (le projet ne teste pas les queries DB ni les composants UI ; suit le pattern existant). Vérification = `pnpm typecheck && pnpm lint && pnpm build` + smoke test manuel sur `pnpm dev`.

**Référence spec :** [docs/superpowers/specs/2026-05-16-import-discoverability-design.md](../specs/2026-05-16-import-discoverability-design.md)

---

## Task 1 : Query DB `hasCompletedImport`

**Files:**
- Create: `src/db/queries/imports.ts`

- [ ] **Step 1: Créer le fichier de query**

Créer `src/db/queries/imports.ts` :

```ts
import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { imports } from "@/db/schema";

/**
 * True si l'utilisateur a au moins un import dont le statut est
 * "completed". Utilisé pour décider d'afficher la grosse bannière
 * d'import (false) ou le petit lien discret (true).
 *
 * Pattern "exists" : on récupère 1 colonne + LIMIT 1, plus efficace
 * qu'un COUNT(*) sur potentiellement plusieurs imports.
 */
export async function hasCompletedImport(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: imports.id })
    .from(imports)
    .where(and(eq(imports.userId, userId), eq(imports.status, "completed")))
    .limit(1);
  return row !== undefined;
}
```

- [ ] **Step 2: Vérifier le typecheck**

Run: `pnpm typecheck`
Expected: pas d'erreur.

- [ ] **Step 3: Commit**

```bash
git add src/db/queries/imports.ts
git commit -m "feat(db): add hasCompletedImport query for import discoverability"
```

---

## Task 2 : Composant `ImportBanner`

**Files:**
- Create: `src/components/import-banner.tsx`

- [ ] **Step 1: Créer le composant**

Créer `src/components/import-banner.tsx` :

```tsx
import Link from "next/link";

import { auth } from "@/auth";
import { hasCompletedImport } from "@/db/queries/imports";

/**
 * Bannière "Importer ton historique" affichée en haut du dashboard
 * tant que l'utilisateur n'a pas effectué d'import. Server component :
 * fait sa propre query DB, retourne null si l'user a déjà importé (=>
 * le composant peut être mounté inconditionnellement dans le dashboard,
 * il gère sa propre visibilité).
 *
 * Pas de bouton de fermeture : la bannière disparaît uniquement quand
 * l'import est réellement effectué.
 */
export async function ImportBanner() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const alreadyImported = await hasCompletedImport(session.user.id);
  if (alreadyImported) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#7c3aed]/35 bg-[#7c3aed]/12 px-4 py-3 text-sm">
      <span className="size-2 shrink-0 rounded-full bg-[#7c3aed] ring-4 ring-[#7c3aed]/20" />
      <p className="flex-1 text-foreground">
        <strong>Tes stats sont limitées aux 30 derniers jours.</strong>{" "}
        <span className="text-muted-foreground">
          Importe ton historique Spotify (gratuit, ~30 min) pour débloquer
          tes vraies stats lifetime.
        </span>
      </p>
      <Link
        href="/import"
        className="shrink-0 rounded-full bg-[#7c3aed] px-4 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
      >
        Importer →
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier le typecheck**

Run: `pnpm typecheck`
Expected: pas d'erreur.

- [ ] **Step 3: Commit**

```bash
git add src/components/import-banner.tsx
git commit -m "feat(ui): ImportBanner server component (dashboard CTA)"
```

---

## Task 3 : Sidebar - prop `hasImported` + lien conditionnel

**Files:**
- Modify: `src/components/sidebar.tsx`

- [ ] **Step 1: Ajouter la prop et le lien conditionnel**

Le composant `Sidebar` actuel n'accepte aucune prop. Lui ajouter une
prop `hasImported: boolean` et un lien discret en bas de la sidebar,
visible uniquement si `hasImported === true`.

Le contour `<aside>` est déjà en `md:flex-col` - il suffit d'utiliser
`mt-auto` sur le lien pour qu'il soit poussé en bas (au-delà des nav
items).

Remplacer dans `src/components/sidebar.tsx` :

```tsx
export function Sidebar() {
```

par :

```tsx
export function Sidebar({ hasImported }: { hasImported: boolean }) {
```

Et juste avant la fermeture `</aside>` (après la `<nav>`), ajouter :

```tsx
      {hasImported ? (
        <Link
          href="/import"
          className="mt-auto border-t border-white/5 px-3 pt-4 text-xs text-muted-foreground transition hover:text-foreground"
        >
          Mettre à jour mon historique
        </Link>
      ) : null}
```

- [ ] **Step 2: Vérifier le typecheck**

Run: `pnpm typecheck`
Expected: **DOIT échouer** - `src/app/layout.tsx` utilise `<Sidebar />`
sans la nouvelle prop requise. C'est attendu, sera fixé en Task 4.
Note l'erreur et passe au commit.

- [ ] **Step 3: Commit (avec break attendu)**

```bash
git add src/components/sidebar.tsx
git commit -m "feat(sidebar): hasImported prop + 'update import' link (break: layout to wire next)"
```

---

## Task 4 : Wire-up dans `layout.tsx` + insertion dans `/dashboard`

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Rendre le layout async, fetch hasImported, le passer à Sidebar**

Dans `src/app/layout.tsx`, le `RootLayout` est actuellement synchrone.
Il faut le rendre async pour appeler `auth()` + `hasCompletedImport`.

Ajouter les imports en haut du fichier :

```tsx
import { auth } from "@/auth";
import { hasCompletedImport } from "@/db/queries/imports";
```

Modifier la signature et le body. Remplacer :

```tsx
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} ${instrumentSerif.variable} ${dmSerifDisplay.variable} ${bricolageGrotesque.variable} h-full antialiased`}
    >
```

par :

```tsx
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  const hasImported = session?.user?.id
    ? await hasCompletedImport(session.user.id)
    : false;

  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} ${instrumentSerif.variable} ${dmSerifDisplay.variable} ${bricolageGrotesque.variable} h-full antialiased`}
    >
```

Et remplacer :

```tsx
            <Sidebar />
```

par :

```tsx
            <Sidebar hasImported={hasImported} />
```

- [ ] **Step 2: Insérer `<ImportBanner />` en haut du dashboard**

Dans `src/app/dashboard/page.tsx`, ajouter l'import :

```tsx
import { ImportBanner } from "@/components/import-banner";
```

Puis trouver l'élément racine du dashboard (probablement un fragment
`<>...</>` ou un `<main>`) et insérer `<ImportBanner />` comme premier
enfant visible - c'est-à-dire AVANT les KPI cards (`StatCard`) mais
APRÈS le mur d'albums (qui est aria-hidden et fixed en background, donc
ordre DOM non critique).

Concrètement, l'insertion se fait juste avant la première section visible
du dashboard. Repère la première `<section>` ou le premier `<div>` qui
contient du contenu utilisateur (par ex. les `StatCard` ou un `<header>`)
et insère `<ImportBanner />` au-dessus.

Si le dashboard a un `<main>`, l'insertion ressemble à :

```tsx
<main id="main" className="...">
  <ImportBanner />
  {/* reste du dashboard inchangé */}
  ...
</main>
```

Si la racine est un fragment avec `<AlbumWall />` en premier puis un
`<main>` ensuite, garde `<AlbumWall />` en tête (background) et insère
`<ImportBanner />` en première ligne du `<main>`.

- [ ] **Step 3: Vérifier le typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: pas d'erreur. (Si erreur sur `<Sidebar />` sans prop, c'est
que la Task 3 n'a pas été commitée - la prop est requise depuis ce
commit-là.)

- [ ] **Step 4: Vérifier le build**

Run: `pnpm build`
Expected: build réussit, route `/dashboard` listée dans la table des
routes.

- [ ] **Step 5: Smoke test manuel**

Pré-requis : `pnpm db:up` (Docker) + `pnpm dev` lancés.

1. Ouvre http://127.0.0.1:3000/dashboard
2. **Si l'user du test a déjà un import `completed`** (cas actuel du dev
   local) : la bannière ne s'affiche **pas**, et le lien "Mettre à jour
   mon historique" est visible en bas de la sidebar (toutes pages).
3. Pour tester l'autre branche, vide la table `imports` :
   ```bash
   docker exec loopstat_postgres psql -U loopstat -d loopstat -c "DELETE FROM imports;"
   ```
   Refresh `/dashboard`. La grosse bannière violette doit apparaître en
   haut, et le lien "Mettre à jour" doit disparaître de la sidebar.
4. Clic "Importer →" → navigation vers `/import`. ✓

NB : la suppression `DELETE FROM imports` ne supprime PAS les `streams`
déjà importés (table indépendante), donc tu peux jouer avec sans perdre
ta data. Une fois testé, réimporte un faux row pour revenir à l'état
"importé" :
```bash
docker exec loopstat_postgres psql -U loopstat -d loopstat -c "
INSERT INTO imports (user_id, status, files_count, rows_imported, completed_at)
VALUES ((SELECT id FROM users LIMIT 1), 'completed', 14, 152893, NOW());
"
```

- [ ] **Step 6: Commit**

```bash
git add src/app/layout.tsx src/app/dashboard/page.tsx
git commit -m "feat(layout,dashboard): wire ImportBanner + sidebar hasImported state"
```

---

## Vérification finale

Au bout des 4 tasks, l'arbre git contient 4 commits successifs (un par
task). Le typecheck/lint/build passent. Le smoke test manuel confirme
les deux branches (avant / après import).

## Hors-scope (rappel)

- Pas de tests unitaires : suit le pattern existant (queries DB et UI
  components non testés dans ce projet).
- Pas de modal / onboarding tutoriel.
- Pas d'animations / transitions custom - Tailwind `transition` standard.
- Pas de mesure analytique de conversion.
