# Priority Enrich Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 3-tier enrichment : hot priority sweep (top 150 items per user, ~3 min), background long-tail sweep, on-demand single-item endpoint with Redis throttle.

**Architecture:** Two new BullMQ queues (`enrich-catalog-hot`, `enrich-catalog-single`). New worker jobs `enrichCatalogPriority` (batched IDs) + `enrichCatalogSingle` (one item). New API endpoint `/api/enrich-single` with Redis NX guard. Two new DB queries for top-IDs. Wire-in in `importHistory.ts` + select page handlers.

**Tech Stack:** Next.js 16 / BullMQ / Redis / Drizzle ORM / Postgres / vitest.

**Spec source:** [docs/superpowers/specs/2026-05-26-priority-enrich-design.md](docs/superpowers/specs/2026-05-26-priority-enrich-design.md) (commit `42967ab`).

**Worktree:** Création via `superpowers:using-git-worktrees`.

---

## Task 1: DB queries `getTopAlbumIdsForUser` + `getTopArtistIdsForUser`

**Files:**
- Create: `src/db/queries/enrich.ts`
- Create: `src/db/queries/enrich.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

describe("getTopAlbumIdsForUser", () => {
  it("returns empty array for non-existent user", async () => {
    const { getTopAlbumIdsForUser } = await import("./enrich");
    const ids = await getTopAlbumIdsForUser(
      "00000000-0000-0000-0000-000000000000",
      100,
    );
    expect(ids).toEqual([]);
  });

  it("returns shape string[]", async () => {
    const { getTopAlbumIdsForUser } = await import("./enrich");
    const ids = await getTopAlbumIdsForUser(
      "00000000-0000-0000-0000-000000000000",
      100,
    );
    const expectShape: string[] = ids;
    expect(Array.isArray(expectShape)).toBe(true);
  });
});

describe("getTopArtistIdsForUser", () => {
  it("returns empty array for non-existent user", async () => {
    const { getTopArtistIdsForUser } = await import("./enrich");
    const ids = await getTopArtistIdsForUser(
      "00000000-0000-0000-0000-000000000000",
      50,
    );
    expect(ids).toEqual([]);
  });

  it("returns shape string[]", async () => {
    const { getTopArtistIdsForUser } = await import("./enrich");
    const ids = await getTopArtistIdsForUser(
      "00000000-0000-0000-0000-000000000000",
      50,
    );
    const expectShape: string[] = ids;
    expect(Array.isArray(expectShape)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
pnpm test src/db/queries/enrich.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/db/queries/enrich.ts`:

```ts
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { albumArtists, albums, streams, tracks, trackArtists } from "@/db/schema";

const QUALIFYING_PLAY = sql`(${streams.msPlayed} >= 30000 OR ${streams.msPlayed} IS NULL)`;

/**
 * Top-N album IDs ranked by play count for `userId`. Used by the priority
 * enrich job to schedule visible-first cover fetches. No join with `albums`
 * table here — the worker only needs the IDs to filter its sweep.
 */
export async function getTopAlbumIdsForUser(
  userId: string,
  limit: number,
): Promise<string[]> {
  const rows = await db
    .select({ albumId: albums.id })
    .from(streams)
    .innerJoin(tracks, eq(tracks.id, streams.trackId))
    .innerJoin(albums, eq(albums.id, tracks.albumId))
    .where(and(eq(streams.userId, userId), QUALIFYING_PLAY))
    .groupBy(albums.id)
    .orderBy(desc(sql`count(${streams.id})`))
    .limit(limit);
  return rows.map((r) => r.albumId);
}

/**
 * Top-N artist IDs ranked by play count for `userId`. Mirror of the album
 * version at artist granularity.
 */
export async function getTopArtistIdsForUser(
  userId: string,
  limit: number,
): Promise<string[]> {
  const rows = await db
    .select({ artistId: trackArtists.artistId })
    .from(streams)
    .innerJoin(trackArtists, eq(trackArtists.trackId, streams.trackId))
    .where(and(eq(streams.userId, userId), QUALIFYING_PLAY))
    .groupBy(trackArtists.artistId)
    .orderBy(desc(sql`count(${streams.id})`))
    .limit(limit);
  return rows.map((r) => r.artistId);
}
```

