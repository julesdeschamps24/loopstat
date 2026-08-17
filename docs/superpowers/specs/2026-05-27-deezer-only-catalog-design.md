# Deezer-only catalog enrichment - design

> Date : 2026-05-27
> Statut : design validé, plan à écrire

## Contexte

Aujourd'hui l'enrichissement catalogue combine trois APIs :

- **MusicBrainz (MBz)** : métadonnée canonique (mbid, release_date, album_type) + filtre "déjà tenté"
- **Cover Art Archive (CAA)** : pochettes d'albums (servies via archive.org)
- **Deezer** : photos d'artistes + fallback pochettes (priority + on-demand only)

Problèmes constatés :

1. **Couverture incomplète** : MBz/CAA miss souvent sur catalogue non-anglo / indé / mixtapes → `image_url` reste NULL.
2. **Asymétrie** : les artists ont un sweep Deezer dans le background, pas les albums. Long-tail album = pochettes jamais récupérées.
3. **Lenteur** : MBz est rate-limité 1.1s/call. Un sweep complet prend des heures.
4. **Code** : `src/lib/musicbrainz/` ~500 lignes, retry logic (`withMbzRetry`), User-Agent obligatoire, fallback CAA, complexité importante.

Mesure : Deezer hit ~94% sur le top 100 du dataset de référence, MBz/CAA ~30%.

## Objectif

Supprimer toute dépendance à MusicBrainz et Cover Art Archive. Le catalogue (albums + artists) est enrichi exclusivement via Deezer. Single source of truth, single API, single rate-limit régime.

## Non-objectifs

- Pas de changement aux queues BullMQ (`enrich-catalog`, `enrich-catalog-hot`, `enrich-catalog-single` restent).
- Pas de changement aux flows on-demand (single-enrich on click) ni priority (ultra-priority + window-ordered) - ils utilisent déjà Deezer, juste à toiletter les imports.
- Pas de changement à l'import history.

## Décisions architecturales

### A) Schema : drop des colonnes orphelines

Après migration, suppression de :
- `albums.mbid` (text)
- `albums.album_type` (text)
- `artists.mbid` (text)
- index associés (`albums_mbid_idx`, `artists_mbid_idx`)

