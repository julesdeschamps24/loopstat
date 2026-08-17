# Sub-projet F - photos d'artistes via TheAudioDB

> Date : 2026-05-19
> Statut : design validé, plan à écrire

## Contexte

Le pivot Spotify → MusicBrainz (sub-projet C+D+E) ne récupère pas les photos d'artistes - MusicBrainz n'en hébergeait pas. La UI affiche actuellement un cercle gradient + initiale via le composant [ArtistAvatar](src/components/ui/artist-avatar.tsx). On intègre TheAudioDB pour combler ce trou.

## Objectifs

- Stocker la photo "thumb" (carrée ~500px) de chaque artiste dans `artists.image_url`.
- Worker autonome : extension du `enrichCatalog` existant, balaie les artistes non encore tentés.
- Match précis quand possible : lookup par MusicBrainz MBID plutôt que par nom.
- Le fallback `ArtistAvatar` (gradient) reste utilisé pour les artistes hors couverture TheAudioDB.

## Non-objectifs

- Pas de `strArtistFanart` ou `strArtistLogo` (HD background, logos PNG) - YAGNI pour le MVP.
- Pas de fallback Wikipedia/Wikidata pour les artistes non trouvés sur TheAudioDB (envisageable plus tard).
- Pas de remplacement direct de `ArtistAvatar` par `<img>` - `ArtistAvatar` gère le fallback.

## Schéma DB - migration `0007_add_artists_tadb_id.sql`

```sql
ALTER TABLE artists ADD COLUMN tadb_id integer;
CREATE INDEX artists_tadb_id_idx ON artists(tadb_id);
```

**Sémantique de `tadb_id`** :
- `NULL` : pas encore tenté (déclenche lookup).
- `0` : sentinelle "tenté, pas trouvé" (skip retry).
- entier positif : ID TheAudioDB, image fetchée et stockée dans `artists.image_url`.

Pas de wipe - les rows existantes ont `tadb_id = NULL`, le worker self-heal les balaie automatiquement.

## Module `src/lib/theaudiodb/`

Mirror de `src/lib/musicbrainz/`.

### `client.ts`

```ts
export class TheAudioDBError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly bodyText: string,
  ) { super(`TheAudioDB ${path} failed: ${status}`); this.name = "TheAudioDBError"; }
}

const API_KEY = process.env.TADB_API_KEY ?? "2";
const API_BASE = `https://www.theaudiodb.com/api/v1/json/${API_KEY}`;

export async function tadbFetch<T>(path: string): Promise<T> { ... }
```

Pas de header `Retry-After` côté TheAudioDB - c'est le worker qui pace à 1.1s entre calls.

### `search.ts`

```ts
export interface TadbArtistMatch {
  tadbId: number;
  thumbUrl: string | null;
}

export async function lookupArtistByMbid({ mbid }: { mbid: string }): Promise<TadbArtistMatch | null>;
export async function searchArtistByName({ name }: { name: string }): Promise<TadbArtistMatch | null>;
```

- `lookupArtistByMbid` : `GET /artist-mb.php?i=<mbid>`. Parse `data.artists[0]`. Si `artists` est `null` ou vide → retourne `null`. Sinon `{ tadbId: parseInt(idArtist), thumbUrl: strArtistThumb || null }`.
- `searchArtistByName` : `GET /search.php?s=<encoded name>`. Idem. On prend le premier résultat (TheAudioDB n'a pas de score, mais ordonne par popularité).

### `catalog.ts`

```ts
const SENTINEL_TADB_ID = 0;

export async function enrichArtistImageByMbid({ artistId, mbid }): Promise<void> {
  const match = await lookupArtistByMbid({ mbid });
  if (!match) {
    await db.update(artists).set({ tadbId: SENTINEL_TADB_ID }).where(eq(artists.id, artistId));
    return;
  }
  await db.update(artists).set({ tadbId: match.tadbId, imageUrl: match.thumbUrl }).where(eq(artists.id, artistId));
}

export async function enrichArtistImageByName({ artistId, name }): Promise<void> { ... }
```

## Extension du worker `enrichCatalog`

Modifier [worker/jobs/enrichCatalog.ts](worker/jobs/enrichCatalog.ts) - après la passe MBz artists, ajouter une 3e passe TheAudioDB.

```ts
// 3. TheAudioDB image sweep
const unenrichedImages = await db
  .select({ artistId: artists.id, name: artists.name, mbid: artists.mbid })
  .from(artists)
  .where(and(isNull(artists.imageUrl), isNull(artists.tadbId)));

