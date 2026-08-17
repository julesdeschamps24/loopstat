# Window-priority enrichment - design

> Date : 2026-05-27
> Statut : design validé, plan à écrire

## Contexte

Le priority enrich job actuel (commit `8fdf6e1`) prend les top 100 lifetime de l'utilisateur (albums + artistes + albums-from-top-tracks) et les enqueue d'un coup. Mais l'utilisateur consulte d'abord les stats de la **semaine** (default period sur `/top/*` = `1w`). Le top lifetime ne match pas forcément le top de la semaine, et certains items visibles en premier ne sont pas enrichis avant la fin du sweep.

## Objectif

Ordonner la file de priority par **fenêtre temporelle de consultation** : 1w → 4w → 6m → 1y. Les covers/photos correspondant à ce que l'utilisateur voit en premier sont enrichies en premier.

## Non-objectifs

- Pas de changement à la queue BullMQ elle-même (`enrich-catalog-hot` reste, concurrency=2).
- Pas de changement au background sweep (continue à balayer la long-tail).
- Pas de changement à l'on-demand `/api/enrich-single`.
- Pas de support de la fenêtre `all` (= union des 4 autres pour un user actif, pas de valeur ajoutée).

## Limites par fenêtre (tiered)

| Fenêtre | Limit par catégorie |
|---|---|
| 1w | 50 |
| 4w | 30 |
| 6m | 20 |
| 1y | 20 |

Total brut : (50+30+20+20) × 3 catégories = **360 IDs**. Après dedup intra-catégorie ET inter-catégorie (un album peut être dans top-albums-1w ET top-track-albums-1w), on s'attend à **~200-300 items uniques**. À 1.1s/call, **3-5 min de priority sweep**.

## Dedup entre fenêtres

Un item présent en top-50 de la semaine n'est PAS re-counté pour la fenêtre 4w. Cela évite que les artistes-stars (Daft Punk top-1, top de toutes les fenêtres) saturent la file priorisée.

Implementation : pendant la construction de la liste ordonnée, un `Set<string>` track les IDs déjà ajoutés. Skip les doublons aux passes suivantes.

## Module `src/db/queries/enrich.ts`

**Nouvelles fonctions** (les anciennes `getTopAlbumIdsForUser`, `getTopArtistIdsForUser`, `getTopTrackAlbumIdsForUser` sont gardées telles quelles - utilisées en interne via le nouveau code).

```ts
const WINDOW_LIMITS: { window: StreamPeriod; limit: number }[] = [
  { window: "1w", limit: 50 },
  { window: "4w", limit: 30 },
  { window: "6m", limit: 20 },
  { window: "1y", limit: 20 },
];

/**
 * Album IDs ordered by window-priority. For each window (1w, 4w, 6m, 1y)
 * fetch the top-N albums by play count; concatenate with dedup. Items
 * appear in the order : all 1w → all 4w not in 1w → 6m not in above → etc.
 */
export async function getOrderedTopAlbumIdsForUser(
  userId: string,
  refDate: Date,
): Promise<string[]>;

export async function getOrderedTopArtistIdsForUser(
  userId: string,
  refDate: Date,
): Promise<string[]>;

export async function getOrderedTopTrackAlbumIdsForUser(
  userId: string,
  refDate: Date,
): Promise<string[]>;
```

**Étendre les 3 helpers existants** pour accepter un paramètre `since: Date | null = null` :
- `getTopAlbumIdsForUser(userId, limit, since)` - filtre `streams.played_at >= since` quand non-null
- `getTopArtistIdsForUser(userId, limit, since)` - idem
- `getTopTrackAlbumIdsForUser(userId, limit, since)` - idem

Backward-compatible (default `null` = lifetime, comportement actuel inchangé).

## refDate (référence temporelle)

Pour calculer `since` à partir d'une fenêtre, on a besoin d'une référence "maintenant". Le dataset étant un snapshot statique, on utilise `getUserLatestPlayedAt(userId)` (= MAX(played_at)). Fallback `new Date()` si pas de plays.

```ts
const refDate = (await getUserLatestPlayedAt(userId)) ?? new Date();
const since = periodSince(window, refDate); // helper existant
```

