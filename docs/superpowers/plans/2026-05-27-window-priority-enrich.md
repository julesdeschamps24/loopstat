# Window-Priority Enrich Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the priority enrich job so covers/photos load in window-priority order (1w → 4w → 6m → 1y), matching the order users actually consult on `/top/*`.

**Architecture:** Extend the 3 existing top-IDs helpers with an optional `since: Date | null` param. Add 3 new "ordered" helpers that loop over time windows (50/30/20/20 tiered limits) and dedup across windows. Refactor `enrichCatalogPriority` to preserve the input ID order via a Map lookup (since Postgres `inArray` returns rows in arbitrary order). Wire-in in `importHistory.ts` + `scripts/enqueue-priority.ts`.

**Tech Stack:** TypeScript / Drizzle ORM / Postgres / BullMQ / vitest.

**Spec source:** [docs/superpowers/specs/2026-05-27-window-priority-enrich-design.md](docs/superpowers/specs/2026-05-27-window-priority-enrich-design.md) (commit `4f02875`).

**Worktree:** Create via `superpowers:using-git-worktrees` at execution time.

---

## Task 1: Extend the 3 existing top-IDs helpers with `since` param

**Files:**
- Modify: `src/db/queries/enrich.ts` (extend signatures)
- Test: `src/db/queries/enrich.test.ts`

- [ ] **Step 1: Add tests for the new `since` parameter**

Append to `src/db/queries/enrich.test.ts`:

```ts
describe("getTopAlbumIdsForUser with since", () => {
  it("accepts an optional `since` Date parameter", async () => {
    const { getTopAlbumIdsForUser } = await import("./enrich");
    const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const ids = await getTopAlbumIdsForUser(
      "00000000-0000-0000-0000-000000000000",
      10,
      yearAgo,
    );
    expect(Array.isArray(ids)).toBe(true);
    expect(ids).toEqual([]);
  });

  it("backward-compat : called without `since` returns lifetime", async () => {
    const { getTopAlbumIdsForUser } = await import("./enrich");
    const ids = await getTopAlbumIdsForUser(
      "00000000-0000-0000-0000-000000000000",
      10,
    );
    expect(Array.isArray(ids)).toBe(true);
  });
});

describe("getTopArtistIdsForUser with since", () => {
  it("accepts an optional `since` parameter", async () => {
    const { getTopArtistIdsForUser } = await import("./enrich");
    const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const ids = await getTopArtistIdsForUser(
      "00000000-0000-0000-0000-000000000000",
      10,
      yearAgo,
    );
    expect(ids).toEqual([]);
  });
});

describe("getTopTrackAlbumIdsForUser with since", () => {
  it("accepts an optional `since` parameter", async () => {
    const { getTopTrackAlbumIdsForUser } = await import("./enrich");
    const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const ids = await getTopTrackAlbumIdsForUser(
      "00000000-0000-0000-0000-000000000000",
      10,
      yearAgo,
    );
    expect(ids).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
pnpm test src/db/queries/enrich.test.ts
```

