# Album wall - fond du dashboard loopstat

> Statut : brainstorming validé · prêt pour writing-plans
> Date : 2026-05-15

## Contexte

L'app loopstat a déjà une identité visuelle posée : Inter sans, palette
violet profond (`#070710` + dégradé radial mauve), glass cards plats,
Instrument Serif italique sur les KPI, gradient cyan→magenta sur les CTA.

L'élément qui ne colle pas : **les cubes Three.js** ajoutés en arrière-plan
(`src/components/nebula-background.tsx`). L'utilisateur les a rejetés -
la géométrie cubique n'évoque rien de musical et le rendu 3D fight avec
le reste de l'app qui est résolument plat / éditorial.

Après exploration en mode brainstorming visuel (waveforms, ambiance
atmosphérique, options distinctives), l'utilisateur a choisi le **mur
d'albums "Wrapped vibe"** : grille des pochettes de ses top albums,
inclinée, traitée en luminosity blend avec un overlay cyan/magenta.

## Décisions verrouillées

| Décision | Valeur |
|---|---|
| Cubes Three.js | **supprimés** (composant, mount, dépendance `three`) |
| Nouveau visuel | mur d'albums sur `/dashboard` uniquement |
| Source des albums | `fetchTopTracks(userId, "1y")` → dédup par `album.id` |
| Cellules desktop (`≥ 768 px`) | 8 cols × 5 lignes = 40 |
| Cellules mobile | 4 cols × 6 lignes = 24 |
| Tilt | `scale(1.1) rotate(-3deg)` |
| Opacité du mur | 0.42 |
| Blend mode du mur | `luminosity` |
| Overlay teinte | gradient `135deg cyan→magenta`, 25 % opacity, blend `overlay` |
| Animation | aucune (statique) |
| Logged-out (`/`, `/login`) | aucun mur, juste le dégradé violet |
| Autres pages auth (`/top/*`, `/track/[id]`, …) | aucun mur non plus |
| Fallback (0 album, API ko, image cassée) | gradient procédural cyan→magenta sur la cellule |

## Architecture

### Composant `<AlbumWall />`

- Fichier nouveau : `src/components/album-wall.tsx`
- Server component pur (pas de `'use client'`, pas de hook, statique)
- Signature : `<AlbumWall covers={(string | null)[]} />` - array de 40
  (desktop) ou 24 (mobile, géré côté CSS / responsive grid) URLs de
  pochettes. `null` = cellule sans couverture → gradient procédural.
- Rendu :
  - `<div className="ls-album-wall">` positionné `fixed inset-0`
  - Enfant 1 : grille CSS avec 40 cells (les sans-cover sont des
    `<div>` avec un `background: linear-gradient(...)` calculé via
    l'index)
  - Enfant 2 : overlay teinte cyan/magenta en `mix-blend-mode: overlay`
- Toutes les pochettes utilisent `<img loading="lazy">` sans `onError`
  pour rester server component pur. Si une couverture rate (rare, le
  CDN Spotify est très stable), la cellule reste vide - acceptable
  pour un fond opacity 0.42 derrière le contenu. Pas de fallback
  dynamique, on accepte la dégradation gracieuse.

### Intégration dashboard

Dans `src/app/dashboard/page.tsx` :
1. Ajouter `fetchTopTracks(userId, "1y")` au `Promise.all` existant.
2. Dériver `albumCovers`: dédup les tracks par `track.album?.id`, mapper
   vers `track.album?.images?.[0]?.url ?? null`, slice à 40, pad à 40
   avec `null` si nécessaire.
3. Rendre `<AlbumWall covers={albumCovers} />` **en premier enfant**
   du `<main>` du dashboard (ou en sibling de `<main>`, avant le
   contenu). Position `fixed`, donc l'ordre DOM importe pour
   l'accessibility (le mur a `aria-hidden="true"`).

### Suppression des cubes

- Supprimer `src/components/nebula-background.tsx`
- Dans `src/app/layout.tsx` : retirer l'import + la balise
  `<NebulaBackground />`
- `pnpm remove three @types/three`
- Vérifier que `pnpm-lock.yaml` est cohérent

## Style CSS (à ajouter à `globals.css`)

```css
.ls-album-wall {
  position: fixed;
  inset: 0;
  z-index: -5;
  pointer-events: none;
  /* gated sur dark via le sélecteur :is(.dark *) déjà défini */
}

.ls-album-wall .grid {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(5, 1fr);
  gap: 2px;
  opacity: 0.42;
  mix-blend-mode: luminosity;
  transform: scale(1.1) rotate(-3deg);
  transform-origin: center;
}

@media (max-width: 767px) {
  .ls-album-wall .grid {
    grid-template-columns: repeat(4, 1fr);
    grid-template-rows: repeat(6, 1fr);
  }
  /* On rend toujours 40 cells côté composant (server-side, sans JS).
     En mobile on n'en affiche que 24 (les 16 restantes seraient
     redistribuées en lignes implicites compressées sinon). */
  .ls-album-wall .grid .cell:nth-child(n + 25) {
    display: none;
  }
}

.ls-album-wall .cell {
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
}

/* Cellules sans couverture : gradient procédural calculé via custom prop */
.ls-album-wall .cell.fallback {
  background: linear-gradient(
    var(--cell-angle, 135deg),
    var(--cell-c1, #5dd9ff),
    var(--cell-c2, #ff5dc8)
  );
}

.ls-album-wall .tint {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    rgba(93, 217, 255, 0.25),
    rgba(255, 93, 200, 0.25)
  );
  mix-blend-mode: overlay;
}

/* Light mode : pas de mur (caché par défaut), seulement en dark */
.ls-album-wall { display: none; }
.dark .ls-album-wall { display: block; }
```

## Helpers à réutiliser

- `fetchTopTracks(userId, period)` depuis
  `src/lib/spotify/top.ts` - déjà utilisé par `/dashboard` pour le top-5.
  On rajoute juste un appel avec `"1y"` dans le `Promise.all`.
- Pattern du `body::before` violet et du composant gated sur dark :
  s'inspirer de `src/components/nebula-background.tsx` (à supprimer
  juste après).