let imagesEnriched = 0;
for (let i = 0; i < unenrichedImages.length; i++) {
  await sleep(RATE_DELAY_MS);
  const row = unenrichedImages[i];
  const hasRealMbid = row.mbid && row.mbid !== SENTINEL_MBID;
  try {
    if (hasRealMbid) {
      await enrichArtistImageByMbid({ artistId: row.artistId, mbid: row.mbid! });
    } else {
      await enrichArtistImageByName({ artistId: row.artistId, name: row.name });
    }
    imagesEnriched++;
  } catch (err) {
    wlog.error({ err, artistId: row.artistId }, "enrich artist image failed");
    throw err;
  }
}
```

**Order rationale** : MBz d'abord (fournit `mbid`), puis TheAudioDB réutilise ce mbid pour un match précis.

**Result type étendu** :
```ts
export interface EnrichCatalogResult {
  albumsEnriched: number;
  artistsEnriched: number;
  imagesEnriched: number;
}
```

**Self-heal** : `selfHealEnrichCatalog` ajoute `artists.tadbId IS NULL` à sa condition de réveil. Si non-zéro → re-enqueue.

## UI : `ArtistAvatar` accepte `imageUrl`

Étendre [src/components/ui/artist-avatar.tsx](src/components/ui/artist-avatar.tsx) :

```tsx
interface Props {
  name: string;
  imageUrl?: string | null;
  size?: number;
  className?: string;
}

export function ArtistAvatar({ name, imageUrl, size = 48, className = "" }: Props) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  // Fallback gradient + initiale (existant)
  ...
}
```

**Callsites mis à jour** :
- [src/components/stats/ranked-list.tsx](src/components/stats/ranked-list.tsx) - prop `avatarName` reste, plus nouvelle prop `avatarImageUrl?: string | null` qu'on transmet à `ArtistAvatar`.
- [src/app/top/artists/page.tsx](src/app/top/artists/page.tsx) - passe `avatarImageUrl={artist.imageUrl}` dans `RankedRow`.
- [src/app/artist/[id]/page.tsx](src/app/artist/[id]/page.tsx) - hero devient `<ArtistAvatar name={artist.name} imageUrl={artist.imageUrl} size={192} />`.

Pas de config Next.js Image (on n'utilise pas l'optimizer pour les covers, cohérent avec les album covers Cover Art Archive).

## Variable d'env

Ajout dans `.env.example` :
```
# TheAudioDB API key - '2' = dev key public (rate limit conservateur).
# Pour la prod : sign-up gratuit sur https://www.theaudiodb.com/api_guide.php
TADB_API_KEY=2
```

Sans cette var, le module utilise `"2"` par défaut (dev seulement).

## Erreurs & edge cases

| Cas | Comportement |
|---|---|
| TheAudioDB 503 / network | Throw `TheAudioDBError` → BullMQ retry (backoff 5/10/20s) |
| Artiste non trouvé (`artists: null` ou `[]`) | `tadb_id = 0` (sentinelle), `image_url` reste NULL → gradient en UI |
| Match mais pas d'image (`strArtistThumb = ""`) | `tadb_id` stocké (entier), `image_url = NULL` → gradient en UI |
| URL CDN broken au render | Browser affiche broken-image icon. Acceptable MVP - pas de `onError` JS fallback (nécessiterait `"use client"`, pas justifié) |
| Mismatch fuzzy sur name search (artiste avec un homonyme) | On accepte. TheAudioDB ordonne par popularité, faux positifs rares sur top artistes |

## Tests (TDD strict)

- `src/lib/theaudiodb/client.test.ts` - `tadbFetch` envoie vers l'URL avec la clef + parsing erreur.
- `src/lib/theaudiodb/search.test.ts` - `lookupArtistByMbid` retourne `null` si `artists: null`, parse `idArtist`/`strArtistThumb` correctement, encode le nom dans `searchArtistByName`.
- `src/lib/theaudiodb/catalog.test.ts` - sentinelle sur null, update db.
- `worker/jobs/enrichCatalog.test.ts` (existant) - étendre pour vérifier que la 3e passe est appelée.

## Tests manuels

Après merge :
- Le worker reprend automatiquement. Au bout de ~1h (3.4k artistes × 1.1s ≈ 62 min), 80-90% des artistes ont une photo.
- Vérif visuelle sur `/top/artists` (en mode connecté) : ranges devraient afficher les vraies photos. Les ~10-20% sans match gardent le gradient.
- Hero sur `/artist/[id]` : pour les artistes mainstream, photo HD. Pour les obscurs, gradient.

## Match rate observation

Worker log à la fin du sweep :
```
[info] job=enrich-catalog imagesEnriched=2850 imagesSkipped=501 total=3351
```

Si match rate < 50% → revoir la stratégie (Wikipedia fallback en sub-projet futur).

## Dépendances externes

- **TheAudioDB API** - gratuit, dev key `2` (public), prod key gratuit sur sign-up. Endpoint `https://www.theaudiodb.com/api/v1/json/<key>/`.

Pas de package npm ajouté (fetch natif).

## Ordre de travail suggéré

1. Migration `0007_add_artists_tadb_id.sql`.
2. `src/lib/theaudiodb/` (client, search, catalog) avec tests TDD.
3. Étendre `worker/jobs/enrichCatalog.ts` + `selfHealEnrichCatalog`.
4. Étendre `ArtistAvatar` + callsites.
5. Vérif manuelle worker + UI.
