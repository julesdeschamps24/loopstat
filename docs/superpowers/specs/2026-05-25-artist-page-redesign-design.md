# Refonte de /artist/[id] — page artiste enrichie

> Date : 2026-05-25
> Statut : design validé, plan à écrire

## Contexte

La page `/artist/[id]` actuelle est minimale (145 lignes) : hero compact (avatar + nom + nombre d'écoutes) + une seule section "top tracks". Très en-dessous de la richesse de `/album/[id]` (410 lignes, 8 sections). L'utilisateur veut quelque chose d'attractif, dans l'esprit "page de magazine" plutôt que purement analytique.

## Objectifs

- Riche en data viz et stats personnalisées sans dupliquer ce qui est sur /album.
- Hero distinctif "editorial split" avec un gros chiffre proéminent (% du temps d'écoute).
- Navigation transversale : top tracks → /track, top albums → /album, related → /artist.
- Cohérence visuelle : réutilise au max les composants existants + design system nébuleuse violet.

## Non-objectifs

- Pas de sections "Par période", "Heure préférée", "Qualité d'écoute" — déjà sur /album, on évite la redondance.
- Pas de page admin / discographie complète externe — on reste sur les écoutes du user.
- Pas d'animations complexes (juste hover bg sur related artists).

## Layout global

`max-w-3xl` (768px), 5 sections empilées en stack vertical, gap 6-8 entre sections.

**Ordre des sections** :

1. **Hero editorial split** — full width
2. **Top tracks** — RankedList, limite 20 (bumpé depuis 10)
3. **Top albums de l'artiste** — carousel horizontal (`<OtherArtistAlbums>`)
4. **Évolution mensuelle** — sparkline 18 mois (`<SparklineMonthly>`)
5. **Artistes connexes** — grid 2/5 cols (`<RelatedArtists>` nouveau)

Rationale : proximité (top tracks immédiat) → exploration (albums) → trends (sparkline) → discovery (related).

## Hero design — "editorial split"

Grid 3 colonnes : `144px | 1fr | auto`, padding 24px, background `rgba(124,58,237,0.06)`, border `1px solid rgba(124,58,237,0.2)`, border-radius 20px.

**Colonne gauche** :
- `<ArtistAvatar size={144} name={artist.name} imageUrl={artist.imageUrl} />`

**Colonne centre** :
- Label uppercase `"Artiste"` (10px, letter-spacing 1.5px, color #a89ec8)
- Nom en serif italique 32px (`font-display italic`, color #f4f0ff)
- Meta texte 13px, 2 lignes :
  - `Découvert <strong>{formatRelativeDate(firstPlayedAt)}</strong>`
  - `Dernière écoute <strong>{formatRelativeDate(lastPlayedAt)}</strong>`

**Colonne droite — le big number** :
- `Math.round(count / totalPlays × 100)` (ou `"< 1"` si < 0.5%)
- Affiché en serif italique 64px, gradient text `linear-gradient(135deg, #c4b5fd, #ec4899)` (Webkit background-clip text)
- Label uppercase sous le chiffre : `"de ton temps"`

## Data flow

### Queries existantes réutilisées

- `getArtistPlayStats(userId, id)` → `{ count, firstPlayedAt, lastPlayedAt }`
- `getUserTopTracksByArtist(userId, id, 20)` (limite bumpée)
- `getListeningTotals(userId, "all")` → `{ count }` pour le %

### Queries nouvelles dans [src/db/queries/stats.ts](src/db/queries/stats.ts)

```ts
/**
 * Top albums of `artistId` ordered by the user's play count. Mirror of
 * getUserTopTracksByArtist at album granularity.
 */
export async function getUserTopAlbumsByArtist(
  userId: string,
  artistId: string,
  limit: number,
): Promise<{ albumId: string; name: string; imageUrl: string | null; playCount: number }[]>;

/**
 * Plays per month for `userId × artistId` over the last 18 months.
 * Mirror of getTrackMonthlyPlays at the artist granularity.
 */
export async function getArtistMonthlyPlays(
  userId: string,
  artistId: string,
): Promise<{ month: Date; plays: number }[]>;

/**
 * Top N artists that the user listens to within ±30 min of plays from
 * `artistId`. Self-join on streams.played_at within a 30-min window where
 * one side is the focal artist and the other side is any other.
 */
export async function getCoListenedArtists(
  userId: string,
  artistId: string,
  limit: number,
): Promise<{
  artistId: string;
  name: string;
  imageUrl: string | null;
  coCount: number;
}[]>;
```

### SQL pour `getCoListenedArtists`

```sql
WITH focal AS (
  SELECT s.played_at
  FROM streams s
  JOIN track_artists ta ON ta.track_id = s.track_id
  WHERE s.user_id = $1 AND ta.artist_id = $2
)
SELECT
  a.id, a.name, a.image_url,
  count(*)::int AS co_count
FROM focal
JOIN streams s2 ON s2.user_id = $1
  AND s2.played_at BETWEEN focal.played_at - INTERVAL '30 min'
                       AND focal.played_at + INTERVAL '30 min'
JOIN track_artists ta2 ON ta2.track_id = s2.track_id
JOIN artists a ON a.id = ta2.artist_id
WHERE a.id != $2
GROUP BY a.id, a.name, a.image_url
ORDER BY co_count DESC
LIMIT $3;
```

Index nécessaire : `streams_user_played_at_idx` existe déjà (user_id, played_at). OK.

### Page handler

Toutes les queries lancées en parallèle via `Promise.all` :

```ts
const [stats, topTracks, topAlbums, monthly, related, totals] = await Promise.all([
  getArtistPlayStats(userId, id),
  getUserTopTracksByArtist(userId, id, 20),
  getUserTopAlbumsByArtist(userId, id, 10),
  getArtistMonthlyPlays(userId, id),
  getCoListenedArtists(userId, id, 5),
  getListeningTotals(userId, "all"),
]);
```

## Composants

### Réutilisés tels quels

- [ArtistAvatar](src/components/ui/artist-avatar.tsx) — avec `imageUrl` + fallback
- [RankedList / RankedRow](src/components/stats/ranked-list.tsx)
- [SparklineMonthly](src/components/stats/sparkline-monthly.tsx)
- [OtherArtistAlbums](src/components/album/other-artist-albums.tsx)

### Nouveau

`src/components/artist/related-artists.tsx` (server component) :

```tsx
import Link from "next/link";
import { ArtistAvatar } from "@/components/ui/artist-avatar";

interface Props {
  artists: {
    artistId: string;
    name: string;
    imageUrl: string | null;
    coCount: number;
  }[];
}

export function RelatedArtists({ artists }: Props) {
  if (artists.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
      {artists.map((a) => (
        <Link
          key={a.artistId}
          href={`/artist/${a.artistId}`}
          className="group flex flex-col items-center gap-2 rounded-2xl p-3 transition hover:bg-white/5"
        >
          <ArtistAvatar name={a.name} imageUrl={a.imageUrl} size={72} />
          <p className="text-center text-sm font-medium line-clamp-2 group-hover:text-foreground">
            {a.name}
          </p>
          <p className="text-xs text-muted-foreground">{a.coCount} co-écoutes</p>
        </Link>
      ))}
    </div>
  );
}
```

### Inline (pas de fichier dédié)

`ArtistHero` reste un sous-bloc JSX dans `/artist/[id]/page.tsx`. Pas réutilisé ailleurs.

## Mode démo

Étendre `getDemoArtist(id)` dans [src/lib/demo/data.ts](src/lib/demo/data.ts) pour renvoyer aussi :
- `topAlbums` : filtre `DEMO_TOP_ALBUMS` par `artistNames[0] === artist.name`
- `monthly` : `synthesizeMonthlyPlays(stats.count)` (helper existant)
- `related` : 5 autres premiers `DEMO_TOP_ARTISTS` filtrés sur `artistId !== id` (simpliste, c'est de la démo)
- `firstPlayedAt`/`lastPlayedAt` : `synthesizeFirstLastDates(seed)` (existant)
- `totalPercent` : `Math.round(stats.count / DEMO_TOTAL_PLAYS × 100)`

Le rendu de la page côté démo passe par les mêmes composants — pas de divergence d'UI.

## Edge cases

| Cas | Comportement |
|---|---|
| Artiste avec 0 écoute | `<EmptyState>` pour la page complète sauf hero |
| topTracks = 0 | EmptyState dans la section (existant) |
| topAlbums = 0 | Skip la section (rare) |
| monthly < 3 mois de data | Skip sparkline (1-2 points moches) |
| related = 0 | Skip section |
| `firstPlayedAt - lastPlayedAt < 1 jour` | "aujourd'hui" au lieu de "il y a 0 jours" |
| `imageUrl IS NULL` | ArtistAvatar → gradient (déjà géré) |
| `% < 0.5%` | Affiche `"< 1%"` |

## Tests

### Unitaires (vitest)

- `src/db/queries/stats.test.ts` (étendre) — 3 nouveaux tests :
  - `getUserTopAlbumsByArtist` retourne les albums ordered by playCount
  - `getArtistMonthlyPlays` agrège correctement par mois
  - `getCoListenedArtists` exclut le focal artist + ordonne par coCount
- `src/lib/demo/data.test.ts` (étendre) — `getDemoArtist` retourne tous les nouveaux champs

### Manuels

- `/artist/<id>` connecté avec un artiste mainstream (qui a top tracks + albums + co-écoutes)
- `/artist/<id>` en mode démo
- Click sur related artist → navigation correcte
- Hero `<sm` (mobile) : grid s'effondre proprement (avatar au-dessus, big number en bas)

## Ordre de travail suggéré

1. Migrations / queries DB (3 nouvelles) avec tests
2. Extension `getDemoArtist` + test
3. Composant `RelatedArtists`
4. Refonte `/artist/[id]/page.tsx` (hero editorial + 5 sections)
5. Vérif manuelle dev (connecté + démo)
6. Commit + merge
