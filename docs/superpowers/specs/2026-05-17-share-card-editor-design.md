# Share Card Editor — Design Spec

**Date** : 2026-05-17
**Auteur** : Jules (brainstorming avec Claude)
**Branche d'implémentation cible** : `feat/phase-a-viral` (continuation)

## Context

Phase A "viral first" est en cours sur la branche `feat/phase-a-viral`. À ce stade on a :

1. Profils publics opt-in (`/u/[username]`)
2. Carte OG automatique générée via `next/og` (file convention `opengraph-image.tsx`)
3. `ShareButton` dropdown sur dashboard + `/top/*` qui propose : copier lien, télécharger l'image OG fixe, native share (mobile)

Limite actuelle : la carte OG est **non customisable** par l'utilisateur. Toujours top 3 titres, format fixe 1200×630, période 4 semaines. Pour augmenter la viralité, l'utilisateur doit pouvoir **prévisualiser et configurer** ce qu'il partage avant de télécharger — choisir la catégorie (titres / artistes / albums), le nombre d'items, la période, le format (Twitter / Insta Post / Insta Story), et un background.

Ce spec décrit l'éditeur de carte téléchargeable à shipper en MVP.

## Périmètre

### Dans le MVP

- Nouvelle page `/share` avec preview live + contrôles.
- Nouvelle route API `/api/share-card` qui génère le PNG selon les query params (réutilise `next/og` + Satori, helpers stats existants).
- `ShareButton` existant gagne une 4e option "Personnaliser ma carte…" qui navigue vers `/share` avec une config pré-remplie selon la page courante.
- 2 modes (focus / recap), 3 formats, 4 périodes, 2 backgrounds. Matrice détaillée en Section 2.
- L'URL `/share?…` reflète la config (deep-linkable). Chaque changement met à jour l'URL via `history.replaceState`.

### Hors MVP — issues GitHub à ouvrir

- **OG image custom** : faire que les choix de l'utilisateur deviennent l'OG image officielle de `/u/<username>` (link preview personnalisé). Demande de persister la config en DB (table `user_share_config` ou `users.profile_settings.shareCard`). Tracking : issue à créer après merge du MVP.
- Personnalisation polices / couleurs accent.
- Upload background custom (image perso).
- Stats narratives ("X heures écoutées en 2026", "X tracks uniques").
- Suppression du watermark (réservée Premium quand le freemium arrive en Phase C).
- Format "Long vertical" pour top 50.

### Décisions verrouillées

- **L'OG image actuelle** (`src/app/u/[username]/opengraph-image.tsx`) **reste inchangée** par cette feature. Elle continue de générer la carte par défaut (top 3 tracks, 4 semaines, 1200×630, mesh sombre fixe) pour les link previews. L'éditeur ne sert qu'au téléchargement perso.
- **Watermark `loopstat.tech/u/<username>` toujours présent** sur toutes les cartes générées. C'est ce qui ramène du trafic, on ne le rend pas configurable au MVP.
- **Pas de persistance** des choix utilisateur en DB au MVP : l'URL est la seule source de vérité (deep-link friendly, partageable, mais l'utilisateur doit refaire son choix à chaque visite). La persistance arrive avec l'issue "OG custom".

## Vocabulaire

