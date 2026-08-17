# Onboarding JSON-first avec mode démo - design spec

**Date** : 2026-05-19
**Auteur** : Jules + Claude (brainstorming session)
**Sous-projet** : B (Onboarding) - deuxième d'une série de 5 sous-projets pour le pivot complet "drop Spotify Web API". Dépend de sub-projet A (auth Google) terminé fonctionnellement.

## Contexte et motivation

Suite au pivot stratégique : nouveau modèle commercial nécessite que l'upload du JSON Spotify Extended Streaming History soit la **valeur immédiate** de l'app, pas une étape cachée derrière un import.

Aujourd'hui : après login, l'user atterrit sur `/dashboard` vide avec un bandeau "importe ton historique" qu'il faut chercher (lien sidebar). Beaucoup de drop-off à ce stade.

Décision : présenter un **dashboard de démo** (données fictives) immédiatement après l'auth, avec une **modal de bienvenue** qui explique + un CTA persistant invitant l'import. L'user comprend instantanément la valeur avant la friction d'upload.

L'utilisateur existant (Jules, 153k streams importés) bypasse intégralement ce flow puisque `hasCompletedImport` est true.

## Scope de ce sous-projet (B)

**Inclus** :
- Module de fixtures `src/lib/demo/data.ts`
- Composants `<WelcomeModal />` (1 fois au premier load) + `<DemoModeBanner />` (sticky persistant)
- Refactor des 5 pages stats (`/dashboard`, `/top/tracks`, `/top/artists`, `/top/albums`, `/listening-clock`) pour rendre fixtures en mode démo
- Adaptation cosmétique de `/import` (sous-titre engageant via query param `?from=welcome`)

**Exclus** (autres sous-projets) :
- C : MusicBrainz catalog (worker enrich)
- D : Cleanup Spotify-dependent features (now-playing, poll-recent)
- E : Drop `users.spotify_id` column
- Pages détail (`/album/[id]`, `/artist/[id]`, `/track/[id]`) : pas de mode démo (besoin de Spotify IDs valides, hors-scope)

## Décisions de design

| Sujet | Décision | Alternative écartée |
|---|---|---|
| Données démo | Top tracks Spotify global 2024 (~50 tracks hardcodés) | Profil persona fan de rap français ; échantillon anonymisé de Jules |
| Périmètre pages démo | 5 pages stats (dashboard + 3 top + listening-clock) | Dashboard seul ; toutes les pages avec redirect bloquant |
| UX CTA | Modal de bienvenue + sticky banner (skip non bloquant) | Banner seul ; modal bloquant ; hero card sans modal |
| Renommage `/import` URL | Garde `/import` (juste copy adapté) | Rename `/onboarding` (casse les liens existants) |
| Tracks demo cliquables | **Non** - visuellement non cliquables + tooltip "Importe pour explorer" | Lien désactivé silencieux ; redirect /import |
| Persistance "skip modal" | localStorage flag cross-tab | Cookie ; DB column |

## Spec visuelle

### `<WelcomeModal />`

Affichage : auto au 1er chargement de `/dashboard` quand `hasCompletedImport=false` ET `localStorage.getItem("loopstat-welcome-shown") !== "true"`. Une fois shown, set le flag.

Contenu :

```
[Centered modal, max-w-lg, dark backdrop]

  Bienvenue sur loopstat 👋

  Cette démo te montre à quoi ressemble loopstat avec
  des données fictives. Importe ton historique Spotify
  pour voir TES vraies stats - tops, listening clock,
  partage de profils, et plus.

  [Skip et explorer la démo]  [Importer maintenant →]
                                 (CTA primaire)
```

Click sur "Skip" → ferme modal, set localStorage flag, mode démo continue.
Click sur "Importer maintenant" → redirect `/import?from=welcome`.

Pas de close button (X) - choix conscient pour forcer la décision explicite Skip/Import. Esc ferme = équivalent Skip.

### `<DemoModeBanner />`