Cohérent avec ce qu'on fait déjà sur `/dashboard`, `/top/*`, `/artist/[id]`.

## Wire-in dans `worker/jobs/importHistory.ts`

Remplacer le bloc actuel d'enqueue par :

```ts
try {
  const refDate = (await getUserLatestPlayedAt(userId)) ?? new Date();
  const [orderedAlbumIds, orderedTrackAlbumIds, orderedArtistIds] = await Promise.all([
    getOrderedTopAlbumIdsForUser(userId, refDate),
    getOrderedTopTrackAlbumIdsForUser(userId, refDate),
    getOrderedTopArtistIdsForUser(userId, refDate),
  ]);
  // Union preserves order (Set keeps insertion order in JS).
  const albumIds = Array.from(new Set([...orderedAlbumIds, ...orderedTrackAlbumIds]));
  await enrichCatalogHotQueue.add(
    "enrich-priority",
    { userId, albumIds, artistIds: orderedArtistIds },
    { jobId: `enrich-priority:${userId}:${importId}` },
  );
} catch (priorityErr) {
  wlog.error(...);
}
```

## Worker `enrichCatalogPriority.ts` - préservation d'ordre

Le `SELECT ... WHERE inArray(albums.id, albumIds)` ne garantit pas l'ordre. Solution : SELECT pour récupérer les metadata, puis itérer la liste `albumIds` originale + Map lookup.

```ts
const unenrichedAlbumRows = await db
  .select({ albumId: albums.id, albumName: albums.name, artistName: artists.name })
  .from(albums).innerJoin(albumArtists, ...).innerJoin(artists, ...)
  .where(and(inArray(albums.id, albumIds), isNull(albums.mbid)));
const albumMap = new Map(unenrichedAlbumRows.map((a) => [a.albumId, a]));

for (const id of albumIds) {
  const row = albumMap.get(id);
  if (!row) continue; // skipped - already enriched OR album doesn't have a name
  if (i > 0) await sleep(RATE_DELAY_MS);
  await withMbzRetry(() => enrichAlbumByNames({...row}), wlog);
  albumsEnriched++;
}
```

Pareil pour artistIds (MBz pass + Deezer image pass).

## Edge cases

| Cas | Comportement |
|---|---|
| User vient juste d'importer | refDate = aujourd'hui (ou MAX(played_at) si latest plays < today), fenêtres standards |
| User n'a écouté QUE cette semaine | 4w/6m/1y queries retournent les mêmes IDs que 1w → après dedup, seule la passe 1w fait du travail |
| Top albums-list 1w = top tracks-albums 1w (très probable) | Union dedupe → pas de double work |
| Cross-user dedup | Album/artiste déjà enrichi par autre user → row absent du SELECT (filter `isNull(mbid)`) → skip dans le loop |
| `refDate` null (pas d'écoute) | Fallback `new Date()`. Edge case quasi-impossible vu que la query tourne après l'import |

## Tests

### Unitaires (vitest)

- `src/db/queries/enrich.test.ts` - ajouter 3 tests :
  - `getOrderedTopAlbumIdsForUser("nonexistent", new Date())` retourne `[]`
  - Shape `string[]`
  - Dedup : aucun ID répété (test idempotent sur user fictif sans écoute, retour vide ; le dedup non-vide nécessite fixtures DB, optionnel)

### Manuels

- Re-import du JSON de Jules
- Observer le worker log : on doit voir les chunks `albumsEnriched=25` puis `=50` etc., dans l'ordre window-priority (vérification par échantillon : les premiers items enrichis devraient être les top 1w)
- Vérif visuelle sur `/top/tracks?period=1w` 30s après le démarrage du priority : covers visibles

## Ordre de travail suggéré

1. Étendre les 3 helpers existants (`getTopAlbumIdsForUser`, etc.) avec param `since` optional.
2. Ajouter les 3 nouvelles fonctions ordered (`getOrderedTopAlbumIdsForUser`, etc.).
3. Mettre à jour `importHistory.ts` pour utiliser les nouvelles.
4. Refactor `enrichCatalogPriority.ts` pour préserver l'ordre via Map lookup.
5. Mettre à jour `scripts/enqueue-priority.ts` pour utiliser les nouvelles aussi.
6. Tests + verify + commit.