- `cn()` de `src/lib/utils.ts` pour composer les classes.

## Critical files

- **NEW** `src/components/album-wall.tsx`
- **MODIFIED** `src/app/dashboard/page.tsx` - ajout `fetchTopTracks 1y`
  dans `Promise.all`, derivation des covers, render `<AlbumWall />`
- **MODIFIED** `src/app/layout.tsx` - retrait `<NebulaBackground />`
- **MODIFIED** `src/app/globals.css` - ajout des classes `.ls-album-wall`
- **DELETED** `src/components/nebula-background.tsx`
- **MODIFIED** `package.json` + `pnpm-lock.yaml` - retrait `three`,
  `@types/three`

## Vérification end-to-end

1. **Build local**
   ```sh
   pnpm typecheck && pnpm lint && pnpm build
   ```
   Doit passer clean. `pnpm build` montrera une réduction d'environ
   150 kB sur le bundle (sortie de Three.js).

2. **Run local** `pnpm dev`, vérifier visuellement :

   | Page | Comportement attendu (dark) | Comportement attendu (light) |
   |---|---|---|
   | `/dashboard` (authentifié) | mur d'albums teinté cyan/magenta sous le contenu | pas de mur |
   | `/` (logged-out) | dégradé violet seul, calme | blanc minimaliste actuel |
   | `/login` | dégradé violet seul | blanc actuel |
   | `/top/tracks` | dégradé violet seul | blanc actuel |
   | `/track/[id]` | dégradé violet seul | blanc actuel |
   | `/dashboard` (compte sans tracks) | 40 gradients procéduraux | pas de mur |

3. **Reduced motion** : aucun changement vs ailleurs, le mur est
   statique donc rien à respecter au-delà de ce qui existe déjà
   (skeletons etc.).

4. **Responsive** : largeur navigateur < 768 px → grille passe à
   4×6 = 24 cells, cellules deviennent carrées plutôt que rectangulaires
   fines.

5. **Déploiement prod** (après approbation du plan d'implémentation) :
   ```sh
   rsync -az src/ public/ package.json pnpm-lock.yaml \
     root@204.168.178.52:/opt/loopstat/ --exclude node_modules --exclude .next
   ssh root@204.168.178.52 'cd /opt/loopstat && \
     docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build'
   ```
   Puis test sur `https://loopstat.tech/dashboard` en navigation privée.

## Hors-scope

- Animation du mur (drift, shuffle, fade) - décidé statique.
- Sur les pages autres que dashboard.
- Sur les pages logged-out (`/`, `/login`).
- Génération d'art procédural plus complexe pour les fallback (juste
  un gradient simple suffit).
- Variation par période (différent mur pour différent `period=`) - un
  seul mur figé sur 1y, suffisant pour la signature visuelle.
- Custom hooks ou wrappers React au-delà du strict nécessaire.
