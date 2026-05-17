# Public Profile Discoverability — Design Spec

**Date** : 2026-05-17
**Branche d'implémentation cible** : nouvelle branche `feat/profile-discoverability` (depuis `main` après merge de Phase A)

## Context

Phase A viral livrée (merge `9afc0e1`) : profils publics opt-in `/u/[username]`, OG card auto, ShareButton + éditeur custom `/share`. **Mais** :

1. **Côté propriétaire** : un user ne sait pas qu'il a un profil public ni où le trouver. Le toggle existe dans `/settings` mais aucun rappel ailleurs dans l'app — le user importe ses streams, voit ses tops sur `/dashboard`, et oublie complètement la dimension publique.
2. **Côté visiteur** : aucun moyen de trouver le profil d'un autre user depuis l'app. La seule façon = connaître le pseudo et taper l'URL dans le navigateur. Pas de search interne.

Sans découvrabilité, la viralité s'auto-bloque : peu de profils activés → peu de cartes partagées → peu de visiteurs → peu de signups. Ce spec couvre les deux côtés.

## Périmètre

### Dans le MVP

**Côté propriétaire (rendre TON profil évident dans l'app)** :
1. Card "Mon profil public" sur `/dashboard` avec URL + copy/view + état (actif/désactivé/pas configuré)
2. `@username` en footer sidebar, link vers `/u/<username>` ou `/settings` selon l'état
3. Link "Voir mon profil public →" sous le toggle dans `/settings` (target `_blank`)
4. Banner "Tu visites ton propre profil" sur `/u/<username>` quand l'auteur est connecté

**Côté visiteur (trouver les autres)** :
5. Page `/find` avec barre de recherche + résultats sous forme de cartes
6. Item nav sidebar **"Trouver des amis"** vers `/find`
7. Search backend : ILIKE sur `username` OU `display_name`, filtré `is_public=true`, debounce client 250ms

### Hors MVP — GH issue future

- **Algo de découverte taste-based** : suggérer des inconnus avec des goûts proches (artistes communs, périodes d'écoute similaires, etc.). Demande un système de scoring + une vue "Explorer" séparée de la search par pseudo.
- Concept follow/friend, notifications, feed.
- Filtres avancés (genre, ancienneté de compte, etc.).
- Cartes résultats enrichies (mini top tracks/artists par profil) — au MVP juste avatar + nom + handle.

### Décisions verrouillées

- **Pas de cache** pour `searchPublicProfiles` — la query est rapide (index unique sur `username`, ILIKE sur petite table tant que le user count est bas). Re-évaluer post-1k users.
- **Pas de pagination** côté MVP — limite serveur à 20 résultats, suffisant tant que `is_public=true` users < 1k.
- **Pas d'API JSON publique** pour la search — server action seulement (auth-only, type-safe, pas de surface attaque).
- **Min 2 chars** avant fire la query pour ne pas spam le serveur sur la 1ère lettre tapée.
- **Anti-enumeration** : seuls les profils opt-in apparaissent. Le user qui ne veut pas être trouvable garde `is_public=false`.

## Section 1 — Côté propriétaire

### 1.A Card "Mon profil public" sur `/dashboard`

Placée en haut, juste après `<AppHeader>` (avant `<ImportBanner>`). Server component qui reçoit le `profile` déjà fetché par la page dashboard.

États :

- **Public actif** (`is_public=true && username`) :
  ```
  ┌─────────────────────────────────────────────────┐
  │ [avatar] Judescha          🟢 Profil public     │
  │          @judescha                              │
  │          loopstat.tech/u/judescha               │
  │          [Copier le lien]   [Voir mon profil →] │
  └─────────────────────────────────────────────────┘
  ```
  `[Voir mon profil →]` est un `<a href="/u/<username>" target="_blank">`. Le copy est un client component minuscule.

- **Username choisi mais pas public** (`is_public=false && username`) :
  ```
  ┌─────────────────────────────────────────────────┐
  │ Ton profil est privé                            │
  │ Active-le pour partager tes stats avec tes      │
  │ amis sur loopstat.tech/u/judescha.              │
  │ [Activer mon profil public →]                   │
  └─────────────────────────────────────────────────┘
  ```
  CTA link `/settings`.

- **Pas encore configuré** (`!username`) : carte n'apparaît pas du tout — la 1ère visite settings configure auto le username (déjà fait via `ensureUsernamePersisted` server action).

Composant : `src/components/profile/own-profile-card.tsx` (server). Action copy : `src/components/profile/own-profile-card-actions.tsx` (client minuscule).

### 1.B Footer sidebar `@username`

Sous les liens légaux (CGU / Privacy / Mentions légales), ajouter une ligne mono faint :

```
@judescha
```

- `is_public=true` → link `/u/<username>` (target self, pas blank — c'est de la nav interne)
- `is_public=false` → link `/settings` avec hint visuel (opacité un cran plus basse + tooltip "Profil privé — clique pour activer")
- Pas de username → la ligne n'apparaît pas

Modif : [src/components/sidebar.tsx](src/components/sidebar.tsx) — accepter les props `username?: string` et `isPublic?: boolean`, calculer dans [src/app/layout.tsx](src/app/layout.tsx) via le même pattern que `hasImported`.

### 1.C Link "Voir mon profil public →" dans `/settings`

Sous le toggle (visible uniquement si `is_public=true`) :

```html
<a href="/u/<username>" target="_blank" rel="noopener">
  Voir mon profil public →
</a>
```

Style : `text-sm text-[#7c3aed] hover:underline`. Modif inline dans [src/components/settings/profile-form.tsx](src/components/settings/profile-form.tsx).

### 1.D Banner "tu visites ton propre profil"

Si `session.user.id === profile.id` quand un user authentifié visite `/u/<username>`, ajouter en haut de la page (avant le `<header>` profile) :

```html
<aside className="rounded-xl border bg-[#7c3aed]/10 px-4 py-3 mb-6 flex items-center justify-between">
  <span>👤 Tu visites ton propre profil — c'est ce que voient les autres.</span>
  <Link href="/settings">Modifier mes réglages →</Link>
</aside>
```

Modif : [src/app/u/[username]/page.tsx](src/app/u/[username]/page.tsx) — fetch `auth()` puis comparer.

## Section 2 — Page `/find`

### 2.A Route

`GET /find` (server component) :
1. `auth()` → redirect `/login` si pas auth.
2. Render `<FindEditor />` (client component) — pas de query DB côté server, search est purement client-driven via server action.

### 2.B `<FindEditor />` (client)

`src/components/find/find-editor.tsx` :

```
┌──────────────────────────────────────┐
│  <h1>Trouver des amis</h1>           │
│  <p subtitle>Tape un pseudo ou un    │
│   nom pour retrouver tes potes.</p>  │
│                                       │
│  ┌──────────────────────────────┐    │
│  │ 🔍 jules                     │    │  ← autofocus
│  └──────────────────────────────┘    │
│                                       │
│  [Result Card]                       │
│  [Result Card]                       │
│  [Result Card]                       │
└──────────────────────────────────────┘
```

State :
- `query: string`
- `results: PublicProfileSummary[]`
- `isLoading: boolean`
- `hasSearched: boolean` (devient true après le 1er fire)

Comportement :
- Input contrôlé, autofocus
- Debounce 250ms via `setTimeout` dans un `useEffect`
- Si `query.trim().length < 2` → reset results, ne fire pas
- Sinon : call `searchUsersAction(query.trim())`, set results

États affichés :
- `query.length < 2 && !hasSearched` → message centré "Tape un pseudo (min 2 caractères) pour rechercher."
- `isLoading` → 3 skeleton cards
- `hasSearched && results.length === 0` → "Aucun profil trouvé pour '\<query\>'. Vérifie l'orthographe ou demande son pseudo à ton pote."
- `results.length > 0` → grille 1 colonne (sm) / 2 colonnes (md+) de `<ResultCard>`

### 2.C `<ResultCard />` (client OK)

`src/components/find/result-card.tsx` :

```html
<Link href="/u/<username>" className="...flex items-center gap-4 rounded-2xl border bg-card p-4 transition hover:bg-accent">
  {avatarUrl ? <img className="size-12 rounded-full"/> : <Initial/>}
  <div className="flex-1">
    <p className="font-medium">Display Name</p>
    <p className="text-sm font-mono text-muted-foreground">@username</p>
  </div>
  <ChevronRight className="size-4 text-muted-foreground" />
</Link>
```

### 2.D Server action `searchUsersAction`

`src/app/find/actions.ts` :

```ts
"use server";

import { auth } from "@/auth";
import { searchPublicProfiles, type PublicProfileSummary } from "@/db/queries/users";

export type SearchResult =
  | { ok: true; results: PublicProfileSummary[] }
  | { ok: false; error: "unauthenticated" | "query_too_short" };

export async function searchUsersAction(query: string): Promise<SearchResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthenticated" };

  const q = query.trim().toLowerCase();
  if (q.length < 2 || q.length > 30) return { ok: false, error: "query_too_short" };

  const results = await searchPublicProfiles(q, 20);
  return { ok: true, results };
}
```

### 2.E DB helper `searchPublicProfiles`

Ajout dans [src/db/queries/users.ts](src/db/queries/users.ts) :

```ts
export type PublicProfileSummary = {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

// Escape Postgres LIKE wildcards (% and _) and the escape char itself
// so user input is treated as literal text. Without this, typing "_"
// or "%" would match anything.
function escapeLikePattern(raw: string): string {
  return raw.replace(/[\\%_]/g, "\\$&");
}

export async function searchPublicProfiles(
  query: string,
  limit: number,
): Promise<PublicProfileSummary[]> {
  const pattern = `%${escapeLikePattern(query)}%`;
  const rows = await db
    .select({
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(
      and(
        eq(users.isPublic, true),
        isNotNull(users.username),
        or(
          ilike(users.username, pattern),
          ilike(users.displayName, pattern),
        ),
      ),
    )
    .orderBy(asc(users.username))
    .limit(limit);
  return rows.filter((r): r is PublicProfileSummary => r.username !== null);
}
```

Pas de cache `React.cache` ici — query est appelée depuis une server action, à la demande, jamais 2x dans le même render.

**Note prod** : si la table users dépasse 10k+ rows, ajouter un index sur `display_name` (le `username` a déjà un index unique). Pour le MVP <100 users : inutile.

`escapeLikePattern` est extractable en helper export pour être testable unitairement (cf. section Tests).

### 2.F Nav item sidebar

[src/components/sidebar.tsx](src/components/sidebar.tsx), ajouter au `NAV_ITEMS` après "Top albums" et avant "Horloge d'écoute" :

```ts
{ href: "/find", label: "Trouver des amis", icon: UserSearch },
```

Import : `import { UserSearch } from "lucide-react";`.

## Vérification end-to-end

1. **Profil owner** :
   - `/dashboard` (logged in, public) → card "Mon profil public" visible avec URL + Copier + Voir
   - `/dashboard` (logged in, privé) → card "Active ton profil public" avec CTA Activer
   - Sidebar footer → `@judescha` link → clic ouvre `/u/judescha`
   - `/settings` (public) → "Voir mon profil public →" link visible, target=_blank
   - `/u/judescha` (logged in comme judescha) → banner "Tu visites ton propre profil" en haut

2. **Search** :
   - `/find` non auth → 307 redirect `/login`
   - `/find` auth → page avec input vide
   - Taper "ju" → results de tous les users dont username/displayName contient "ju" (public uniquement)
   - Taper "doesnotexist" → "Aucun profil trouvé" empty state
   - Taper 1 char → pas de fire, message "min 2 caractères"
   - Click sur une résult card → navigate vers `/u/<username>`
   - Tester avec 1 seul user (`judescha`) en DB : "jud" doit le trouver, "xyz" doit afficher empty state

3. **Anti-enumeration** :
   - Mettre `is_public=false` sur judescha → tape "jud" dans /find → 0 résultats
   - Restaurer `is_public=true` → "jud" le retrouve

4. **Sidebar nav** :
   - Item "Trouver des amis" présent + actif quand on est sur `/find`
   - Pas affiché sur les pages publiques (`/`, `/login`, `/u/*`) — déjà géré par le sidebar guard

## Files à créer

- `src/app/find/page.tsx` (server component, auth guard)
- `src/app/find/actions.ts` (server action `searchUsersAction`)
- `src/components/find/find-editor.tsx` (client : input + state + results)
- `src/components/find/result-card.tsx` (client OK, link card)
- `src/components/profile/own-profile-card.tsx` (server, dispatch sur état)
- `src/components/profile/own-profile-card-actions.tsx` (client : bouton Copier)

## Files à modifier

- [src/db/queries/users.ts](src/db/queries/users.ts) — ajouter `searchPublicProfiles` + type `PublicProfileSummary`
- [src/components/sidebar.tsx](src/components/sidebar.tsx) — nav item "Trouver des amis" + footer `@username`
- [src/app/layout.tsx](src/app/layout.tsx) — passer `username` + `isPublic` au Sidebar
- [src/app/dashboard/page.tsx](src/app/dashboard/page.tsx) — render `<OwnProfileCard>` après AppHeader
- [src/components/settings/profile-form.tsx](src/components/settings/profile-form.tsx) — link "Voir mon profil public →" sous le toggle
- [src/app/u/[username]/page.tsx](src/app/u/[username]/page.tsx) — banner "tu visites ton propre profil" si auth match

## Tests à écrire

Le projet n'a pas d'infra DB-integration tests (vitest est utilisé pour pure logic only). Pragmatique :

- **`src/db/queries/users.test.ts`** (nouveau) — tester uniquement le helper pur `escapeLikePattern` : input normal, input avec `%`, `_`, `\`. ~4 tests.
- **Pas de test sur `searchPublicProfiles`** — c'est de l'intégration DB, validée par smoke test manuel (curl + visit `/find` en browser).
- **Pas de test sur la server action** — Next server actions difficiles à isoler sans framework de test serveur ; validée par smoke test manuel.
- **Pas de tests UI** au MVP (cohérent avec le reste du projet — pas de Playwright/RTL en place).

Validation E2E couverte dans la section "Vérification end-to-end" ci-dessus.

## Hors-scope explicite (rappel)

- Algo de découverte taste-based → GH issue enhancement séparée
- Concept follow/friend
- Pagination (>20 résultats)
- Cache des résultats search
- API JSON publique
- Notifications
- Indexation full-text Postgres (FTS / trigram) — overkill au MVP