- [ ] **Step 4: Verify**

```bash
pnpm test src/db/queries/enrich.test.ts
```

Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add src/db/queries/enrich.ts src/db/queries/enrich.test.ts
git commit -m "feat(enrich): add getTopAlbumIdsForUser + getTopArtistIdsForUser"
```

---

## Task 2: New BullMQ queues — hot + single

**Files:**
- Modify: `worker/queue.ts`

- [ ] **Step 1: Read current queue setup**

```bash
cat worker/queue.ts
```

Note the existing queue names + how `enrichCatalogQueue` is exported.

- [ ] **Step 2: Add the two new queues**

In `worker/queue.ts`, add (after existing queue exports):

```ts
export const ENRICH_CATALOG_HOT_QUEUE_NAME = "enrich-catalog-hot";

let __loopstatEnrichCatalogHotQueue: Queue | undefined;

export const enrichCatalogHotQueue: Queue = (() => {
  if (__loopstatEnrichCatalogHotQueue) return __loopstatEnrichCatalogHotQueue;
  __loopstatEnrichCatalogHotQueue = new Queue(ENRICH_CATALOG_HOT_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 86400, count: 100 },
      removeOnFail: { age: 86400 },
    },
  });
  return __loopstatEnrichCatalogHotQueue;
})();

export const ENRICH_CATALOG_SINGLE_QUEUE_NAME = "enrich-catalog-single";

let __loopstatEnrichCatalogSingleQueue: Queue | undefined;

export const enrichCatalogSingleQueue: Queue = (() => {
  if (__loopstatEnrichCatalogSingleQueue) return __loopstatEnrichCatalogSingleQueue;
  __loopstatEnrichCatalogSingleQueue = new Queue(ENRICH_CATALOG_SINGLE_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 3600, count: 50 },
      removeOnFail: { age: 3600 },
    },
  });
  return __loopstatEnrichCatalogSingleQueue;
})();
```

The cached IIFE pattern mirrors the existing `enrichCatalogQueue`.

- [ ] **Step 3: Verify typecheck**

```bash
pnpm tsc --noEmit 2>&1 | grep worker/queue | head -3
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add worker/queue.ts
git commit -m "feat(worker): add enrich-catalog-hot + enrich-catalog-single queues"
```

---

## Task 3: `enrichCatalogPriority` job

**Files:**
- Create: `worker/jobs/enrichCatalogPriority.ts`
- Create: `worker/jobs/enrichCatalogPriority.test.ts`

- [ ] **Step 1: Write the smoke test**

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));
vi.mock("@/lib/musicbrainz/catalog", () => ({
  enrichAlbumByNames: vi.fn(),
  enrichArtistByName: vi.fn(),
}));
vi.mock("@/lib/musicbrainz/client", () => ({ MusicBrainzError: class {} }));
vi.mock("@/lib/theaudiodb/catalog", () => ({
  enrichArtistImageByMbid: vi.fn(),
  enrichArtistImageByName: vi.fn(),
}));

afterEach(() => vi.restoreAllMocks());

describe("enrichCatalogPriority (smoke)", () => {
  it("exports the function", async () => {
    const mod = await import("./enrichCatalogPriority");
    expect(typeof mod.enrichCatalogPriority).toBe("function");
  });

  it("returns early when both lists are empty", async () => {
    const { enrichCatalogPriority } = await import("./enrichCatalogPriority");
    const result = await enrichCatalogPriority({
      userId: "u1",
      albumIds: [],
      artistIds: [],
    });
    expect(result.albumsEnriched).toBe(0);
    expect(result.artistsEnriched).toBe(0);
    expect(result.imagesEnriched).toBe(0);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
pnpm test worker/jobs/enrichCatalogPriority.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `worker/jobs/enrichCatalogPriority.ts`:

```ts
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { albums, albumArtists, artists } from "@/db/schema";
import { log } from "@/lib/log";
import { MusicBrainzError } from "@/lib/musicbrainz/client";
import {
  enrichAlbumByNames,
  enrichArtistByName,
} from "@/lib/musicbrainz/catalog";
import {
  enrichArtistImageByMbid,
  enrichArtistImageByName,
} from "@/lib/theaudiodb/catalog";

