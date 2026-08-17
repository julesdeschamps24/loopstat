# Priority enrichment - design

> Date : 2026-05-26
> Statut : design validé, plan à écrire

## Contexte

Le worker `enrich-catalog` scan ~6500 albums + ~3300 artistes dans l'ordre d'insertion (= alphabétique par MBID synthétisé) à 1.1s par item. Pour le user dont 99% des stats portent sur ses ~100 tops, **~80% du temps worker est gaspillé sur la long-tail**. À plusieurs users, le job dédupliqué `jobId: "enrich-catalog-global"` bloque user B derrière la file de user A (~3h).

## Objectifs

- **Visible-first** : les ~150 items qui s'affichent sur dashboard / /top/* sont enrichis en < 5 min après import.
- **Multi-user fair** : user B n'attend pas la fin de user A.
- **On-demand** : si une page charge un cover absent, l'enrich se déclenche pour cet item précis (avec anti-storm).
- **Cross-user dedup** : un album déjà enrichi par user A est skippé par user B (gratis via le check `isNull(albums.mbid)` existant).
- **Scalable** à 1000+ users.

## Non-objectifs

- Pas de refresh périodique des covers (CAA URLs sont content-addressed, stables).
- Pas de UI live-update (Server Components, refresh nécessaire pour voir les nouvelles covers).
- Pas de quota / billing par user (free for all dans cette itération).

## Architecture - 3 niveaux

### Niveau 1 - Hot priority sweep (per user)

Nouvelle queue BullMQ `enrich-catalog-hot`, concurrency=2.

- L'import termine → enqueue `enrich-priority` avec `{ userId, albumIds: top100, artistIds: top50 }` calculés via les queries `getTopAlbumIdsForUser` / `getTopArtistIdsForUser`.
- Le job loop sur ces ~150 items, applique `enrichAlbumByNames` puis `enrichArtistByName` puis `enrichArtistImageByMbid`, 1.1s entre calls.
- Durée typique : ~150 × 1.1s ≈ **3 min**.
- Jobs hot ont un `jobId` unique `enrich-priority:<userId>:<importId>` → dedup par import, pas global.

### Niveau 2 - Background sweep (long-tail)

La queue existante `enrich-catalog` devient le mop-up faible priorité.

- Même code que le `enrichCatalog()` actuel.
- Concurrency=1.
- Skippe automatiquement les items déjà enrichis par niveau 1 (`isNull(albums.mbid)` filter).
- Workers `enrich-catalog-hot` et `enrich-catalog` séparés → user B's hot job ne queue pas derrière user A's background sweep.

### Niveau 3 - On-demand enrich (lazy)

Nouveau endpoint `POST /api/enrich-single`.

- Une page handler qui détecte un cover null peut fire-and-forget un POST vers cet endpoint avec `{ type: "album" | "artist", id: string }`.
- Le endpoint :
  1. Vérifie en DB que l'item existe et que son cover est encore null.
  2. Vérifie un guard Redis `SET enrich:<type>:<id> 1 NX EX 600` pour éviter qu'un même item soit enqueué 50 fois si une page le rend en parallèle pour 50 users.
  3. Enqueue dans `enrich-catalog-single` (nouvelle queue, concurrency=1).
- Le worker `enrich-catalog-single` consomme un item à la fois, applique le pipeline normal.
- L'UI reste avec le placeholder pour ce render - le refresh suivant verra le cover. Pas de polling client (YAGNI).

## Schéma DB

Pas d'alteration nécessaire. Le `isNull(albums.mbid)` + `isNull(albums.image_url)` suffisent comme filtres.

**Index optionnels** (à ajouter seulement si la requête de scan ralentit à plusieurs users) :
```sql
CREATE INDEX albums_unenriched_idx ON albums (id) WHERE mbid IS NULL;
CREATE INDEX artists_unenriched_idx ON artists (id) WHERE mbid IS NULL;
```

À évaluer après mesure. Pour l'instant, le scan séquentiel sur ~10k rows est OK.

## Files à créer / modifier

### Créer

