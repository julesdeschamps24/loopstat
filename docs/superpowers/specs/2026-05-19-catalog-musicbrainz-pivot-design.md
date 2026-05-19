# Sub-projet C+D+E — pivot catalog Spotify → MusicBrainz

> Date : 2026-05-19
> Statut : design validé, plan à écrire

## Contexte

La pivot stratégique (sub-projet A déjà livré) a remplacé l'auth Spotify par Google et fait de l'upload JSON la seule source de données utilisateur. Restait à éliminer la dépendance Spotify Web API pour l'enrichissement catalogue (covers, métadonnées album/artist) — c'est le but de ce spec.

Décision opérationnelle : C, D et E sont fusionnés dans ce spec pour éviter de laisser `main` dans un état mort-vivant avec du code Spotify non appelé.

## Objectifs

- Récupérer les covers d'album via MusicBrainz + Cover Art Archive (1 lookup par album distinct, pas par track).
- Supprimer toute trace du Spotify Web API du code, des dépendances, et du schéma DB.
- Reset complet du catalog (Jules ré-importera ses JSON).
- Artists : pas de photos pour l'instant (gradient + initiale) ; intégration TheAudioDB différée.

## Non-objectifs

- Pas de support podcast/audiobook (skip comme aujourd'hui).
- Pas de fallback iTunes ou autre service tiers — si MBz n'a pas le match, l'album reste sans cover.
- Pas de re-fetch sur changement de nom d'album/artist côté Spotify (one-shot match à l'import).

## Schéma DB — migration `0005_pivot_catalog_musicbrainz.sql`

```sql
-- Wipe catalog (l'utilisateur re-importera son JSON)
TRUNCATE tracks, albums, artists, track_artists, album_artists, streams CASCADE;

-- Drop colonnes Spotify-only non utilisées par les stats
ALTER TABLE tracks DROP COLUMN duration_ms;
ALTER TABLE tracks DROP COLUMN popularity;
ALTER TABLE tracks DROP COLUMN explicit;
ALTER TABLE tracks DROP COLUMN preview_url;
ALTER TABLE tracks DROP COLUMN isrc;

-- Ajouts MBID
ALTER TABLE albums  ADD COLUMN mbid uuid;
ALTER TABLE artists ADD COLUMN mbid uuid;
CREATE INDEX albums_mbid_idx  ON albums(mbid);
CREATE INDEX artists_mbid_idx ON artists(mbid);

-- Cleanup artist popularity (Spotify-only)
ALTER TABLE artists DROP COLUMN popularity;

-- Drop spotify_id sur users (sub-projet E)
ALTER TABLE users DROP COLUMN spotify_id;

-- Drop la table tokens entièrement (sub-A avait juste neutralisé son usage)
DROP TABLE IF EXISTS spotify_tokens CASCADE;
```

### Convention d'IDs après pivot

- `tracks.id` = Spotify track ID extrait du JSON (`spotify_track_uri` → suffix). **Opaque** : on ne fait plus aucun call Spotify dessus. Stable car le JSON le contient toujours.
- `albums.id` = `alb_<sha1(artist_name + '|' + album_name)[:16]>` — synthétisé à l'import. Idempotent, déterministe.
- `artists.id` = `art_<sha1(artist_name)[:16]>` — synthétisé à l'import.
- `albums.mbid`, `artists.mbid` = MBz UUIDs (nullable). Sentinelle `00000000-0000-0000-0000-000000000000` = "tenté mais pas trouvé sur MBz" (évite les retentes infinies).

## Pipeline d'import — modifications de [worker/jobs/importHistory.ts](worker/jobs/importHistory.ts)

Le parser actuel ne capture que `spotify_track_uri` et `master_metadata_track_name`. On étend à 3 champs supplémentaires :

```ts
interface RawStreamEntry {
  ts?: unknown;
  ms_played?: unknown;
  master_metadata_track_name?: unknown;
  master_metadata_album_artist_name?: unknown;  // NEW
  master_metadata_album_album_name?: unknown;   // NEW
  spotify_track_uri?: unknown;
}
```

### Accumulation pendant le parsing