const SENTINEL_MBID = "00000000-0000-0000-0000-000000000000";
const RATE_DELAY_MS = 1100;
const MAX_TRANSIENT_RETRIES = 5;
const RETRY_BUFFER_MS = 1000;
const DEFAULT_RETRY_WAIT_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isTransientMbzError(err: unknown): boolean {
  if (err instanceof MusicBrainzError && err.status === 503) return true;
  if (err instanceof TypeError && /fetch failed/i.test(err.message)) return true;
  return false;
}

async function withMbzRetry<T>(
  fn: () => Promise<T>,
  wlog: ReturnType<typeof log.child>,
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (isTransientMbzError(err) && attempt < MAX_TRANSIENT_RETRIES) {
        const hinted = err instanceof MusicBrainzError ? err.retryAfterMs : undefined;
        const wait = (hinted ?? DEFAULT_RETRY_WAIT_MS) + RETRY_BUFFER_MS;
        attempt += 1;
        wlog.warn({ attempt, waitMs: wait }, "transient MBz, backing off");
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
}

export interface EnrichCatalogPriorityResult {
  albumsEnriched: number;
  artistsEnriched: number;
  imagesEnriched: number;
}

/**
 * Priority enrich pass for a specific user's top items. Unlike the global
 * sweep, this job operates on explicit album + artist IDs (typically the
 * user's top 100 albums + top 50 artists). Runs in ~3 min total at 1.1s/call,
 * so the user sees real covers on their dashboard within minutes of import.
 *
 * Cross-user dedup is automatic : if user A's hot job has already set
 * mbid on an album, this job's filter (`isNull(mbid)`) skips it.
 */
export async function enrichCatalogPriority({
  userId,
  albumIds,
  artistIds,
}: {
  userId: string;
  albumIds: string[];
  artistIds: string[];
}): Promise<EnrichCatalogPriorityResult> {
  const wlog = log.child({ job: "enrich-priority", userId });
  let albumsEnriched = 0;
  let artistsEnriched = 0;
  let imagesEnriched = 0;

  // Albums : filter to ones not yet enriched.
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
      // Don't throw — partial progress is fine for the priority pass.
    }
  }

  // Artists : same pattern.
  const unenrichedArtists =
    artistIds.length === 0
      ? []
      : await db
          .select({ artistId: artists.id, name: artists.name, mbid: artists.mbid })
          .from(artists)
          .where(and(inArray(artists.id, artistIds), isNull(artists.mbid)));

  wlog.info({ artists: unenrichedArtists.length }, "priority artist mbz sweep");

  for (let i = 0; i < unenrichedArtists.length; i++) {
    if (i > 0 || unenrichedAlbums.length > 0) await sleep(RATE_DELAY_MS);
    const row = unenrichedArtists[i];
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
  }

  // TheAudioDB images for the same artists (now that mbid is set).
  const artistsForImages =
    artistIds.length === 0
      ? []
      : await db
          .select({ artistId: artists.id, name: artists.name, mbid: artists.mbid })
          .from(artists)
          .where(
            and(
              inArray(artists.id, artistIds),
              isNull(artists.imageUrl),
              isNull(artists.tadbId),
            ),
          );

  wlog.info({ artists: artistsForImages.length }, "priority tadb image sweep");

  for (let i = 0; i < artistsForImages.length; i++) {
    await sleep(RATE_DELAY_MS);
    const row = artistsForImages[i];
    const hasRealMbid = row.mbid !== null && row.mbid !== SENTINEL_MBID;
    try {
      if (hasRealMbid) {
        await enrichArtistImageByMbid({ artistId: row.artistId, mbid: row.mbid! });
      } else {
        await enrichArtistImageByName({ artistId: row.artistId, name: row.name });
      }
      imagesEnriched++;
    } catch (err) {
      wlog.error(
        { err, msg: (err as Error)?.message, artistId: row.artistId },
        "priority tadb image failed",
      );
    }
  }

  wlog.info(
    { albumsEnriched, artistsEnriched, imagesEnriched },
    "priority enrich complete",
  );

  return { albumsEnriched, artistsEnriched, imagesEnriched };
}
```

- [ ] **Step 4: Verify**

```bash
pnpm test worker/jobs/enrichCatalogPriority.test.ts
```

Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add worker/jobs/enrichCatalogPriority.ts worker/jobs/enrichCatalogPriority.test.ts
git commit -m "feat(worker): add enrichCatalogPriority job (top items per user)"
```