- **Mode** : `focus` (1 catégorie) ou `recap` (top X tracks + top Y artists + top Z albums sur une seule carte).
- **Type** (mode focus uniquement) : `tracks` | `artists` | `albums`.
- **N** : nombre d'items, contraint par le format (voir Section 2).
- **Période** : `4w` | `6m` | `1y` | `all` (réutilise `StreamPeriod` de [src/lib/stats/period.ts](src/lib/stats/period.ts)).
- **Format** : `twitter` (1200×630) | `post` (1080×1080) | `story` (1080×1920).
- **Background** : `mesh` (gradient violet/cyan/magenta) | `wall` (mur de pochettes de l'utilisateur, écho du dashboard).

## Section 2 — Matrice formats × N × contraintes

| Format | Dimensions | Mode `focus` : N possibles | Mode `recap` : top × 3 cats |
|---|---|---|---|
| `twitter` | 1200×630 | 3, 5 | 3 + 3 + 3 |
| `post` | 1080×1080 | 3, 5, 7 | 3 + 3 + 3 |
| `story` | 1080×1920 | 3, 5, 7, 10 | 5 + 5 + 5 |

**Comportement UI** : si l'utilisateur sélectionne une combo invalide (ex: format `twitter` puis N=10), le contrôle N affiche les valeurs invalides en `disabled` plutôt que de planter la preview. À l'inverse, changer de format vers un plus petit ramène N à la valeur max autorisée pour ce format.

**Mode recap** : le paramètre `type` est ignoré (la carte affiche les 3 catégories). Le contrôle "Catégorie" est masqué quand `mode=recap`. Le paramètre `n` est aussi ignoré — chaque catégorie utilise sa valeur fixée (3 pour twitter/post, 5 pour story).

**Période par défaut** : `4w` (cohérent avec l'OG image automatique actuelle).

## Section 3 — Architecture

### 3.1 Route API : `src/app/api/share-card/route.tsx`

```
GET /api/share-card?username=<u>&mode=<m>&type=<t>&n=<n>&period=<p>&format=<f>&bg=<b>
```

Responsabilités :

1. Parse + valide les query params via Zod (helper `parseShareCardParams` qui applique les defaults).
2. Lookup user via `getPublicProfileByUsername(username)`. Retourne 404 si pas trouvé OU `is_public=false`.
3. Selon `mode` :
   - `focus` : fetch `getTopTracksFromStreams` / `getTopArtistsFromStreams` / `getTopAlbumsFromStreams` selon `type`, avec `since=periodSince(period)` et `limit=n`.
   - `recap` : fetch les 3 catégories en parallèle (Promise.all), `limit=3` pour twitter/post, `limit=5` pour story.
4. Pour `bg=wall` : fetch les 24 premières pochettes uniques sur la période (réutilise la logique du dashboard `album-wall.tsx`).
5. Génère le PNG via `next/og`'s `ImageResponse` en switchant sur `format` (template dédié par format : `templates/twitter.tsx`, `templates/post.tsx`, `templates/story.tsx`).
6. Retourne avec `Cache-Control: public, max-age=60, s-maxage=60` — preview se rafraîchit vite mais évite de regénérer à chaque keystroke.
7. Sur erreur de validation : 400 avec JSON `{ error: "..." }`. Sur erreur Satori : 500 + log côté serveur (déjà mordu par "failed to pipe response" — précaution).

**Rappel piège Satori** : tous les `<div>` doivent avoir `display: "flex"` même s'ils ne contiennent que du texte. À factoriser dans un helper `<Stack>` si la duplication devient pénible.

### 3.2 Page éditeur : `src/app/share/page.tsx`

```
GET /share?mode=<m>&type=<t>&n=<n>&period=<p>&format=<f>&bg=<b>&context=<c>
```

Server component :

1. `auth()` → redirect `/login` si pas auth.
2. `getProfile(userId)` → redirect `/settings` si pas de `username` ou `is_public=false`, avec un toast en query (`?from=share`) sur settings pour expliquer.
3. Parse query params avec `parseShareCardParams` (defaults + validation tolérante, jamais throw — fallback sur defaults).
4. Si `context` présent (vient du ShareButton), mappe au preset (cf. 3.4).
5. Rend `<ShareEditor initialConfig={config} username={profile.username} />` (client component).

### 3.3 Client : `src/components/share/share-editor.tsx`

Layout (cf. Section 4 mockup) :

- **Preview** : `<img src="/api/share-card?…" />` qui re-fetch dès que la config change. Pas de skeleton de chargement — la dernière image valide reste affichée le temps de la nouvelle.
- **Contrôles** : mode (segmented), catégorie (segmented, hidden si recap), N (chips, disabled si pas valide pour le format courant), période (chips), format (segmented), background (2 thumbs).
- **Actions** :
  - "Télécharger PNG" : `<a href="/api/share-card?…" download="loopstat-<username>-<format>.png">` (pas de JS, navigateur télécharge directement).
  - "Partager (mobile)" : visible seulement si `navigator.share` dispo, utilise `navigator.share({ files: [pngBlob] })` quand possible, fallback `{ url }`.
  - "Copier le lien de l'éditeur" : copy `window.location.href` (permet de re-ouvrir la même config plus tard).

**Synchro URL** : chaque changement → `window.history.replaceState(null, "", "?...")` avec la nouvelle querystring. Pas de full navigation (pas de loader). Pattern : un hook `useShareConfig()` qui gère la state locale + push URL.

### 3.4 Helpers : `src/lib/share/card-config.ts`

```ts
export const SHARE_CARD_DEFAULTS = {
  mode: "focus",
  type: "tracks",
  n: 5,
  period: "4w",
  format: "story",
  bg: "mesh",
} as const;

export const FORMAT_N_OPTIONS: Record<ShareFormat, number[]> = {
  twitter: [3, 5],
  post: [3, 5, 7],
  story: [3, 5, 7, 10],
};

export const CONTEXT_PRESETS: Record<string, Partial<ShareCardConfig>> = {
  dashboard: { mode: "recap", format: "story" },
  tracks: { mode: "focus", type: "tracks", format: "story" },
  artists: { mode: "focus", type: "artists", format: "story" },
  albums: { mode: "focus", type: "albums", format: "story" },
};

export function parseShareCardParams(sp: URLSearchParams | Record<string, string | string[] | undefined>): ShareCardConfig;
export function buildShareCardUrl(cfg: ShareCardConfig, username: string): string;
export function validForFormat(format: ShareFormat, n: number): boolean;
```

Schema Zod côté lib pour permettre validation côté server (route API) ET client (hook). Tests unitaires : defaults, presets, parse robuste sur inputs malformés, validation matrice formats.

### 3.5 Modif `ShareButton` existant

[src/components/share-button.tsx](src/components/share-button.tsx) gagne en première position du menu :

```
[ ✨ Personnaliser ma carte… ]
─────────────────────────────
  📋 Copier le lien
  ⬇  Télécharger l'image (OG fixe)
  📤 Partager via mon appareil
```

Le "Personnaliser…" navigue vers `/share?context=<page>` où `<page>` est passé en prop par la page parente (`context="dashboard"` etc.). Les 3 actions rapides existantes restent pour les users pressés.

## Section 4 — Layout éditeur

Cf. mockup `share-layout.html` validé en brainstorming :

- Grille 2 colonnes sur desktop (`1fr 340px`) : preview centrée à gauche dans une zone à damier subtil, contrôles compacts à droite.
- Stack vertical sur mobile (`md:`) : preview en haut, contrôles dessous, actions sticky en bas.
- Preview taille adaptative au format (story = haute, twitter = large, post = carré). On garde une `max-width/height` de ~480px pour ne pas avoir un PNG géant à l'écran.
- Background du `preview-pane` : `linear-gradient + repeating-linear-gradient` léger pour distinguer la zone "canvas" de la page.
- Boutons d'action : primary violet (`#7c3aed`) pour Télécharger, secondary subtle pour les autres.

## Files à créer

- `src/app/share/page.tsx` (server component)
- `src/app/api/share-card/route.tsx` (route handler + ImageResponse)
- `src/app/api/share-card/templates/twitter.tsx` (JSX template 1200×630)
- `src/app/api/share-card/templates/post.tsx` (JSX template 1080×1080)
- `src/app/api/share-card/templates/story.tsx` (JSX template 1080×1920)
- `src/app/api/share-card/templates/shared.tsx` (helpers communs : `<Stack>`, `<Watermark>`, palette BG)
- `src/components/share/share-editor.tsx` (client component)
- `src/components/share/preview.tsx` (juste un `<img>` qui re-fetch, factorisable)
- `src/lib/share/card-config.ts` (schema Zod + defaults + matrice + helpers)
- `src/lib/share/card-config.test.ts` (tests Zod + matrice + parse robuste)
- `src/db/queries/wall-covers.ts` (réutilise la logique d'`album-wall.tsx`, extractée si pertinent ; sinon inline dans la route)

## Files à modifier

- [src/components/share-button.tsx](src/components/share-button.tsx) — ajouter l'option "Personnaliser…" en première position, accepter prop `context?: "dashboard" | "tracks" | "artists" | "albums"`.
- [src/components/app-header.tsx](src/components/app-header.tsx) — propager `shareContext` au ShareButton.
- [src/app/dashboard/page.tsx](src/app/dashboard/page.tsx) — passer `shareContext="dashboard"` au AppHeader.
- [src/app/top/tracks/page.tsx](src/app/top/tracks/page.tsx), [/top/artists/page.tsx](src/app/top/artists/page.tsx), [/top/albums/page.tsx](src/app/top/albums/page.tsx) — passer `context="<type>"` au `<ShareButton>` direct.
- Sidebar : pas d'item nav pour `/share` (atteint uniquement via ShareButton).

## Verification end-to-end

1. **Tests unitaires** (`pnpm test`) : `parseShareCardParams` survives URLs malformées, `validForFormat` matrice cohérente avec Section 2.
2. **Curl direct** sur l'API :
   ```
   curl -o /tmp/c1.png "http://127.0.0.1:3000/api/share-card?username=judescha&mode=focus&type=tracks&n=10&period=4w&format=story&bg=mesh"
   file /tmp/c1.png   # → PNG 1080x1920
   ```
   Itérer pour les 3 formats × 2 modes × 4 périodes × 2 bg (échantillon manuel suffisant).
3. **Page éditeur** :
   - `/share` sans params → defaults appliqués, preview affichée.
   - Changer un contrôle → URL maj sans full reload, preview se rafraîchit.
   - Cliquer "Télécharger" → fichier `loopstat-judescha-story.png` téléchargé.
   - Sur mobile (DevTools), "Partager" déclenche le menu OS via `navigator.share`.
4. **Flow complet depuis le dashboard** :
   - Connecté + profil public actif → `/dashboard` → click "Partager" → click "Personnaliser…" → arrive sur `/share?context=dashboard` avec preset recap+story.
5. **Garde-fous d'auth** : `/share` non auth → redirige `/login`. Auth mais profil pas public → redirige `/settings?from=share`.
6. **404 carte** : `/api/share-card?username=doesnotexist&...` → 404.

## Métriques de succès (subjectif au MVP)

- Génération PNG sous 800ms par défaut (4w, story, mesh, focus tracks N=5).
- Preview re-fetch < 1s perceptible par l'utilisateur.
- Aucune combo de paramètres valide qui crash Satori en local sur 50 navigations test.

## Hors-scope explicite (rappel)

Ce qui n'est PAS dans cette feature et qui sera traité plus tard :

- Persistance config user (issue à créer : "OG image custom configurable par l'utilisateur").
- Customisation polices/couleurs.
- Upload background.
- Stats narratives.
- Watermark configurable.
- Format Long vertical.
- Analytics (Plausible) sur les events `share_card_download`, `share_card_native_share`, `share_editor_visit` — sera ajouté avec l'étape Plausible self-host, à scoper dans son propre spec.