En plus de `trackNames`, on accumule :
- `artistRows: Map<artistId, { name }>`
- `albumRows: Map<albumId, { name, artistId }>` (premier artiste seulement comme owner)
- `trackToAlbum: Map<trackId, albumId>` (pour remplir `tracks.album_id`)
- `trackArtists: Map<trackId, artistId>` (un seul artiste/track côté JSON Spotify — les features ne sont pas séparées dans les exports)
- `albumArtists: Map<albumId, artistId>`

### Skip rules

- `master_metadata_album_artist_name` manquant → skip l'entry (cohérent avec les skips podcasts/local files).
- `master_metadata_album_album_name` manquant → le track est inséré sans `album_id` (cas des singles).

### Insertion ordering (FK)

1. `INSERT INTO artists (id, name) ON CONFLICT DO NOTHING` (chunks 1000)
2. `INSERT INTO albums (id, name) ON CONFLICT DO NOTHING`
3. `INSERT INTO tracks (id, name, album_id) ON CONFLICT DO NOTHING`
4. `INSERT INTO track_artists (track_id, artist_id, position) ON CONFLICT DO NOTHING`
5. `INSERT INTO album_artists (album_id, artist_id, position) ON CONFLICT DO NOTHING`
6. `insertStreams` (existant)
7. Enqueue enrich (existant, renommé)

### Idempotence

Tout est `ON CONFLICT DO NOTHING`. Les noms ne sont jamais mis à jour — un user qui re-import le même JSON n'écrase rien.

### Helper isolable

`synthesizeIds(artistName, albumName) → { artistId, albumId }` dans [worker/jobs/importHistory.ts](worker/jobs/importHistory.ts) (testable unitairement).

## Worker enrich — nouveau `worker/jobs/enrichCatalog.ts`

Remplace [worker/jobs/enrichMetadata.ts](worker/jobs/enrichMetadata.ts). Boucle sur albums puis artists.

### Flow pour 1 album

1. **Search MBz** — `GET https://musicbrainz.org/ws/2/release-group/?query=release:"{album}" AND artist:"{artist}"&fmt=json&limit=5`
   - User-Agent : `loopstat/1.0 (https://loopstat.tech)` (sinon ban).
   - Score MBz ≥ 90 → match. Sinon stocker la sentinelle.
2. **Cover Art Archive** — `GET https://coverartarchive.org/release-group/<mbid>/front-500`
   - 200 → suivre le 302, stocker l'URL finale dans `albums.image_url`.
   - 404 → mbid stocké, `image_url` reste null (placeholder gradient en UI).
3. **Métadonnées album** — Profiter du lookup pour remplir `albums.release_date` (`first-release-date`), `albums.album_type` (`primary-type`), `albums.total_tracks`.

### Flow pour 1 artiste

`GET https://musicbrainz.org/ws/2/artist/?query=artist:"{name}"&fmt=json&limit=5`
- Score ≥ 90 → stocker mbid. Sinon sentinelle.
- `artists.image_url` reste null (TheAudioDB plus tard).
- `artists.genres` reste null (différé).

### Rate limit & resilience

- 1 req/sec MBz (`RATE_DELAY_MS = 1100`). CAA même rythme.
- `MAX_RETRIES = 3` par item, backoff exponentiel sur 503.
- Persistance par chunk de 25 albums.
- BullMQ dedup via `jobId: "enrich-catalog-global"`.
- `selfHealEnrich` check `albums.image_url IS NULL AND mbid IS NULL` (au lieu de `tracks.duration_ms IS NULL`).

### Lazy enrich `/album/[id]`

La branche actuelle qui appelle Spotify pour enrichir à la volée (cf [src/app/album/[id]/page.tsx](src/app/album/[id]/page.tsx)) est supprimée. Si l'album n'a pas de cover, placeholder gradient, pas d'API call synchrone.

## Modules

### Nouveau `src/lib/musicbrainz/`

- **`client.ts`** — wrapper fetch avec User-Agent obligatoire, retry sur 503, parse `Retry-After`. Export `mbFetch<T>(path, options)`.
- **`search.ts`** — `searchReleaseGroup({ artist, album })` et `searchArtist({ name })`. Construction de la query, score-checking, normalisation.
- **`coverArt.ts`** — `fetchCoverUrl(releaseGroupMbid): Promise<string | null>`. Suit le 302.
- **`catalog.ts`** — `enrichAlbumByNames({ albumId, albumName, artistName })` et `enrichArtistByName({ artistId, name })`. Pipelines complets.
- **`types.ts`** — types minimaux des responses MBz.
- Tests : `client.test.ts`, `search.test.ts`, `coverArt.test.ts`, `catalog.test.ts`.