Conservé :
- `albums.release_date` (date) - toujours affiché sur `/album/[id]` ([page.tsx:290](src/app/album/[id]/page.tsx#L290))
- `albums.image_url`, `artists.image_url`, `artists.deezer_id` (existants)

Ajouté :
- `albums.deezer_id` (integer, nullable) + index `albums_deezer_id_idx`
  - Sentinel `0` = "Deezer testé, pas de match" (miroir exact de `artists.deezer_id`)
  - NULL = pas encore tenté

### B) Re-sweep complet du catalogue existant

Au déploiement, le filtre `isNull(albums.deezer_id)` matche 100% des albums (colonne neuve = toutes NULL). Donc le sweep re-passe tout le catalogue via Deezer, écrasant les `image_url` historiques (CAA archive.org → Deezer cdns) pour homogénéité.

Justification : Deezer renvoie 250×250 standardisé, les URLs CAA varient en taille et certaines sont des thumbs basse résolution. Cohérence visuelle > préservation de l'existant.

Coût : ~150ms × N albums (~quelques minutes à l'échelle du dataset utilisateur).

## Couche Deezer (extensions)

`src/lib/deezer/search.ts` - `searchAlbumByName` inchangé (renvoie `deezerAlbumId` + `coverUrl`).

Note : `/search/album` ne renvoie pas `release_date`. Pour l'obtenir, second call `/album/{id}`. C'est le seul champ supplémentaire qu'on veut, donc un module séparé suffit.

`src/lib/deezer/album.ts` (nouveau) - `fetchAlbumDetails({deezerAlbumId})` :

```ts
export interface DeezerAlbumDetails {
  releaseDate: string | null;  // "YYYY-MM-DD"
}

export async function fetchAlbumDetails({
  deezerAlbumId,
}: { deezerAlbumId: number }): Promise<DeezerAlbumDetails | null>;
```

`src/lib/deezer/catalog.ts` - `enrichAlbumImageByDeezer` étendu :

```ts
export async function enrichAlbumImageByDeezer({
  albumId, artistName, albumName,
}): Promise<void> {
  const match = await searchAlbumByName({ artistName, albumName });
  if (!match) {
    await db.update(albums).set({ deezerId: SENTINEL_DEEZER_ID }).where(eq(albums.id, albumId));
    return;
  }
  // 2nd call for release_date (best-effort, swallow errors)
  let releaseDate: string | null = null;
  try {
    const details = await fetchAlbumDetails({ deezerAlbumId: match.deezerAlbumId });
    releaseDate = details?.releaseDate ?? null;
  } catch { /* ignore */ }

  await db.update(albums).set({
    deezerId: match.deezerAlbumId,
    imageUrl: match.coverUrl,
    releaseDate,  // string "YYYY-MM-DD", Drizzle `date` accepte
  }).where(eq(albums.id, albumId));
}
```

## Refactor `worker/jobs/enrichCatalog.ts`

Le sweep devient symétrique albums/artists :

```ts
export async function enrichCatalog(): Promise<EnrichCatalogResult> {
  const wlog = log.child({ job: "enrich-catalog" });

  // Albums sweep (Deezer)
  const unenrichedAlbums = await db
    .select({ albumId: albums.id, albumName: albums.name, artistName: artists.name })
    .from(albums)
    .innerJoin(albumArtists, eq(albumArtists.albumId, albums.id))
    .innerJoin(artists, eq(artists.id, albumArtists.artistId))
    .where(isNull(albums.deezerId));

  let albumsEnriched = 0;
  for (const row of unenrichedAlbums) {
    await enrichAlbumImageByDeezer({ ...row });
    albumsEnriched++;
    if (albumsEnriched % CHUNK_SIZE === 0) {
      wlog.info({ albumsEnriched, total: unenrichedAlbums.length }, "chunk persisted");
    }
  }

  // Artists sweep (Deezer)
  const unenrichedArtists = await db
    .select({ artistId: artists.id, name: artists.name })
    .from(artists)
    .where(isNull(artists.deezerId));

  let artistsEnriched = 0;
  for (const row of unenrichedArtists) {
    await enrichArtistImageByDeezer({ ...row });
    artistsEnriched++;
  }

  return { albumsEnriched, artistsEnriched };
}
```

Suppression : `withMbzRetry`, `RATE_DELAY_MS`, `sleep` entre calls, séparation "MBz pass" / "Deezer pass" (un seul pass).

Note Deezer rate : la doc publique tolère ~50 req/s. Pour rester safe, on garde un délai léger (~50ms) entre calls - pas de saturation, mais évite un burst pathologique.

`selfHealEnrichCatalog` : filtre `isNull(albums.deezerId)` au lieu de `mbid`. Idem `artists`.

## Refactor `worker/jobs/enrichCatalogPriority.ts`

- Ultra-priority pass : déjà Deezer, rien à changer
- Window-ordered sweep : remplacer `isNull(albums.mbid)` par `isNull(albums.deezerId)`. Boucle interne appelle `enrichAlbumImageByDeezer` (qui couvre maintenant aussi `release_date`).

Suppression : `withMbzRetry`, `enrichAlbumByNames` (MBz/CAA), `enrichArtistByName` (MBz) - plus aucun import musicbrainz.

## Refactor `worker/jobs/enrichCatalogSingle.ts`

Aucun changement (déjà Deezer-only via `enrichAlbumImageByDeezer` + `enrichArtistImageWithFallback`).

## Refactor `worker/jobs/enrichArtistImage.ts`

Plus de fallback chain - c'est juste Deezer. Renommer `enrichArtistImageWithFallback` → `enrichArtistImageByDeezer` (alias direct sur la fonction Deezer) et inline la garde de la pre-check.

## Suppressions

**Modules :**
- `src/lib/musicbrainz/` (entier)
- Tests associés `src/lib/musicbrainz/*.test.ts`

**Fonctions :**
- `withMbzRetry` (où qu'elle vive)
- `enrichAlbumByNames` (MBz/CAA)
- `enrichArtistByName` (MBz)

**Env vars :**
- `MUSICBRAINZ_USER_AGENT` (et toute autre var MBz)

**Schema columns (migration) :**
- `albums.mbid`, `albums.album_type`, `artists.mbid` + index

## Migrations DB

### Migration N : add `albums.deezer_id`

```sql
ALTER TABLE albums ADD COLUMN deezer_id integer;
CREATE INDEX albums_deezer_id_idx ON albums(deezer_id);
```

### Migration N+1 : drop colonnes mortes

```sql
DROP INDEX IF EXISTS albums_mbid_idx;
DROP INDEX IF EXISTS artists_mbid_idx;
ALTER TABLE albums DROP COLUMN mbid;
ALTER TABLE albums DROP COLUMN album_type;
ALTER TABLE artists DROP COLUMN mbid;
```

Deux migrations séparées : la première active le nouveau filtre, la deuxième nettoie. Si rollback nécessaire entre les deux, on peut revenir en arrière sans perte.

## Tests à mettre à jour

- `src/lib/deezer/search.test.ts` - assertions sur `recordType`
- `src/lib/deezer/album.test.ts` (nouveau) - `fetchAlbumDetails`
- `src/lib/deezer/catalog.test.ts` - assertions release_date write
- `worker/jobs/enrichCatalog.test.ts` - supprimer assertions MBz, ajouter sweep Deezer albums
- `worker/jobs/enrichCatalogPriority.test.ts` - filtre `isNull(deezerId)`
- Tests MBz : delete

## Edge cases

| Cas | Comportement |
|---|---|
| `/search/album` miss | Sentinel `deezerId = 0`, `image_url` reste NULL, `release_date` reste NULL |
| `/album/{id}` 404 (rare, race) | release_date = null, mais image_url + deezer_id quand même persistés |
| Deezer down complet | sweep s'arrête après N retries (cf BullMQ retry), mais les artists qui ont déjà passé restent OK |
| Re-import après sweep | `import-history` ré-insère NewAlbum avec onConflictDoNothing → `deezer_id` reste, pas de re-sweep |

## Tests manuels post-déploiement

1. Lancer migration `pnpm drizzle:push`
2. `pnpm dev` + worker
3. Observer log worker : "album sweep starting" puis "chunk persisted 100..."
4. Vérif sur `/top/albums` : toutes les pochettes affichées (sauf cas Deezer-miss)
5. Vérif sur `/album/[id]` (album avec match Deezer) : release_date affiché
6. Vérif sur `/album/[id]` (album sans match Deezer, sentinel) : pas de cover, pas de release_date, page affiche fallback proprement

## Ordre de travail suggéré

1. Spec `searchAlbumByName` retournant `recordType` + créer `fetchAlbumDetails` Deezer
2. Migration N : `add albums.deezer_id`
3. Refactor `enrichAlbumImageByDeezer` (sentinel + release_date via /album/{id})
4. Refactor `enrichCatalog.ts` (Deezer-only sweep symétrique, filtre `deezerId`)
5. Refactor `enrichCatalogPriority.ts` (filtre `deezerId`)
6. Renommer `enrichArtistImageWithFallback` → simplification Deezer-only
7. Delete `src/lib/musicbrainz/` + tests
8. Drop env var `MUSICBRAINZ_USER_AGENT` (code + `.env.example` si existant)
9. Migration N+1 : drop colonnes mortes
10. Tests + verify + commit
