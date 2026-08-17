# Refonte de la page `/album/[id]` - design spec

**Date** : 2026-05-17
**Auteur** : Jules + Claude (brainstorming session)
**Scope** : `src/app/album/[id]/page.tsx` + nouvelles queries `getAlbum*` dans `src/db/queries/stats.ts` + extraction de 2 composants partagés depuis `/track/[id]`

## Contexte et motivation

La page album actuelle ([src/app/album/[id]/page.tsx](../../../src/app/album/[id]/page.tsx))
est la plus pauvre des 3 pages "détail" du site :

| Page | Contenu actuel |
|---|---|
| `/track/[id]` | Hero + écoutes + first/last + period breakdown (4w/6m/1y/all) + sparkline mensuelle + heatmap heures + qualité (durée moy + skip rate) |
| `/artist/[id]` | Hero + top 10 titres de l'artiste |
| `/album/[id]` | Hero + total écoutes + tracklist **sans plays par track** |

L'album est un niveau d'analyse riche en soi (combien joues-tu chaque titre de cet
album, quand l'as-tu découvert, quel est ton "killer track"…) et ne devrait pas
être moins informatif qu'une page track. La refonte vise à en faire **la page la
plus riche du site**, en réutilisant les patterns établis sur `/track/[id]` et en
y ajoutant des sections album-spécifiques.

## Décisions de design

| Sujet | Décision | Alternative écartée |
|---|---|---|
| Niveau d'ambition | Au-delà de /track/[id] (toutes ses sections + album-specific) | Parité simple ; minimum viable (juste plays par track) |
| Hero | Sober, alignement /track/[id] actuel (cover gauche + stats droite) | Cover-driven blur ; editorial centré serif |
| Sections album-specific retenues | (1) tracklist avec barres de proportion, (2) top track highlight, (3) carousel autres albums de l'artiste | Completion rate (écarté) |
| Couleur d'accent | Lavande/violet par défaut (cohérent reste du site) | Extraction de couleur dominante depuis la cover (trop de tech pour ROI esthétique) |

## Spec visuelle

### Layout général

Narrative descendante : **qui → ton favori → comment tu le consommes → quand →
qualité → contexte artiste**.

```
┌──────────────────────────────────────────────┐
│  [cover 160]   Album · 2017 · 14 titres      │   ← 1. Hero sober
│                Ipséité                       │
│                Damso                         │
│                218 écoutes · 14h12 d'écoute  │
│                Première : 22 nov 2024 · …    │
├──────────────────────────────────────────────┤
│  Ton favori │ [cv]  N. J Respect R    68  │   ← 2. Top track card (highlight)
│             │       Damso             31% │
├──────────────────────────────────────────────┤
│  Tracklist                                   │   ← 3. Tracklist avec barres
│  1  William          ████████░░  39          │     (top track en exergue,
│  2  N. J Respect R   ███████████ 68 ★        │      lavande + fond pâle)
│  3  Mosaïque solit.  ███████░░░  26          │
│  4  Macarena         █████░░░░░  17          │
│  5  Smog             ░░░░░░░░░░   0          │
│  …                                           │
├──────────────────────────────────────────────┤
│  Évolution mensuelle                         │   ← 4. Sparkline réutilise
│  ───╱╲────╲────╱─╲──╱──                      │     <SparklineMonthly /> existant
│  Nov 2024 … Mai 2026                         │
├──────────────────────────────────────────────┤
│  Par période                                 │   ← 5. Grille 4 cards
│  [4 sem 12] [6 mois 47] [1 an 186] [All 218] │
├──────────────────────────────────────────────┤
│  Heure préférée                              │   ← 6. Heatmap 24h
│  ▁▁▁▁▂▃▅▆▇█▇▆▅▄▃▂▁                           │     (extraire de /track)
│  0 … 6 … 12 … 18 … 23                        │
├──────────────────────────────────────────────┤
│  Qualité d'écoute                            │   ← 7. Avg duration + skip rate
│  [Durée moy 3 m 52 s] [Skip 8 %]             │
├──────────────────────────────────────────────┤
│  Autres albums de Damso                      │   ← 8. Carousel horizontal
│  [QALF 189] [Lithopé 142] [Batt 88] [Salé]   │
└──────────────────────────────────────────────┘
```

### Hero (section 1)

Pattern identique à `/album/[id]` actuel + 2 ajouts :
- **Total heures d'écoute** à côté du compteur de plays (`14 h 12 m d'écoute`)
- **First / last played dates** sous le compteur (`Première : 22 nov 2024 · Dernière : il y a 3 jours`)

Format des dates : `"22 nov 2024"` pour fixe, `"il y a N jours"` pour relatif
récent (utilise `Intl.RelativeTimeFormat` ou helper existant si présent).

### Top track card (section 2)

Carte glass (`glassCard` util existant) avec :
- Label vertical "TON FAVORI" à gauche (rotation 180°, couleur lavande pâle `#c4b5fd`)
- Mini cover (56×56, rounded) du track
- Track name + artist names
- Plays + % du total album (ex : `68 écoutes · 31 %`)

Cacher la section si **0 plays sur l'album entier** OU si **un seul track de
l'album a été joué** OU si **l'album n'a qu'un seul track total** (single).
Évite l'absurde "ton favori = 0 plays" et la redondance avec la tracklist quand
le "favori" est l'unique ligne.

### Tracklist avec barres (section 3)

Une ligne par track de l'album (ordre Spotify `track_number`). Pour chaque ligne :
- Numéro de piste (right-aligned, tabulaire, gris)
- Nom du track (cliquable → `/track/${track.id}`)
- **Barre horizontale** : largeur = `plays / maxPlaysDansAlbum * 100%`
- Compteur de plays (right-aligned, tabulaire)

**Top track** (plays max de l'album, ex-aequo : on prend le premier par
`track_number`) : ligne mise en exergue avec :
- Fond `bg-[#7c3aed]/8`
- Texte en lavande `#c4b5fd`, weight 600
- Barre pleine 100% en lavande `#c4b5fd`
- Pas d'étoile (le fond + couleur suffisent comme signal visuel)

**Tracks sans play** : opacité 0.45 (le titre apparaît grisé, barre vide, compteur "0").

### Évolution mensuelle (section 4)

Réutilise `<SparklineMonthly />` ([src/components/stats/sparkline-monthly.tsx](../../../src/components/stats/sparkline-monthly.tsx))
avec le data shape `{ month: Date; plays: number }[]` produit par la nouvelle
`getAlbumMonthlyPlays`.

Si moins de 2 mois de données : ne pas afficher la section.

### Par période (section 5)

Grille de 4 cards (4w / 6m / 1y / all). Pattern identique à
[/track/[id] lignes 128-142](../../../src/app/track/[id]/page.tsx#L128-L142).

### Heure préférée (section 6)

Heatmap 24 barres verticales. **À extraire** dans un composant partagé
`<HourHeatmap data={...} />` (voir section "Refactor partagé" ci-dessous).

### Qualité d'écoute (section 7)

Grille 2 cards (avg duration + skip rate). Comportement identique à
[/track/[id] lignes 186-215](../../../src/app/track/[id]/page.tsx#L186-L215) :
si `avgMs === null && skipRate === null` → affiche "Donnée indisponible pour
cette source d'écoute".

### Autres albums de l'artiste (section 8)

Carousel horizontal (`overflow-x: auto`, `flex gap-3`). Chaque carte :
- Cover 80×80 rounded
- Nom de l'album (truncate 1 ligne)
- Plays (small gris)
- Lien vers `/album/${otherAlbumId}`

**Choix de l'artiste à utiliser** : le premier artiste de l'album courant (Spotify
liste `album.artists[]`, prendre `[0]`). Pour les compilations multi-artistes,
ce sera l'artiste "principal" affiché par Spotify.

**Limit** : 10 albums max, triés par plays desc. Exclure l'album courant.

Si l'artiste n'a aucun autre album dans l'historique → ne pas afficher la section.

## Composants à modifier / créer / extraire

### Modifier
- **[src/app/album/[id]/page.tsx](../../../src/app/album/[id]/page.tsx)** -
  refactor complet selon la spec ci-dessus.

### Créer (nouvelles queries SQL dans `src/db/queries/stats.ts`)

Toutes les nouvelles queries suivent les patterns existants (Drizzle + `QUALIFYING_PLAY`).

1. **`getAlbumTrackPlays(userId, albumId)`** → `{ trackId, name, trackNumber, plays }[]`
   - JOIN streams → tracks WHERE album_id = ? AND user_id = ? AND QUALIFYING_PLAY
   - GROUP BY track_id, name, track_number
   - ORDER BY track_number ASC (ordre album, pas plays - la barre dit déjà qui domine)
   - Inclut les tracks de l'album **avec 0 plays** : LEFT JOIN streams sur tracks WHERE album_id
   - Caller calcule maxPlays et top track côté React

2. **`getAlbumBreakdownByWindow(userId, albumId)`** → `Record<StreamPeriod, number>`
   - Pattern identique à [`getTrackBreakdownByWindow`](../../../src/db/queries/stats.ts#L433)
     mais avec `tracks.albumId = ?` au lieu de `streams.trackId = ?`

3. **`getAlbumMonthlyPlays(userId, albumId)`** → `{ month: Date; plays: number }[]`
   - Pattern identique à [`getTrackMonthlyPlays`](../../../src/db/queries/stats.ts#L472)
     avec JOIN tracks ON album_id

4. **`getAlbumListeningHours(userId, albumId)`** → `{ hour: number; count: number }[]`
   - Pattern identique à [`getTrackListeningHours`](../../../src/db/queries/stats.ts#L502)
     avec JOIN tracks ON album_id, retourne toujours 24 entrées (0-23)

5. **`getAlbumPlayQuality(userId, albumId)`** → `{ avgMs: number | null; skipRate: number | null }`
   - Pattern identique à [`getTrackPlayQuality`](../../../src/db/queries/stats.ts#L535)
     avec JOIN tracks ON album_id

6. **`getOtherAlbumsByArtist(userId, artistId, excludeAlbumId, limit = 10)`** → `{ albumId, name, imageUrl, plays }[]`
   - JOIN streams → tracks → albums → track_artists WHERE artist_id = ? AND album_id != ?
   - GROUP BY album_id, name, image_url
   - ORDER BY count(*) DESC, LIMIT ?
   - Premier artiste de l'album courant utilisé comme `artistId`

7. **`getAlbumPlayStats`** (existant) - **élargir** pour retourner aussi
   `firstPlayedAt`, `lastPlayedAt`, `totalMsPlayed` (somme).
   Nouveau retour : `{ count, firstPlayedAt: Date | null, lastPlayedAt: Date | null, totalMsPlayed: number }`.
   Seul caller : `src/app/album/[id]/page.tsx` (qu'on réécrit dans cette spec) -
   aucun autre fichier à mettre à jour. **Le top track est dérivé en JS** côté
   caller depuis le résultat de `getAlbumTrackPlays` (pas de query dédiée).

### Extraire (refactor partagé)

Deux composants visuels sont actuellement inline dans `/track/[id]` et seront
réutilisés sur `/album/[id]`. Les extraire pour mutualiser :

- **`src/components/stats/hour-heatmap.tsx`** - la heatmap 24h. Props :
  `{ data: { hour: number; count: number }[] }`. Inclut le grid 12/24 cols
  responsive et l'opacité dépendante de `intensity`.

- **`src/components/stats/period-breakdown-grid.tsx`** - la grille 4 cards
  4w/6m/1y/all. Props : `{ data: Record<StreamPeriod, number> }`. Utilise
  `STREAM_PERIODS` existant.

Refactor /track/[id] pour utiliser ces deux composants (changement purement
mécanique, pas de risque).

### Décisions d'implémentation

- **Toutes les queries en parallèle** : `Promise.all([...])` dans le RSC, comme
  /track le fait déjà.
- **Helpers de format** : réutiliser `formatNumber`, `formatMs` (existants).
  Pour les dates, /track/[id] définit déjà une fonction inline `formatDate(date: Date)`
  utilisant `toLocaleDateString("fr-FR")`. À **extraire** dans `src/lib/format/date.ts`
  pour partage. Ajouter aussi `formatRelativeDate(date: Date): string` qui retourne
  "il y a N jours" si moins de 30 jours, sinon délègue à `formatDate`. Utilise
  `Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" })`.
- **`revalidate = 3600`** maintenu (la cover/metadata Spotify est stable).

## Stratégie de test

- **Tests unitaires** sur les 7 nouvelles queries SQL (vitest, db locale, fixtures
  user + streams + tracks + albums + artists). Pattern : suivre les tests
  existants pour `getTopTracksFromStreams` (si présents dans `stats.test.ts`).
- **Vérification visuelle manuelle** (UI sans infra de test React) :
  - Album avec 0 play (état edge - sections optionnelles doivent disparaître)
  - Album avec 1 play (top track caché)
  - Album peu écouté (sparkline absente)
  - Album très écouté (toutes sections visibles)
  - Album d'un artiste solo (carousel "autres albums" non vide attendu)
  - Album compilation multi-artistes (vérifier que carousel utilise bien le 1er artiste)
- **Build + type-check** (`pnpm build`, `pnpm tsc --noEmit`).
- **Non-régression /track/[id]** : la page utilise maintenant les 2 composants
  extraits, vérifier visuellement qu'elle est identique à avant.

## Hors-scope explicite

- Extraction de couleur dominante depuis la cover (cool mais lourd : besoin d'une
  lib type `node-vibrant`, du caching, edge cases sur les covers Spotify)
- Comparaison "comment cet album se classe vs tes autres albums" (méta-stat,
  pourrait venir plus tard)
- Listening curve par heure de la JOURNÉE × jour de la SEMAINE (heatmap 2D -
  trop de scope, /track/[id] ne l'a pas non plus)
- Recommandations "albums similaires" depuis Spotify API (~3-5 albums type
  similar artists - sortie de scope, non-trivial)
- Boutons d'action ("play on Spotify", "share") - sortie de scope
- Refonte de `/artist/[id]` (pourrait suivre dans une autre passe avec carousel
  d'albums, etc.)
- Refonte de `/top/albums` (séparée - pas de bug confirmé là-bas)