Expected: FAIL (the 3-argument calls would cause TS error or runtime since the parameter doesn't exist).

- [ ] **Step 3: Update the 3 functions**

Modify `src/db/queries/enrich.ts`:

```ts
import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { albumArtists, albums, streams, tracks, trackArtists } from "@/db/schema";

const QUALIFYING_PLAY = sql`(${streams.msPlayed} >= 30000 OR ${streams.msPlayed} IS NULL)`;

/**
 * Top-N album IDs ranked by play count for `userId`. When `since` is provided,
 * filter to streams played at or after that date. Used by the priority enrich
 * job to compute per-window top items.
 */
export async function getTopAlbumIdsForUser(
  userId: string,
  limit: number,
  since: Date | null = null,
): Promise<string[]> {
  const whereClause = since
    ? and(eq(streams.userId, userId), gte(streams.playedAt, since), QUALIFYING_PLAY)
    : and(eq(streams.userId, userId), QUALIFYING_PLAY);
  const rows = await db
    .select({ albumId: albums.id })
    .from(streams)
    .innerJoin(tracks, eq(tracks.id, streams.trackId))
    .innerJoin(albums, eq(albums.id, tracks.albumId))
    .where(whereClause)
    .groupBy(albums.id)
    .orderBy(desc(sql`count(${streams.id})`))
    .limit(limit);
  return rows.map((r) => r.albumId);
}

/**
 * Top-N artist IDs ranked by play count for `userId`. When `since` is provided,
 * filter to streams played at or after that date.
 */
export async function getTopArtistIdsForUser(
  userId: string,
  limit: number,
  since: Date | null = null,
): Promise<string[]> {
  const whereClause = since
    ? and(eq(streams.userId, userId), gte(streams.playedAt, since), QUALIFYING_PLAY)
    : and(eq(streams.userId, userId), QUALIFYING_PLAY);
  const rows = await db
    .select({ artistId: trackArtists.artistId })
    .from(streams)
    .innerJoin(trackArtists, eq(trackArtists.trackId, streams.trackId))
    .where(whereClause)
    .groupBy(trackArtists.artistId)
    .orderBy(desc(sql`count(${streams.id})`))
    .limit(limit);
  return rows.map((r) => r.artistId);
}

/**
 * Album IDs belonging to the user's top-N tracks. When `since` is provided,
 * filter to streams played at or after that date.
 */
export async function getTopTrackAlbumIdsForUser(
  userId: string,
  limit: number,
  since: Date | null = null,
): Promise<string[]> {
  const whereClause = since
    ? and(
        eq(streams.userId, userId),
        gte(streams.playedAt, since),
        QUALIFYING_PLAY,
        isNotNull(tracks.albumId),
      )
    : and(eq(streams.userId, userId), QUALIFYING_PLAY, isNotNull(tracks.albumId));
  const rows = await db
    .select({ albumId: tracks.albumId, plays: sql<number>`count(${streams.id})::int` })
    .from(streams)
    .innerJoin(tracks, eq(tracks.id, streams.trackId))
    .where(whereClause)
    .groupBy(streams.trackId, tracks.albumId)
    .orderBy(desc(sql`count(${streams.id})`))
    .limit(limit);
  return Array.from(new Set(rows.map((r) => r.albumId!).filter((id) => id !== null)));
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test src/db/queries/enrich.test.ts
```

Expected: all tests pass (existing 4 + new 5 = 9).

- [ ] **Step 5: Commit**

```bash
git add src/db/queries/enrich.ts src/db/queries/enrich.test.ts
git commit -m "feat(enrich): extend top-IDs helpers with optional since param"
```

---

## Task 2: Add `getOrderedTop*ForUser` helpers (window-priority)

**Files:**
- Modify: `src/db/queries/enrich.ts` (add 3 ordered helpers + WINDOW_LIMITS)
- Test: `src/db/queries/enrich.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/db/queries/enrich.test.ts`:

```ts
describe("getOrderedTopAlbumIdsForUser", () => {
  it("returns empty array for non-existent user", async () => {
    const { getOrderedTopAlbumIdsForUser } = await import("./enrich");
    const ids = await getOrderedTopAlbumIdsForUser(
      "00000000-0000-0000-0000-000000000000",
      new Date(),
    );
    expect(ids).toEqual([]);
  });

  it("returns deduped string array shape", async () => {
    const { getOrderedTopAlbumIdsForUser } = await import("./enrich");
    const ids = await getOrderedTopAlbumIdsForUser(
      "00000000-0000-0000-0000-000000000000",
      new Date(),
    );
    expect(Array.isArray(ids)).toBe(true);
    // Dedup check : Set size == array length means no duplicates
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getOrderedTopArtistIdsForUser", () => {
  it("returns deduped string array", async () => {
    const { getOrderedTopArtistIdsForUser } = await import("./enrich");
    const ids = await getOrderedTopArtistIdsForUser(
      "00000000-0000-0000-0000-000000000000",
      new Date(),
    );
    expect(ids).toEqual([]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getOrderedTopTrackAlbumIdsForUser", () => {
  it("returns deduped string array", async () => {
    const { getOrderedTopTrackAlbumIdsForUser } = await import("./enrich");
    const ids = await getOrderedTopTrackAlbumIdsForUser(
      "00000000-0000-0000-0000-000000000000",
      new Date(),
    );
    expect(ids).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
pnpm test src/db/queries/enrich.test.ts
```

Expected: FAIL (functions don't exist yet).

- [ ] **Step 3: Add WINDOW_LIMITS + the 3 ordered functions**

Append to `src/db/queries/enrich.ts`:

```ts
import { periodSince, type StreamPeriod } from "@/lib/stats/period";

/**
 * Tiered limits per time window for the priority enrich pass. 1w is the
 * default period shown on /top/* - gets the largest slice. Older windows
 * get smaller slices since they're consulted less often.
 */
const WINDOW_LIMITS: { window: StreamPeriod; limit: number }[] = [
  { window: "1w", limit: 50 },
  { window: "4w", limit: 30 },
  { window: "6m", limit: 20 },
  { window: "1y", limit: 20 },
];

/**
 * Album IDs ordered by window-priority for the priority enrich job. For each
 * window (1w, 4w, 6m, 1y) fetch the top-N by play count; concatenate with
 * dedup so an item only appears in the earliest window it qualifies for.
 *
 * `refDate` is the "now" used to compute `since` boundaries - typically the
 * user's MAX(played_at), since the dataset is a static snapshot.
 */
export async function getOrderedTopAlbumIdsForUser(
  userId: string,
  refDate: Date,
): Promise<string[]> {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const { window, limit } of WINDOW_LIMITS) {
    const since = periodSince(window, refDate);
    const ids = await getTopAlbumIdsForUser(userId, limit, since);
    for (const id of ids) {
      if (!seen.has(id)) {
        seen.add(id);
        ordered.push(id);
      }
    }
  }
  return ordered;
}

/** Mirror of getOrderedTopAlbumIdsForUser at artist granularity. */
export async function getOrderedTopArtistIdsForUser(
  userId: string,
  refDate: Date,
): Promise<string[]> {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const { window, limit } of WINDOW_LIMITS) {
    const since = periodSince(window, refDate);
    const ids = await getTopArtistIdsForUser(userId, limit, since);
    for (const id of ids) {
      if (!seen.has(id)) {
        seen.add(id);
        ordered.push(id);
      }
    }
  }
  return ordered;
}

/** Album IDs derived from the user's top tracks, window-ordered. */
export async function getOrderedTopTrackAlbumIdsForUser(
  userId: string,
  refDate: Date,
): Promise<string[]> {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const { window, limit } of WINDOW_LIMITS) {
    const since = periodSince(window, refDate);
    const ids = await getTopTrackAlbumIdsForUser(userId, limit, since);
    for (const id of ids) {
      if (!seen.has(id)) {
        seen.add(id);
        ordered.push(id);
      }
    }
  }
  return ordered;
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test src/db/queries/enrich.test.ts
```

Expected: all tests pass (12 total).

- [ ] **Step 5: Commit**

```bash
git add src/db/queries/enrich.ts src/db/queries/enrich.test.ts
git commit -m "feat(enrich): getOrderedTop* helpers for window-priority order"
```

---

## Task 3: Refactor `enrichCatalogPriority` to preserve input ID order

**Files:**
- Modify: `worker/jobs/enrichCatalogPriority.ts`

- [ ] **Step 1: Read the current file structure**

```bash
cat worker/jobs/enrichCatalogPriority.ts | head -50
```

Note the existing 3 sweep blocks (albums, artists MBz, artists Deezer) - each currently iterates `unenrichedAlbums` / `unenrichedArtists` from the SELECT result, losing the input order.

- [ ] **Step 2: Refactor the album sweep to use Map + iterate input IDs**

Locate the existing block:

```ts
const unenrichedAlbums =
  albumIds.length === 0
    ? []
    : await db
        .select({
          albumId: albums.id,
          albumName: albums.name,
          artistName: artists.name,
        })
        .from(albums)
        .innerJoin(albumArtists, eq(albumArtists.albumId, albums.id))
        .innerJoin(artists, eq(artists.id, albumArtists.artistId))
        .where(and(inArray(albums.id, albumIds), isNull(albums.mbid)));

wlog.info({ albums: unenrichedAlbums.length }, "priority album sweep");

for (let i = 0; i < unenrichedAlbums.length; i++) {
  if (i > 0) await sleep(RATE_DELAY_MS);
  const row = unenrichedAlbums[i];
  try {
    await withMbzRetry(
      () => enrichAlbumByNames({
        albumId: row.albumId,
        artistName: row.artistName,
        albumName: row.albumName,
      }),
      wlog,
    );
    albumsEnriched++;
  } catch (err) {
    wlog.error(
      { err, msg: (err as Error)?.message, albumId: row.albumId },
      "priority album enrich failed",
    );
  }
}
```

Replace with:

```ts
const unenrichedAlbumRows =
  albumIds.length === 0
    ? []
    : await db
        .select({
          albumId: albums.id,
          albumName: albums.name,
          artistName: artists.name,
        })
        .from(albums)
        .innerJoin(albumArtists, eq(albumArtists.albumId, albums.id))
        .innerJoin(artists, eq(artists.id, albumArtists.artistId))
        .where(and(inArray(albums.id, albumIds), isNull(albums.mbid)));

// Build a lookup map so we can iterate `albumIds` (the caller's order)
// without losing the window-priority sequence the SELECT can't preserve.
const albumMap = new Map(unenrichedAlbumRows.map((a) => [a.albumId, a]));

wlog.info(
  { albums: albumMap.size, total: albumIds.length },
  "priority album sweep (window-ordered)",
);

let albumsProcessed = 0;
for (const id of albumIds) {
  const row = albumMap.get(id);
  if (!row) continue; // already enriched (mbid set) or row missing
  if (albumsProcessed > 0) await sleep(RATE_DELAY_MS);
  try {
    await withMbzRetry(
      () => enrichAlbumByNames({
        albumId: row.albumId,
        artistName: row.artistName,
        albumName: row.albumName,
      }),
      wlog,
    );
    albumsEnriched++;
  } catch (err) {
    wlog.error(
      { err, msg: (err as Error)?.message, albumId: row.albumId },
      "priority album enrich failed",
    );
  }
  albumsProcessed++;
}
```

- [ ] **Step 3: Refactor the artist MBz sweep the same way**

Locate:

```ts
const unenrichedArtists =
  artistIds.length === 0
    ? []
    : await db
        .select({ artistId: artists.id, name: artists.name })
        .from(artists)
        .where(and(inArray(artists.id, artistIds), isNull(artists.mbid)));

wlog.info({ artists: unenrichedArtists.length }, "priority artist mbz sweep");

for (let i = 0; i < unenrichedArtists.length; i++) {
  if (i > 0 || unenrichedAlbums.length > 0) await sleep(RATE_DELAY_MS);
  const row = unenrichedArtists[i];
  // ... existing code
}
```

Replace with:

```ts
const unenrichedArtistRows =
  artistIds.length === 0
    ? []
    : await db
        .select({ artistId: artists.id, name: artists.name })
        .from(artists)
        .where(and(inArray(artists.id, artistIds), isNull(artists.mbid)));

const mbzMap = new Map(unenrichedArtistRows.map((a) => [a.artistId, a]));

wlog.info(
  { artists: mbzMap.size, total: artistIds.length },
  "priority artist mbz sweep (window-ordered)",
);

let mbzProcessed = 0;
for (const id of artistIds) {
  const row = mbzMap.get(id);
  if (!row) continue;
  if (mbzProcessed > 0 || albumMap.size > 0) await sleep(RATE_DELAY_MS);
  try {
    await withMbzRetry(
      () => enrichArtistByName({ artistId: row.artistId, name: row.name }),
      wlog,
    );
    artistsEnriched++;
  } catch (err) {
    wlog.error(
      { err, msg: (err as Error)?.message, artistId: row.artistId },
      "priority artist mbz failed",
    );
  }
  mbzProcessed++;
}
```

- [ ] **Step 4: Refactor the Deezer image sweep the same way**

Locate:

```ts
const artistsForImages =
  artistIds.length === 0
    ? []
    : await db
        .select({ artistId: artists.id, name: artists.name })
        .from(artists)
        .where(
          and(
            inArray(artists.id, artistIds),
            isNull(artists.imageUrl),
            isNull(artists.deezerId),
          ),
        );

wlog.info({ artists: artistsForImages.length }, "priority image sweep (Deezer)");

for (let i = 0; i < artistsForImages.length; i++) {
  await sleep(RATE_DELAY_MS);
  const row = artistsForImages[i];
  try {
    await enrichArtistImageWithFallback({
      artistId: row.artistId,
      name: row.name,
    });
    imagesEnriched++;
  } catch (err) {
    wlog.error(
      { err, msg: (err as Error)?.message, artistId: row.artistId },
      "priority deezer image failed",
    );
  }
}
```

Replace with:

```ts
const artistImageRows =
  artistIds.length === 0
    ? []
    : await db
        .select({ artistId: artists.id, name: artists.name })
        .from(artists)
        .where(
          and(
            inArray(artists.id, artistIds),
            isNull(artists.imageUrl),
            isNull(artists.deezerId),
          ),
        );

const imageMap = new Map(artistImageRows.map((a) => [a.artistId, a]));

wlog.info(
  { artists: imageMap.size, total: artistIds.length },
  "priority image sweep (Deezer, window-ordered)",
);

let imageProcessed = 0;
for (const id of artistIds) {
  const row = imageMap.get(id);
  if (!row) continue;
  await sleep(RATE_DELAY_MS);
  try {
    await enrichArtistImageWithFallback({
      artistId: row.artistId,
      name: row.name,
    });
    imagesEnriched++;
  } catch (err) {
    wlog.error(
      { err, msg: (err as Error)?.message, artistId: row.artistId },
      "priority deezer image failed",
    );
  }
  imageProcessed++;
}
```

- [ ] **Step 5: Verify typecheck + tests**

```bash
pnpm tsc --noEmit 2>&1 | grep enrichCatalogPriority | head -3
pnpm test worker/jobs/enrichCatalogPriority.test.ts
```

Expected: 0 tsc errors, all tests pass (1 smoke + the empty-list test).

- [ ] **Step 6: Commit**

```bash
git add worker/jobs/enrichCatalogPriority.ts
git commit -m "refactor(worker): preserve input ID order in priority sweeps (Map lookup)"
```

---

## Task 4: Wire window-ordered enqueue into `importHistory.ts`

**Files:**
- Modify: `worker/jobs/importHistory.ts`

- [ ] **Step 1: Find the current enqueue block**

```bash
grep -n "enrichCatalogHotQueue\|getTopAlbumIdsForUser\|getTopArtistIdsForUser\|getTopTrackAlbumIdsForUser" worker/jobs/importHistory.ts
```

- [ ] **Step 2: Replace imports + the enqueue block**

Update the import block at the top of `worker/jobs/importHistory.ts`:

```ts
import {
  getOrderedTopAlbumIdsForUser,
  getOrderedTopArtistIdsForUser,
  getOrderedTopTrackAlbumIdsForUser,
} from "@/db/queries/enrich";
import { getUserLatestPlayedAt } from "@/db/queries/stats";
```

(Remove the old `getTopAlbumIdsForUser` / `getTopArtistIdsForUser` / `getTopTrackAlbumIdsForUser` imports - they stay exported but aren't used here anymore.)

Replace the enqueue block:

```ts
    // Priority enrich : top items in window-priority order (1w → 4w → 6m → 1y).
    // Tiered limits per window so the user sees this-week covers within
    // ~minutes of import, then the longer windows trickle in.
    try {
      const refDate = (await getUserLatestPlayedAt(userId)) ?? new Date();
      const [orderedAlbumIds, orderedTrackAlbumIds, orderedArtistIds] = await Promise.all([
        getOrderedTopAlbumIdsForUser(userId, refDate),
        getOrderedTopTrackAlbumIdsForUser(userId, refDate),
        getOrderedTopArtistIdsForUser(userId, refDate),
      ]);
      // Union preserves order : JS `Set` keeps insertion order.
      const albumIds = Array.from(new Set([...orderedAlbumIds, ...orderedTrackAlbumIds]));
      await enrichCatalogHotQueue.add(
        "enrich-priority",
        { userId, albumIds, artistIds: orderedArtistIds },
        { jobId: `enrich-priority:${userId}:${importId}` },
      );
    } catch (priorityErr) {
      wlog.error(
        { userId, err: priorityErr },
        "failed to enqueue priority enrich (background sweep will cover it)",
      );
    }
```

- [ ] **Step 3: Verify**

```bash
pnpm tsc --noEmit 2>&1 | grep importHistory | head -3
pnpm test worker/jobs/importHistory 2>&1 | tail -3
```

Expected: 0 tsc errors, no test regression.

- [ ] **Step 4: Commit**

```bash
git add worker/jobs/importHistory.ts
git commit -m "feat(import): enqueue priority with window-ordered IDs"
```

---

## Task 5: Update `scripts/enqueue-priority.ts` to match

**Files:**
- Modify: `scripts/enqueue-priority.ts`

- [ ] **Step 1: Read current**

```bash
cat scripts/enqueue-priority.ts
```

- [ ] **Step 2: Rewrite to use ordered helpers**

Replace the contents:

```ts
import { enrichCatalogHotQueue } from "../worker/queue";
import {
  getOrderedTopAlbumIdsForUser,
  getOrderedTopArtistIdsForUser,
  getOrderedTopTrackAlbumIdsForUser,
} from "../src/db/queries/enrich";
import { getUserLatestPlayedAt } from "../src/db/queries/stats";

async function main() {
  const userId = "606faa26-da96-4e7c-935d-2a803eaefc01";
  const refDate = (await getUserLatestPlayedAt(userId)) ?? new Date();
  const [orderedAlbumIds, orderedTrackAlbumIds, orderedArtistIds] = await Promise.all([
    getOrderedTopAlbumIdsForUser(userId, refDate),
    getOrderedTopTrackAlbumIdsForUser(userId, refDate),
    getOrderedTopArtistIdsForUser(userId, refDate),
  ]);
  const albumIds = Array.from(new Set([...orderedAlbumIds, ...orderedTrackAlbumIds]));
  console.log(
    `Ordered ${orderedAlbumIds.length} albums + ${orderedTrackAlbumIds.length} track-albums (union=${albumIds.length}) + ${orderedArtistIds.length} artists [refDate=${refDate.toISOString()}]`,
  );
  await enrichCatalogHotQueue.add(
    "enrich-priority",
    { userId, albumIds, artistIds: orderedArtistIds },
    { jobId: `enrich-priority:${userId}:manual-${Date.now()}` },
  );
  console.log("Enqueued enrich-priority (window-ordered)");
  process.exit(0);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
```

- [ ] **Step 3: Verify**

```bash
pnpm tsc --noEmit 2>&1 | grep enqueue-priority | head -3
pnpm exec dotenv -e .env.local -- tsx scripts/enqueue-priority.ts 2>&1 | head -5
```

Expected: 0 tsc errors. Script runs and prints the counts + "Enqueued enrich-priority".

(Don't worry if the worker is busy - the script just enqueues; the worker picks up when free.)

- [ ] **Step 4: Commit**

```bash
git add scripts/enqueue-priority.ts
git commit -m "chore(scripts): manual priority enqueue uses ordered helpers"
```

---

## Task 6: Final verification + push + merge to main

**Files:** none.

- [ ] **Step 1: Full verification**

```bash
pnpm tsc --noEmit 2>&1 | tail -3
pnpm test 2>&1 | grep -E "Test Files|Tests" | head -2
pnpm build 2>&1 | tail -8
```

Expected: 0 tsc errors, all tests pass, build success.

- [ ] **Step 2: Push branch**

```bash
git push -u origin <branch-name>
```

- [ ] **Step 3: Merge to main**

From `/Users/poney53/Documents/Projets/loopstat`:

```bash
git checkout main
git pull origin main
git merge --no-ff <branch-name> -m "Merge feat: window-priority enrich (1w → 4w → 6m → 1y order)

Priority enrich now loads covers in window-priority order so this-week
items are enriched first. Tiered limits 50/30/20/20 per window. Dedup
across windows. ~3-5 min priority sweep instead of ~3h."
git push origin main
```

- [ ] **Step 4: Restart worker + retrigger (manual verification)**

```bash
pkill -f "tsx watch worker" || true
sleep 3
pnpm worker > /tmp/worker.log 2>&1 &
sleep 8
pnpm exec dotenv -e .env.local -- tsx scripts/enqueue-priority.ts
sleep 30
tail -10 /tmp/worker.log
```

Expected: log shows `priority album sweep (window-ordered)` with a `total=N` matching the script's reported counts.

---

## Self-review

**1. Spec coverage:**

- ✅ Tiered limits 50/30/20/20 → Task 2 (`WINDOW_LIMITS`)
- ✅ Dedup between windows → Task 2 (`seen` Set in ordered helpers)
- ✅ Module `src/db/queries/enrich.ts` with `since` extension → Task 1
- ✅ 3 new `getOrderedTop*` functions → Task 2
- ✅ `refDate` via `getUserLatestPlayedAt` → Task 4 (import) + Task 5 (script)
- ✅ Wire-in `importHistory.ts` → Task 4
- ✅ Worker `enrichCatalogPriority` preserves order via Map lookup → Task 3
- ✅ Tests added → Tasks 1, 2
- ✅ Manual verification path → Task 6

**2. Placeholder scan:** No TBDs, all code blocks are complete, all commands have expected outputs.

**3. Type consistency:**
- `getTopAlbumIdsForUser(userId, limit, since?)` - same signature across Tasks 1, 2, 5
- `getOrderedTop*ForUser(userId, refDate)` - same 2-param signature in Tasks 2, 4, 5
- `albumMap`, `mbzMap`, `imageMap` - all `Map<string, RowType>` with `.get(id)` lookup pattern in Task 3
- `albumIds`/`artistIds` payload shape to BullMQ unchanged → no consumer change needed