Sticky top, sur les 5 pages stats quand `hasCompletedImport=false`. Z-index au-dessus du contenu, sous le header global de l'app.

```
[Sticky bar, full width, fond accent violet pâle, padding 12px]

  👋 Données fictives - Importe ton historique pour voir TES stats →
                                                         (lien)
```

Click sur le lien → `/import?from=welcome`. Bar reste visible tant que l'user n'a pas importé.

### Fixtures `src/lib/demo/data.ts`

Shape exacte conforme aux types existants utilisés par les pages stats :

Les queries dans `src/db/queries/stats.ts` ne nomment pas leurs types de retour (types inline). Les fixtures utilisent des types inline équivalents pour matcher les signatures :

```ts
// Top 50 tracks Spotify global 2024 (curaté manuellement depuis Spotify
// Wrapped 2024 + observations BillboardGlobal). Tracks avec plays plausibles
// décroissants (ex : #1 = 1247 plays, #50 = 89 plays).
export const DEMO_TOP_TRACKS: {
  trackId: string;
  name: string;
  albumImageUrl: string | null;
  artistNames: string[];
  plays: number;
}[] = [
  {
    trackId: "demo:espresso",
    name: "Espresso",
    artistNames: ["Sabrina Carpenter"],
    albumImageUrl: null,        // placeholder bg-muted dans le UI
    plays: 1247,
  },
  // ... 49 autres entries
];

export const DEMO_TOP_ARTISTS: {
  artistId: string;
  name: string;
  imageUrl: string | null;
  plays: number;
}[] = [
  // ~30 entries dérivés des tracks (Sabrina Carpenter, Taylor Swift,
  // Billie Eilish, etc.)
];

export const DEMO_TOP_ALBUMS: {
  albumId: string;
  name: string;
  imageUrl: string | null;
  artistNames: string[];
  plays: number;
}[] = [
  // ~30 entries dérivés des tracks
];

// 24 entrées (hour 0-23), pattern plausible (creux nuit, peak 18-22h)
export const DEMO_LISTENING_HOURS: { hour: number; count: number }[] = [
  { hour: 0, count: 12 },
  { hour: 1, count: 5 },
  // ...
  { hour: 18, count: 156 },
  { hour: 22, count: 198 },
  // ...
];

export const DEMO_TOTAL_PLAYS = 12_847;
export const DEMO_TOTAL_HOURS_LISTENED = 423;
```