- `worker/jobs/enrichCatalogPriority.ts` - `enrichCatalogPriority({ userId, albumIds, artistIds })`. Reuse `withMbzRetry`, `enrichAlbumByNames`, `enrichArtistByName`, `enrichArtistImageByMbid`.
- `worker/jobs/enrichCatalogSingle.ts` - `enrichCatalogSingle({ type, id })`. Single-item enrich (album ou artiste).
- `src/app/api/enrich-single/route.ts` - POST endpoint avec Redis throttle.
- `src/db/queries/enrich.ts` - `getTopAlbumIdsForUser(userId, limit)`, `getTopArtistIdsForUser(userId, limit)`.

### Modifier

- `worker/queue.ts` - ajouter `enrichCatalogHotQueue` + `enrichCatalogSingleQueue`.
- `worker/index.ts` - register 2 nouveaux workers (hot + single).
- `worker/jobs/importHistory.ts` - après l'enqueue background, enqueue le hot job avec top IDs.

### Optionnel (cleanup)

- `worker/jobs/enrichCatalog.ts` - pas changé fonctionnellement, mais on peut ajouter un commentaire indiquant que c'est devenu le "background mop-up".

## Multi-user fairness

- **Imports concurrents** : chaque user a son propre `enrich-priority:<userId>:<importId>` jobId → pas de dedup cross-user. Tous les hot jobs s'exécutent en parallèle (concurrency=2 = 2 hot jobs simultanés max).
- **Background** : la queue `enrich-catalog` garde son `jobId: "enrich-catalog-global"` (dedup volontaire - pas besoin de relancer le sweep si déjà en cours). Les items s'enrichissent dans l'ordre d'insertion mais c'est OK car le hot a déjà couvert les visibles.
- **On-demand** : `enrich-catalog-single` est FIFO. Throttle Redis = pas de duplication par item.

## Anti-storm pour on-demand

```ts
const guard = await redis.set(`enrich:${type}:${id}`, "1", "NX", "EX", 600);
if (guard !== "OK") {
  // Déjà enqueué récemment, skip
  return Response.json({ ok: true, skipped: true });
}
await enrichCatalogSingleQueue.add(...);
```

TTL 600s (10 min) est large : couvre la durée d'attente + traitement du job + observation du cover sur le prochain refresh.

## Quand déclencher on-demand côté pages ?

Pour éviter la complexité, je propose :
- **Pages détail** (`/album/[id]`, `/artist/[id]`, `/track/[id]`) : si l'item rendu a `image_url IS NULL`, fire-and-forget vers `/api/enrich-single` côté serveur (dans le `page.tsx`, sans bloquer le render).
- **Search bar** : si un résultat affiché a `image_url IS NULL`, fire-and-forget côté serveur dans la query handler.

Les pages liste (`/top/*`) ne déclenchent PAS d'on-demand : elles affichent ce qu'elles ont. Si un cover manque, c'est que le hot job ne l'a pas mis dans le top, et c'est OK qu'il reste en placeholder jusqu'au background sweep.

## Tests

### Unitaires (vitest)

- `worker/jobs/enrichCatalogPriority.test.ts` - smoke test (mock queue, mock enrich funcs).
- `worker/jobs/enrichCatalogSingle.test.ts` - smoke test idem.
- `src/db/queries/enrich.test.ts` - `getTopAlbumIdsForUser` retourne IDs ordered by play count.
- `src/app/api/enrich-single/route.test.ts` - Redis guard prevent duplicate enqueue, valid type values only.

### Manuels

- Re-import → observer dans les logs : `enrich-priority` job fini en ~3 min, le hot top apparaît avec covers, le background sweep démarre en suite.
- Vider la DB sur un album dont mbid IS NULL, visiter `/album/<id>` → enrich-single déclenché → cover apparaît au refresh.
- Throttle : visiter le même `/album/<id>` 5x en rapide succession → un seul enqueue.

## Ordre de travail suggéré

1. Helpers DB (`getTopAlbumIdsForUser`, `getTopArtistIdsForUser`) avec tests.
2. `enrichCatalogPriority` worker job.
3. Ajout queue `enrich-catalog-hot` + worker registration.
4. Wire-in dans `importHistory.ts` (enqueue hot après background).
5. `enrichCatalogSingle` worker job + queue.
6. `/api/enrich-single` endpoint avec Redis throttle.
7. Wire-in on-demand sur pages détail (`/album/[id]`, `/artist/[id]`, `/track/[id]`).
8. Vérif manuelle + push.