---

## Task 4: Wire hot queue into worker/index.ts

**Files:**
- Modify: `worker/index.ts`

- [ ] **Step 1: Read current worker registration**

```bash
grep -A 5 "new Worker" worker/index.ts | head -30
```

- [ ] **Step 2: Add hot worker registration**

In `worker/index.ts`, after the existing `enrich-catalog` worker registration, add:

```ts
import { enrichCatalogPriority } from "./jobs/enrichCatalogPriority";
import { ENRICH_CATALOG_HOT_QUEUE_NAME } from "./queue";

new Worker(
  ENRICH_CATALOG_HOT_QUEUE_NAME,
  async (job) => {
    return enrichCatalogPriority(job.data);
  },
  { connection, concurrency: 2 },
);
log.info({ worker: ENRICH_CATALOG_HOT_QUEUE_NAME }, "worker ready");
```

(Adjust the `log.info` call to match the existing log pattern in the file.)

- [ ] **Step 3: Verify typecheck**

```bash
pnpm tsc --noEmit 2>&1 | grep worker/index | head -3
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add worker/index.ts
git commit -m "feat(worker): register enrich-catalog-hot worker (concurrency 2)"
```

---

## Task 5: Trigger priority enrich after import

**Files:**
- Modify: `worker/jobs/importHistory.ts`

- [ ] **Step 1: Find the existing enrich enqueue**

```bash
grep -n "enrichCatalogQueue" worker/jobs/importHistory.ts
```

- [ ] **Step 2: Add the priority enqueue right after**

After the existing `enrichCatalogQueue.add(...)` call, add:

```ts
// Priority enrich : top 100 albums + top 50 artists. Runs in ~3 min so the
// user sees real covers on their dashboard / tops shortly after import.
try {
  const [albumIds, artistIds] = await Promise.all([
    getTopAlbumIdsForUser(userId, 100),
    getTopArtistIdsForUser(userId, 50),
  ]);
  await enrichCatalogHotQueue.add(
    "enrich-priority",
    { userId, albumIds, artistIds },
    { jobId: `enrich-priority:${userId}:${importId}` },
  );
} catch (priorityErr) {
  wlog.error(
    { userId, err: priorityErr },
    "failed to enqueue priority enrich (background sweep will cover it)",
  );
}
```

Add imports at the top of the file:

```ts
import {
  getTopAlbumIdsForUser,
  getTopArtistIdsForUser,
} from "@/db/queries/enrich";
import { enrichCatalogHotQueue } from "../queue";
```

- [ ] **Step 3: Verify**

```bash
pnpm tsc --noEmit 2>&1 | grep importHistory | head -3
pnpm test worker/jobs/importHistory 2>&1 | tail -5
```

Expected: 0 errors, tests pass (if any).

- [ ] **Step 4: Commit**

```bash
git add worker/jobs/importHistory.ts
git commit -m "feat(import): enqueue priority enrich for top 100 albums + 50 artists"
```

---

## Task 6: `enrichCatalogSingle` job

**Files:**
- Create: `worker/jobs/enrichCatalogSingle.ts`
- Create: `worker/jobs/enrichCatalogSingle.test.ts`

- [ ] **Step 1: Write the smoke test**

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));
vi.mock("@/lib/musicbrainz/catalog", () => ({
  enrichAlbumByNames: vi.fn(),
  enrichArtistByName: vi.fn(),
}));
vi.mock("@/lib/theaudiodb/catalog", () => ({
  enrichArtistImageByMbid: vi.fn(),
  enrichArtistImageByName: vi.fn(),
}));

