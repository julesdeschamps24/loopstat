# Découvrabilité de l'import — bannière dashboard + lien sidebar

**Date** : 2026-05-16
**Auteur** : Jules + Claude (brainstorming)
**Statut** : design validé, prêt pour plan

## Problème

L'utilisateur arrive sur `/dashboard` après login et voit ses stats des 30
derniers jours uniquement (limite API Spotify). La fonctionnalité d'import
de l'Extended Streaming History — qui débloque le vrai historique
lifetime — existe sur `/import` mais le seul moyen d'y arriver est un
item de nav "Importer" parmi 7 autres dans la sidebar. **Aucun appel à
l'action** ne pousse vers cette page.

Conséquence prévisible : la plupart des utilisateurs ne sauront jamais
qu'ils peuvent débloquer leurs stats lifetime, ou le découvriront trop
tard.

## Objectif

Rendre l'import **découvrable et insistant tant que l'user ne l'a pas
fait**, puis **rester accessible discrètement** pour les ré-imports
futurs (Spotify renvoie un nouvel export tous les ~30 jours).

## Comportement

| État | Affichage |
|---|---|
| User n'a aucun import `completed` | **Grosse bannière** en haut du dashboard + lien sidebar masqué |
| User a au moins un import `completed` | Bannière masquée + **petit lien discret** en bas de la sidebar |

L'état est calculé côté serveur via une query DB (Drizzle, table `imports`).

## A · Bannière "Importer" (avant import)

**Composant nouveau** : `src/components/import-banner.tsx` (server component)

**Placement** : tout en haut du `<main>` de `/dashboard`, juste après le
header et avant les KPI cards.

**Render** : retourne `null` si l'user a au moins un import `completed`,
sinon le JSX de la bannière.

**Style** (correspond au mockup style B validé) :

```jsx
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
    className="shrink-0 rounded-full bg-[#7c3aed] px-4 py-1.5 text-xs font-medium text-white hover:opacity-90"
  >
    Importer →
  </Link>
</div>
```

**Pas de bouton de fermeture.** La bannière disparaît uniquement quand
l'user a réellement importé.

## B · Lien "Mettre à jour" (après import)

**Modification** : `src/components/sidebar.tsx`

**Placement** : sous la liste des nav items, séparé par une fine
border-top, en bas de la sidebar (côté désktop md+).

**Render conditionnel** : seulement si l'user a au moins un import
`completed`.

**Style** : petit, opacity 0.5, hover → 1, pas de fond.

```jsx
{hasImported ? (
  <Link
    href="/import"
    className="mt-auto border-t border-white/5 px-3 pt-4 text-xs text-muted-foreground hover:text-foreground transition"
  >
    Mettre à jour mon historique
  </Link>
) : null}
```

Le `mt-auto` pousse le lien tout en bas de la sidebar (qui est en
`flex flex-col`).

## Logique : détection de l'état "a importé"

**Nouvelle query DB** : `src/db/queries/imports.ts` (nouveau fichier)

```ts
export async function hasCompletedImport(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(imports)
    .where(and(eq(imports.userId, userId), eq(imports.status, "completed")))
    .limit(1);
  return Number(row?.count ?? 0) > 0;
}
```

Cette query est appelée :
- Dans `import-banner.tsx` pour décider de render la bannière
- Dans `sidebar.tsx` pour décider de render le lien

Sidebar est un client component (`"use client"` pour `usePathname`), donc
on peut pas y faire de query DB directement. Deux options :

1. **Recommandé** : passer `hasImported` en prop, calculé dans le layout
   root (server component) qui wrap la sidebar.
2. Alternative : créer un `/api/import/status` endpoint et fetch côté
   client. Moins propre (un round-trip réseau par render).

→ Option 1 : modifier `src/app/layout.tsx` pour appeler `hasCompletedImport`
si user authentifié, et passer `hasImported` en prop à `<Sidebar />`.

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `src/db/queries/imports.ts` | Nouveau (`hasCompletedImport`) |
| `src/components/import-banner.tsx` | Nouveau (server component) |
| `src/components/sidebar.tsx` | Modifié (prop `hasImported`, lien conditionnel) |
| `src/app/layout.tsx` | Modifié (fetch + passe `hasImported` à Sidebar) |
| `src/app/dashboard/page.tsx` | Modifié (insertion `<ImportBanner />` en tête de main) |

## Hors-scope

- Modal first-visit / onboarding tutoriel : pas nécessaire, la bannière
  suffit.
- Variantes pour les autres pages (top tracks, listening clock) : non,
  la bannière est dashboard-only. Le lien discret sidebar couvre
  partout ailleurs.
- Notification push / email "tu n'as pas encore importé" : hors scope
  MVP.
- Refonte de la page `/import` elle-même : déjà bonne, garder telle quelle.
- A/B test ou métriques de conversion sur la bannière : pas mesuré.

## Vérification

```sh
pnpm typecheck && pnpm lint && pnpm build
```

Test manuel :
1. Sur un compte n'ayant **pas** d'import → `/dashboard` affiche la
   bannière en haut, sidebar n'a pas le lien "Mettre à jour".
2. Cliquer "Importer" → navigue vers `/import`.
3. Effectuer un import complet (status passe à `completed` en DB).
4. Refresh `/dashboard` → la bannière disparaît, le lien discret apparaît
   en bas de la sidebar sur toutes les pages.
5. Cliquer le lien discret → navigue vers `/import` (pour ré-import).

## Décisions verrouillées (récap)

- **Style** : alert bar fine (style B du mockup), `bg-[#7c3aed]/12` + dot
  pulsant, pas de gradient hero.
- **Placement bannière** : tout en haut du `/dashboard` seulement.
- **Pas de dismiss manuel** : disparaît uniquement quand l'user a importé.
- **Mode dégradé** : petit lien permanent dans la sidebar après import.