### Suppression

- [src/lib/spotify/](src/lib/spotify/) (tout le répertoire et tous les tests).
- [src/app/api/now-playing/](src/app/api/now-playing/).
- [src/components/stats/currently-playing.tsx](src/components/stats/currently-playing.tsx).
- Preview audio dans [src/components/share/share-editor.tsx](src/components/share/share-editor.tsx) (garder le reste du share editor).
- `scripts/retry-enrich.ts`.
- [worker/jobs/pollRecent.ts](worker/jobs/pollRecent.ts), [worker/jobs/fanout.ts](worker/jobs/fanout.ts).
- Schedulers BullMQ `poll-recent` et `enrich` (le second recréé sous `enrich-catalog` dans la même PR).

### Ajout UI

- `src/components/ui/artist-avatar.tsx` — cercle gradient (couleur dérivée de `sha1(name)`) + initiale. Utilisé partout où il y avait une image artiste.
- Les `RankedRow` actuels gèrent déjà `imageUrl = null` → placeholder. Adapter pour les artists rows à utiliser `<ArtistAvatar>` au lieu du placeholder générique.

## Erreurs & edge cases

| Cas | Comportement |
|---|---|
| MBz down / timeout | `MusicBrainzError`, BullMQ retry (backoff 5/10/20s) |
| Album/artist non trouvé (score < 90) | Sentinelle `00000…000` dans `mbid`, placeholder gradient en UI |
| Cover Art Archive 404 | `mbid` stocké, `image_url = null`, placeholder gradient |
| Sha1 collision (homonymes) | Accepté : 2 artistes au même nom fusionnés. Documenter dans `synthesizeIds()`. |
| JSON sans `album_name` | `tracks.album_id = NULL`, track ne sort pas sur `/album/[id]` mais reste dans `/top/tracks` |
| Imports concurrents | BullMQ dedup l'enqueue (`jobId` fixed) |
| User-Agent banni MBz | 1.1s entre calls, pas de parallélisme. Log clair si récurrent. |

## Tests

### Unitaires (vitest)

- `src/lib/musicbrainz/{client,search,coverArt,catalog}.test.ts`
- `src/lib/musicbrainz/synthesizeIds.test.ts` (ou colocaté avec importHistory)
- `worker/jobs/importHistory.test.ts` (étendre) — entries avec `master_metadata_album_*`, entries sans album, idempotence re-import.

### Migration

- `0005` idempotente (relance ne casse rien).
- Snapshot `drizzle/meta/0005_snapshot.json` cohérent.

### Manuels (post-merge, avant deploy)

- Jules re-import son JSON. Vérif :
  - Import complete < 5 min.
  - Enrich tourne sans erreur logs.
  - ~15-30 min plus tard, top albums avec covers (~80-90% attendu sur musique mainstream).
  - Artists : gradient + initiale.
- Toutes pages connectées + démo : `/dashboard`, `/top/{tracks,artists,albums}`, `/album/[id]`, `/artist/[id]`, `/track/[id]`.
- `vitest run` global vert.

### Match rate observation

Pas de cible chiffrée stricte. Si < 60% sur dataset Jules → revoir la query MBz (ajouter `type:Album`, `country:`).

## Dépendances externes

- **MusicBrainz API** — gratuit, 1 req/sec/UA, sans clef. Endpoint `https://musicbrainz.org/ws/2/`.
- **Cover Art Archive** — gratuit, sans limite documentée, sans clef. Endpoint `https://coverartarchive.org/`.

Aucun ajout package npm prévu (fetch natif suffit). Si on veut éventuellement un wrapper, candidate : `musicbrainz-api` (npm) — à évaluer dans le plan.

## Ordre de travail suggéré

1. Migration `0005` + drop des fichiers Spotify.
2. `src/lib/musicbrainz/` (client, search, coverArt, catalog) avec tests.
3. Refacto `importHistory.ts` pour synthétiser IDs + parser `album_name`/`artist_name`.
4. Nouveau `worker/jobs/enrichCatalog.ts` + `selfHealEnrich` adapté.
5. UI : `ArtistAvatar`, ajustements aux RankedRow / album cards.
6. Re-import du JSON de Jules, observation match rate, ajustements query MBz si nécessaire.