afterEach(() => vi.restoreAllMocks());

describe("enrichCatalogSingle (smoke)", () => {
  it("exports the function", async () => {
    const mod = await import("./enrichCatalogSingle");
    expect(typeof mod.enrichCatalogSingle).toBe("function");
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
pnpm test worker/jobs/enrichCatalogSingle.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `worker/jobs/enrichCatalogSingle.ts`:

```ts
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { albums, albumArtists, artists } from "@/db/schema";
import { log } from "@/lib/log";
import { enrichAlbumByNames } from "@/lib/musicbrainz/catalog";
import {
  enrichArtistImageByMbid,
  enrichArtistImageByName,
} from "@/lib/theaudiodb/catalog";

const SENTINEL_MBID = "00000000-0000-0000-0000-000000000000";

export interface EnrichCatalogSingleArgs {
  type: "album" | "artist";
  id: string;
}

/**
 * Enrich a single album or artist. Called from the on-demand `/api/enrich-
 * single` endpoint when a page handler detects a NULL image_url. Best-effort
 * — errors are logged, not rethrown (the queue's job retry handles transient
 * failures, but we don't want one bad item to spin forever).
 */
export async function enrichCatalogSingle({
  type,
  id,
}: EnrichCatalogSingleArgs): Promise<void> {
  const wlog = log.child({ job: "enrich-single", type, id });

  if (type === "album") {
    const [row] = await db
      .select({
        albumId: albums.id,
        albumName: albums.name,
        artistName: artists.name,
        mbid: albums.mbid,
      })
      .from(albums)
      .innerJoin(albumArtists, eq(albumArtists.albumId, albums.id))
      .innerJoin(artists, eq(artists.id, albumArtists.artistId))
      .where(eq(albums.id, id))
      .limit(1);

    if (!row) {
      wlog.warn("album not found");
      return;
    }
    if (row.mbid !== null) {
      wlog.info({ mbid: row.mbid }, "album already attempted");
      return;
    }

    await enrichAlbumByNames({
      albumId: row.albumId,
      albumName: row.albumName,
      artistName: row.artistName,
    });
    wlog.info("album enriched");
    return;
  }

  // type === "artist"
  const [row] = await db
    .select({ artistId: artists.id, name: artists.name, mbid: artists.mbid, tadbId: artists.tadbId })
    .from(artists)
    .where(eq(artists.id, id))
    .limit(1);

  if (!row) {
    wlog.warn("artist not found");
    return;
  }
  if (row.tadbId !== null) {
    wlog.info({ tadbId: row.tadbId }, "artist image already attempted");
    return;
  }

  const hasRealMbid = row.mbid !== null && row.mbid !== SENTINEL_MBID;
  if (hasRealMbid) {
    await enrichArtistImageByMbid({ artistId: row.artistId, mbid: row.mbid! });
  } else {
    await enrichArtistImageByName({ artistId: row.artistId, name: row.name });
  }
  wlog.info("artist image enriched");
}
```

- [ ] **Step 4: Verify**

```bash
pnpm test worker/jobs/enrichCatalogSingle.test.ts
```

Expected: PASS (1/1).

- [ ] **Step 5: Register worker in `worker/index.ts`**

After the hot worker registration, add:

```ts
import { enrichCatalogSingle } from "./jobs/enrichCatalogSingle";
import { ENRICH_CATALOG_SINGLE_QUEUE_NAME } from "./queue";

new Worker(
  ENRICH_CATALOG_SINGLE_QUEUE_NAME,
  async (job) => {
    return enrichCatalogSingle(job.data);
  },
  { connection, concurrency: 1 },
);
log.info({ worker: ENRICH_CATALOG_SINGLE_QUEUE_NAME }, "worker ready");
```

- [ ] **Step 6: Commit**

```bash
git add worker/jobs/enrichCatalogSingle.ts worker/jobs/enrichCatalogSingle.test.ts worker/index.ts
git commit -m "feat(worker): add enrichCatalogSingle job + worker"
```

---

## Task 7: API endpoint `/api/enrich-single`

**Files:**
- Create: `src/app/api/enrich-single/route.ts`
- Create: `src/app/api/enrich-single/route.test.ts`

- [ ] **Step 1: Check existing Redis client + queue access from API routes**

```bash
grep -rln "ioredis\|createClient\|new Redis" worker/ src/ 2>/dev/null | head -5
```

The worker uses ioredis via the queue connection. For the API route we need a Redis client to do the `SET NX EX` guard. Check if there's an existing `src/lib/redis.ts` or similar; if not, you'll add one.

- [ ] **Step 2: If no shared Redis client exists**

Create `src/lib/redis.ts`:

```ts
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

let __redis: Redis | undefined;

export function getRedis(): Redis {
  if (__redis) return __redis;
  __redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  return __redis;
}
```

If a `src/lib/redis.ts` already exists, reuse it.

- [ ] **Step 3: Implement the endpoint**

Create `src/app/api/enrich-single/route.ts`:

```ts
import { auth } from "@/auth";
import { getRedis } from "@/lib/redis";
import { enrichCatalogSingleQueue } from "../../../../worker/queue";

export const dynamic = "force-dynamic";

const THROTTLE_TTL_SECONDS = 600;
const VALID_TYPES = new Set(["album", "artist"]);

interface Body {
  type?: string;
  id?: string;
}

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const { type, id } = body;
  if (!type || !id || typeof type !== "string" || typeof id !== "string") {
    return Response.json({ error: "missing_fields" }, { status: 400 });
  }
  if (!VALID_TYPES.has(type)) {
    return Response.json({ error: "invalid_type" }, { status: 400 });
  }

  // Redis NX guard : if the same (type, id) was enqueued within the TTL,
  // skip. Prevents a thundering-herd of enqueue requests when 50 users open
  // the same album page simultaneously.
  const redis = getRedis();
  const guardKey = `enrich:${type}:${id}`;
  const guard = await redis.set(guardKey, "1", "EX", THROTTLE_TTL_SECONDS, "NX");
  if (guard !== "OK") {
    return Response.json({ ok: true, skipped: true, reason: "throttled" });
  }

  await enrichCatalogSingleQueue.add(
    "enrich-single",
    { type, id },
    { jobId: `enrich-single:${type}:${id}` },
  );

  return Response.json({ ok: true });
}
```

- [ ] **Step 4: Write the test**

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "u1" } })),
}));