Les `trackId`/`artistId`/`albumId` commencent par `demo:` (préfixe non-Spotify) → permet aux pages détail de détecter "c'est une fixture, redirect" si jamais on les clique (mais l'UI les rend non-cliquables visuellement).

### Pages refactorées

Pattern unique appliqué aux 5 pages stats (RSC) :

```tsx
// Pseudo-code générique
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const hasImport = await hasCompletedImport(userId);

  if (!hasImport) {
    // MODE DÉMO
    return (
      <>
        <DemoModeBanner />
        <WelcomeModal />  {/* sur /dashboard uniquement */}
        <DashboardLayout
          topTracks={DEMO_TOP_TRACKS.slice(0, 10)}
          topArtists={DEMO_TOP_ARTISTS.slice(0, 10)}
          listeningHours={DEMO_LISTENING_HOURS}
          totalPlays={DEMO_TOTAL_PLAYS}
          totalHours={DEMO_TOTAL_HOURS_LISTENED}
          demoMode={true}
        />
      </>
    );
  }

  // Mode réel (inchangé)
  const [topTracks, topArtists, hours, totals] = await Promise.all([...]);
  return <DashboardLayout topTracks={topTracks} ... demoMode={false} />;
}
```

Le flag `demoMode={true}` propage aux composants enfants qui désactivent les `<Link>` (rendent juste un `<span>` à la place) ou affichent tooltip "Importe pour explorer".

### Tracks/artists/albums non cliquables en mode démo

Composant `<RankedRow>` actuel accepte une prop `href`. En mode démo, on omet `href` :

```tsx
{demoMode ? (
  <RankedRow title={track.name} subtitle={track.artistNames.join(", ")} />
) : (
  <RankedRow href={`/track/${track.trackId}`} title={track.name} ... />
)}
```

Sans `href`, RankedRow rend en `<div>` statique, pas en `<Link>` (vérifié dans `src/components/stats/ranked-list.tsx` : la fonction check `if (href) return <Link>... else <div>`). Hover style désactivé via le même check (`href && "transition hover:bg-accent"`).

### Adaptation cosmétique `/import`

Lit `searchParams?.from === "welcome"`. Si oui, sous-titre devient :
> "Plus que quelques minutes avant de voir tes vraies stats."

Sinon, garde le sous-titre actuel.

## Composants à modifier / créer

### Créer

- `src/lib/demo/data.ts` - fixtures (track/artist/album/hours)
- `src/components/onboarding/welcome-modal.tsx` - Client Component, gère localStorage flag
- `src/components/onboarding/demo-mode-banner.tsx` - sticky banner Link vers `/import?from=welcome`
- `src/components/onboarding/use-welcome-modal.ts` - hook `useWelcomeModalState()` (lit + set localStorage)

### Modifier (5 pages stats)

- `src/app/dashboard/page.tsx` - branchement demo + WelcomeModal
- `src/app/top/tracks/page.tsx`, `top/artists/page.tsx`, `top/albums/page.tsx` - branchement demo + DemoModeBanner
- `src/app/listening-clock/page.tsx` - branchement demo + DemoModeBanner

### Modifier (route /import)

- `src/app/import/page.tsx` - lit `searchParams.from`, adapte sous-titre

## Stratégie de test

### Tests unitaires

- `src/components/onboarding/welcome-modal.test.tsx` - non écrit (pas d'infra RTL/jsdom dans le repo). Skip.
- `src/lib/demo/data.test.ts` - assertions de structure : DEMO_TOP_TRACKS a 50 entries, plays décroissants, etc. **Si quelqu'un modifie les fixtures, casse pas la shape.**

### Vérification manuelle

Test scénarios (en wiping artificiellement l'import de Jules pour simuler new user) :

1. **Premier login** : modal de bienvenue auto-affichée
2. **Skip** : modal ferme, banner sticky visible sur dashboard, données fictives affichées
3. **Refresh dashboard** : modal NE s'affiche PAS (localStorage flag honored)
4. **Navigate /top/tracks** : banner visible, top 50 fixtures affichées, lignes non cliquables
5. **Navigate /listening-clock** : banner visible, distribution heures plausible
6. **Click sur banner CTA** → arrive sur `/import?from=welcome` avec sous-titre engageant
7. **Upload réussi** : redirect `/dashboard`, banner disparu, vraies données affichées
8. **Retour banner** : ne réapparaît pas après import

Test cleanup :
- Pour re-tester : reset `localStorage.removeItem("loopstat-welcome-shown")` ou nouveau navigateur incognito

### Non-régression

- `pnpm tsc --noEmit` clean
- `pnpm vitest run` all green (85 baseline + 1-2 nouveaux tests de fixtures = ~87)
- Mode réel : Jules avec ses 153k streams ne voit AUCUN changement visuel (pas de banner, pas de modal, données réelles)

## Hors-scope explicite

- Rename `/import` → `/onboarding` (URL change cassante)
- Demo mode pour `/album/[id]` / `/artist/[id]` / `/track/[id]`
- A/B testing du copy (one-shot pour MVP)
- Animation transitions (juste fade-in basic via Tailwind)
- Persistance cross-device du "skip" (localStorage = per-browser)
- Profile public démo (`/u/demo`) - c'était une autre discussion antérieure, hors scope ici
- Skeleton loading sur le banner/modal (pas critique, ce sont des composants statiques)
- Personnalisation de la demo (ex. "Mode démo rap" vs "Mode démo pop") - single fixture pour MVP