const setMock = vi.fn();
vi.mock("@/lib/redis", () => ({
  getRedis: () => ({ set: setMock }),
}));

const addMock = vi.fn();
vi.mock("../../../../worker/queue", () => ({
  enrichCatalogSingleQueue: { add: addMock },
}));

afterEach(() => {
  setMock.mockReset();
  addMock.mockReset();
});

import { POST } from "./route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/enrich-single", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/enrich-single", () => {
  it("enqueues when guard returns OK", async () => {
    setMock.mockResolvedValue("OK");
    const res = await POST(jsonRequest({ type: "album", id: "alb_x" }));
    expect(res.status).toBe(200);
    expect(addMock).toHaveBeenCalledOnce();
  });

  it("skips when guard returns nil (already enqueued)", async () => {
    setMock.mockResolvedValue(null);
    const res = await POST(jsonRequest({ type: "album", id: "alb_x" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.skipped).toBe(true);
    expect(addMock).not.toHaveBeenCalled();
  });

  it("rejects invalid type", async () => {
    const res = await POST(jsonRequest({ type: "bogus", id: "x" }));
    expect(res.status).toBe(400);
    expect(addMock).not.toHaveBeenCalled();
  });

  it("rejects missing fields", async () => {
    const res = await POST(jsonRequest({}));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 5: Verify**

```bash
pnpm test src/app/api/enrich-single/route.test.ts
pnpm tsc --noEmit 2>&1 | grep enrich-single | head -5
```

Expected: 4/4 tests pass, 0 tsc errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/enrich-single src/lib/redis.ts
git commit -m "feat(api): /api/enrich-single endpoint with Redis NX throttle"
```

---

## Task 8: Wire on-demand on detail pages + verify

**Files:**
- Modify: `src/app/album/[id]/page.tsx`
- Modify: `src/app/artist/[id]/page.tsx`
- Modify: `src/app/track/[id]/page.tsx`

- [ ] **Step 1: Add a small helper for fire-and-forget enrich**

Create `src/lib/enrich/trigger.ts`:

```ts
import { enrichCatalogSingleQueue } from "../../../worker/queue";
import { getRedis } from "@/lib/redis";

const THROTTLE_TTL_SECONDS = 600;

/**
 * Server-side fire-and-forget enrich trigger. Called from page handlers
 * when a row's image_url is null. Honours the same Redis NX guard as the
 * /api/enrich-single endpoint to avoid thundering-herd on hot items.
 *
 * Errors are swallowed — this is best-effort, the render must not block.
 */
export async function triggerSingleEnrich(
  type: "album" | "artist",
  id: string,
): Promise<void> {
  try {
    const guard = await getRedis().set(
      `enrich:${type}:${id}`,
      "1",
      "EX",
      THROTTLE_TTL_SECONDS,
      "NX",
    );
    if (guard !== "OK") return;
    await enrichCatalogSingleQueue.add(
      "enrich-single",
      { type, id },
      { jobId: `enrich-single:${type}:${id}` },
    );
  } catch {
    // ignore — caller must not block on this
  }
}
```

- [ ] **Step 2: Wire in `/album/[id]/page.tsx`**

In the REAL-mode branch (not demo), after fetching the album row, before the return :

```ts
if (album && album.imageUrl === null) {
  // Fire-and-forget — don't await, don't block render.
  void triggerSingleEnrich("album", album.id);
}
```

Same pattern for `/artist/[id]/page.tsx` :

```ts
if (artist && artist.imageUrl === null) {
  void triggerSingleEnrich("artist", artist.id);
}
```

And for `/track/[id]/page.tsx` — the track's album image is what gets the placeholder. Trigger on the album's id, not the track's :

```ts
if (album && album.imageUrl === null) {
  void triggerSingleEnrich("album", album.id);
}
```

Add the import to each:

```ts
import { triggerSingleEnrich } from "@/lib/enrich/trigger";
```

- [ ] **Step 3: Verify**

```bash
pnpm tsc --noEmit 2>&1 | tail -3
pnpm test 2>&1 | grep -E "Test Files|Tests" | head -3
pnpm build 2>&1 | tail -10
```

Expected : 0 tsc errors, all tests pass, build success.

- [ ] **Step 4: Commit**

```bash
git add src/lib/enrich/trigger.ts src/app/album src/app/artist src/app/track
git commit -m "feat(detail): fire on-demand enrich when cover is missing"
```

---

## Task 9: Push + merge to main

**Files:** none.

- [ ] **Step 1: Push branch**

```bash
git push -u origin <branch-name>
```

- [ ] **Step 2: Merge to main**

From `/Users/poney53/Documents/Projets/loopstat`:

```bash
git checkout main
git pull origin main
git merge --no-ff <branch-name> -m "Merge feat: priority enrichment (3-tier)

Hot queue per-user (top 100 albums + 50 artists, ~3 min). Background
sweep for long-tail. On-demand /api/enrich-single endpoint with Redis
NX throttle. Cross-user dedup gratis via isNull(mbid) check."
git push origin main
```

---

## Self-review

- ✅ **Spec coverage** :
  - Hot queue + priority job → Tasks 2, 3
  - Background sweep (no change) → existing
  - Single queue + worker → Tasks 2, 6
  - On-demand API → Task 7
  - Detail page wiring → Task 8
  - Top IDs queries → Task 1
  - Import wire-in → Task 5
- ✅ **No placeholders** : all code blocks complete.
- ✅ **Type consistency** : `enrichCatalogPriority` args match enqueue payload in Task 5. `EnrichCatalogSingleArgs` matches the endpoint body shape in Task 7.
