# Sub-projet F — photos d'artistes via TheAudioDB : implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Récupérer les photos d'artistes via TheAudioDB et les afficher en place du gradient ArtistAvatar.

**Architecture:** Migration 0007 ajoute `artists.tadb_id` (sentinelle 0 pour "tenté, pas trouvé"). Nouveau module `src/lib/theaudiodb/` (client + search + catalog) mirror de MBz. Extension du worker `enrichCatalog` avec une 3e passe TheAudioDB après MBz. `ArtistAvatar` accepte `imageUrl` et tombe sur le gradient si null.

**Tech Stack:** TypeScript / Next.js 16 / Drizzle / Postgres / BullMQ / vitest (env: node). `fetch` natif pour TheAudioDB, dev key `2` (public), prod key gratuit sur sign-up.

**Spec source:** [docs/superpowers/specs/2026-05-19-artist-images-theaudiodb-design.md](docs/superpowers/specs/2026-05-19-artist-images-theaudiodb-design.md) (commit `bd49a90`).

**Worktree:** Exécution sur worktree `feat-artist-images` (créer via `superpowers:using-git-worktrees`).

---

## Task 1: Schema + migration 0007

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0007_add_artists_tadb_id.sql`
- Modify: `drizzle/meta/_journal.json`
- Create: `drizzle/meta/0007_snapshot.json`

- [ ] **Step 1: Update `src/db/schema.ts` — add tadbId column**

Locate the `artists` table block and add `tadbId` column + index :

```ts
export const artists = pgTable("artists", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  imageUrl: text("image_url"),
  mbid: uuid("mbid"),
  tadbId: integer("tadb_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  mbidIdx: index("artists_mbid_idx").on(t.mbid),
  tadbIdIdx: index("artists_tadb_id_idx").on(t.tadb_id),
}));
```

If `integer` is not already imported from `drizzle-orm/pg-core`, add it to the import list.

- [ ] **Step 2: Create migration SQL file**

Create `drizzle/0007_add_artists_tadb_id.sql` :

```sql
ALTER TABLE "artists" ADD COLUMN "tadb_id" integer;--> statement-breakpoint
CREATE INDEX "artists_tadb_id_idx" ON "artists" USING btree ("tadb_id");
```

- [ ] **Step 3: Update `drizzle/meta/_journal.json`**

Append a new entry after the existing 0006 entry :

```json
{
  "idx": 7,
  "version": "7",
  "when": 1779220000000,
  "tag": "0007_add_artists_tadb_id",
  "breakpoints": true
}
```

- [ ] **Step 4: Create snapshot 0007**

Copy 0006 snapshot then edit :

```bash
cp drizzle/meta/0006_snapshot.json drizzle/meta/0007_snapshot.json
```

Edit the new file :
- Change `"id"` to `"a1b2c3d4-e5f6-4a7b-8c9d-000000000007"`.
- Change `"prevId"` to `"a1b2c3d4-e5f6-4a7b-8c9d-000000000006"` (the previous `id`).
- In the `artists.columns` object, add a `tadb_id` entry :
  ```json
  "tadb_id": {
    "name": "tadb_id",
    "type": "integer",
    "primaryKey": false,
    "notNull": false
  }
  ```
- In the `artists.indexes` object, add :
  ```json
  "artists_tadb_id_idx": {
    "name": "artists_tadb_id_idx",
    "columns": [{ "expression": "tadb_id", "isExpression": false, "asc": true, "nulls": "last" }],
    "isUnique": false,
    "concurrently": false,
    "method": "btree",
    "with": {}
  }
  ```

(Mirror the existing `artists_mbid_idx` shape if unsure.)

- [ ] **Step 5: Apply migration**

```bash
pnpm db:migrate
```

Expected : `[✓] migrations applied successfully!`.

- [ ] **Step 6: Verify**

```bash
docker exec loopstat_postgres psql -U loopstat -d loopstat -c "\d artists"
```

Expected output : `tadb_id | integer` row + `artists_tadb_id_idx btree (tadb_id)` index.

- [ ] **Step 7: Commit**

```bash
git add src/db/schema.ts drizzle/0007_add_artists_tadb_id.sql drizzle/meta/
git commit -m "feat(db): add artists.tadb_id for TheAudioDB lookup tracking"
```

---

## Task 2: TheAudioDB client + tests

**Files:**
- Create: `src/lib/theaudiodb/client.ts`
- Create: `src/lib/theaudiodb/client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/theaudiodb/client.test.ts` :

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { tadbFetch, TheAudioDBError } from "./client";

afterEach(() => vi.restoreAllMocks());

describe("TheAudioDBError", () => {
  it("carries status + path + bodyText", () => {
    const err = new TheAudioDBError(503, "/artist-mb.php?i=x", "busy");
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(503);
    expect(err.path).toBe("/artist-mb.php?i=x");
    expect(err.bodyText).toBe("busy");
    expect(err.name).toBe("TheAudioDBError");
  });
});

describe("tadbFetch", () => {
  it("calls the URL with the API key in the path", async () => {
    vi.stubEnv("TADB_API_KEY", "test-key");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    await tadbFetch("/artist-mb.php?i=abc");
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe("https://www.theaudiodb.com/api/v1/json/test-key/artist-mb.php?i=abc");
  });

  it("defaults to key '2' when TADB_API_KEY is unset", async () => {
    vi.stubEnv("TADB_API_KEY", "");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    await tadbFetch("/search.php?s=x");
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toMatch(/\/json\/2\//);
  });

  it("throws TheAudioDBError on non-2xx", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 503 }),
    );
    await expect(tadbFetch("/artist-mb.php?i=x")).rejects.toThrow(TheAudioDBError);
  });

  it("returns parsed JSON on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ hello: "world" }), { status: 200 }),
    );
    const data = await tadbFetch<{ hello: string }>("/x");
    expect(data.hello).toBe("world");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test src/lib/theaudiodb/client.test.ts
```

Expected : FAIL — module not found.

- [ ] **Step 3: Implement `client.ts`**

Create `src/lib/theaudiodb/client.ts` :

```ts
export class TheAudioDBError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly bodyText: string,
  ) {
    super(`TheAudioDB ${path} failed: ${status}`);
    this.name = "TheAudioDBError";
  }
}

/**
 * Fetch a JSON resource from the TheAudioDB API v1.
 *
 * Reads `TADB_API_KEY` from env (defaults to "2", their public dev key — fine
 * in dev, rate-limited in prod, request a free key for production).
 *
 * Throws TheAudioDBError on non-2xx. No retry-after parsing — TheAudioDB doesn't
 * surface rate-limit headers; the caller paces via sleep().
 */
export async function tadbFetch<T>(path: string): Promise<T> {
  const apiKey = process.env.TADB_API_KEY || "2";
  const url = `https://www.theaudiodb.com/api/v1/json/${apiKey}${path}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new TheAudioDBError(res.status, path, bodyText);
  }

  return (await res.json()) as T;
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test src/lib/theaudiodb/client.test.ts
```

Expected : PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add src/lib/theaudiodb/client.ts src/lib/theaudiodb/client.test.ts
git commit -m "feat(tadb): add tadbFetch client with env-driven API key"
```

---

## Task 3: TheAudioDB search + tests

**Files:**
- Create: `src/lib/theaudiodb/search.ts`
- Create: `src/lib/theaudiodb/search.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/theaudiodb/search.test.ts` :

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupArtistByMbid, searchArtistByName } from "./search";

afterEach(() => vi.restoreAllMocks());

function mockFetch(body: unknown, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  );
}

describe("lookupArtistByMbid", () => {
  it("returns tadbId + thumbUrl on match", async () => {
    mockFetch({
      artists: [
        {
          idArtist: "111239",
          strArtist: "Coldplay",
          strArtistThumb: "https://r2.theaudiodb.com/thumb.jpg",
        },
      ],
    });
    expect(
      await lookupArtistByMbid({ mbid: "cc197bad-dc9c-440d-a5b5-d52ba2e14234" }),
    ).toEqual({ tadbId: 111239, thumbUrl: "https://r2.theaudiodb.com/thumb.jpg" });
  });

  it("returns null when artists is null", async () => {
    mockFetch({ artists: null });
    expect(
      await lookupArtistByMbid({ mbid: "x" }),
    ).toBeNull();
  });

  it("returns null when artists is empty array", async () => {
    mockFetch({ artists: [] });
    expect(
      await lookupArtistByMbid({ mbid: "x" }),
    ).toBeNull();
  });

  it("returns null thumbUrl when strArtistThumb is empty string", async () => {
    mockFetch({
      artists: [{ idArtist: "999", strArtistThumb: "" }],
    });
    expect(
      await lookupArtistByMbid({ mbid: "x" }),
    ).toEqual({ tadbId: 999, thumbUrl: null });
  });

  it("calls /artist-mb.php?i=<mbid>", async () => {
    const fetchMock = mockFetch({ artists: null });
    await lookupArtistByMbid({ mbid: "abc-123" });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/artist-mb.php?i=abc-123");
  });
});

describe("searchArtistByName", () => {
  it("returns tadbId + thumbUrl on match", async () => {
    mockFetch({
      artists: [
        { idArtist: "111239", strArtistThumb: "https://r2.theaudiodb.com/thumb.jpg" },
      ],
    });
    expect(await searchArtistByName({ name: "Coldplay" })).toEqual({
      tadbId: 111239,
      thumbUrl: "https://r2.theaudiodb.com/thumb.jpg",
    });
  });

  it("returns null when artists is null", async () => {
    mockFetch({ artists: null });
    expect(await searchArtistByName({ name: "Unknown" })).toBeNull();
  });

  it("URL-encodes the name", async () => {
    const fetchMock = mockFetch({ artists: null });
    await searchArtistByName({ name: "Beyoncé & Jay-Z" });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/search.php?s=Beyonc%C3%A9%20%26%20Jay-Z");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test src/lib/theaudiodb/search.test.ts
```

Expected : FAIL — module not found.

- [ ] **Step 3: Implement `search.ts`**

Create `src/lib/theaudiodb/search.ts` :

```ts
import { tadbFetch } from "./client";

interface RawArtist {
  idArtist?: string;
  strArtistThumb?: string;
}

interface ArtistSearchResponse {
  artists: RawArtist[] | null;
}

export interface TadbArtistMatch {
  tadbId: number;
  thumbUrl: string | null;
}

function parseTopArtist(data: ArtistSearchResponse): TadbArtistMatch | null {
  const top = data.artists?.[0];
  if (!top || !top.idArtist) return null;
  return {
    tadbId: parseInt(top.idArtist, 10),
    thumbUrl: top.strArtistThumb && top.strArtistThumb.length > 0 ? top.strArtistThumb : null,
  };
}

/**
 * Lookup TheAudioDB artist by MusicBrainz MBID. Most precise match — no name
 * ambiguity.
 */
export async function lookupArtistByMbid({ mbid }: { mbid: string }): Promise<TadbArtistMatch | null> {
  const data = await tadbFetch<ArtistSearchResponse>(`/artist-mb.php?i=${mbid}`);
  return parseTopArtist(data);
}

/**
 * Search TheAudioDB artist by name. Used as fallback when no MBz mbid is
 * available. TheAudioDB ranks by popularity ; we take the first result.
 */
export async function searchArtistByName({ name }: { name: string }): Promise<TadbArtistMatch | null> {
  const data = await tadbFetch<ArtistSearchResponse>(`/search.php?s=${encodeURIComponent(name)}`);
  return parseTopArtist(data);
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test src/lib/theaudiodb/search.test.ts
```

Expected : PASS (8/8).

- [ ] **Step 5: Commit**

```bash
git add src/lib/theaudiodb/search.ts src/lib/theaudiodb/search.test.ts
git commit -m "feat(tadb): add lookupArtistByMbid + searchArtistByName"
```

---

## Task 4: TheAudioDB catalog (DB upsert) + tests

**Files:**
- Create: `src/lib/theaudiodb/catalog.ts`
- Create: `src/lib/theaudiodb/catalog.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/theaudiodb/catalog.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as search from "./search";

vi.mock("@/db/client", () => ({
  db: { update: vi.fn() },
}));

const setMock = vi.fn().mockReturnThis();
const whereMock = vi.fn().mockResolvedValue(undefined);

beforeEach(async () => {
  const { db } = await import("@/db/client");
  (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
    set: setMock.mockReturnValue({ where: whereMock }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  setMock.mockClear();
  whereMock.mockClear();
});

import { enrichArtistImageByMbid, enrichArtistImageByName } from "./catalog";

describe("enrichArtistImageByMbid", () => {
  it("updates artist with tadbId + imageUrl on match", async () => {
    vi.spyOn(search, "lookupArtistByMbid").mockResolvedValue({
      tadbId: 111239,
      thumbUrl: "https://r2.theaudiodb.com/thumb.jpg",
    });

    await enrichArtistImageByMbid({ artistId: "art_x", mbid: "abc" });

    expect(setMock).toHaveBeenCalledWith({
      tadbId: 111239,
      imageUrl: "https://r2.theaudiodb.com/thumb.jpg",
    });
  });

  it("stores sentinel tadbId=0 when no match", async () => {
    vi.spyOn(search, "lookupArtistByMbid").mockResolvedValue(null);

    await enrichArtistImageByMbid({ artistId: "art_x", mbid: "abc" });

    expect(setMock).toHaveBeenCalledWith({ tadbId: 0 });
  });

  it("stores tadbId but null imageUrl when thumb missing", async () => {
    vi.spyOn(search, "lookupArtistByMbid").mockResolvedValue({
      tadbId: 999,
      thumbUrl: null,
    });

    await enrichArtistImageByMbid({ artistId: "art_x", mbid: "abc" });

    expect(setMock).toHaveBeenCalledWith({ tadbId: 999, imageUrl: null });
  });
});

describe("enrichArtistImageByName", () => {
  it("updates artist on match", async () => {
    vi.spyOn(search, "searchArtistByName").mockResolvedValue({
      tadbId: 555,
      thumbUrl: "https://r2.theaudiodb.com/t.jpg",
    });

    await enrichArtistImageByName({ artistId: "art_x", name: "Coldplay" });

    expect(setMock).toHaveBeenCalledWith({
      tadbId: 555,
      imageUrl: "https://r2.theaudiodb.com/t.jpg",
    });
  });

  it("stores sentinel on no match", async () => {
    vi.spyOn(search, "searchArtistByName").mockResolvedValue(null);

    await enrichArtistImageByName({ artistId: "art_x", name: "X" });

    expect(setMock).toHaveBeenCalledWith({ tadbId: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test src/lib/theaudiodb/catalog.test.ts
```

Expected : FAIL — module not found.

- [ ] **Step 3: Implement `catalog.ts`**

Create `src/lib/theaudiodb/catalog.ts` :

```ts
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { artists } from "@/db/schema";
import { lookupArtistByMbid, searchArtistByName } from "./search";

/**
 * Sentinel tadb_id stored when TheAudioDB returned no match. Distinguishes
 * "not yet attempted" (tadb_id IS NULL) from "tried and failed" (tadb_id = 0),
 * avoiding infinite re-attempts on the next worker sweep.
 */
const SENTINEL_TADB_ID = 0;

/**
 * Enrich an artist row's image via TheAudioDB, using its MusicBrainz MBID for
 * precise lookup. Updates artists.tadb_id + artists.image_url, or stores the
 * sentinel when no match is found.
 */
export async function enrichArtistImageByMbid({
  artistId,
  mbid,
}: {
  artistId: string;
  mbid: string;
}): Promise<void> {
  const match = await lookupArtistByMbid({ mbid });

  if (!match) {
    await db.update(artists).set({ tadbId: SENTINEL_TADB_ID }).where(eq(artists.id, artistId));
    return;
  }

  await db
    .update(artists)
    .set({ tadbId: match.tadbId, imageUrl: match.thumbUrl })
    .where(eq(artists.id, artistId));
}

/**
 * Enrich an artist row's image via TheAudioDB by name search. Fallback when
 * the artist has no MBz mbid. TheAudioDB ranks results by popularity ; we
 * take the first match.
 */
export async function enrichArtistImageByName({
  artistId,
  name,
}: {
  artistId: string;
  name: string;
}): Promise<void> {
  const match = await searchArtistByName({ name });

  if (!match) {
    await db.update(artists).set({ tadbId: SENTINEL_TADB_ID }).where(eq(artists.id, artistId));
    return;
  }

  await db
    .update(artists)
    .set({ tadbId: match.tadbId, imageUrl: match.thumbUrl })
    .where(eq(artists.id, artistId));
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test src/lib/theaudiodb/catalog.test.ts
```

Expected : PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add src/lib/theaudiodb/catalog.ts src/lib/theaudiodb/catalog.test.ts
git commit -m "feat(tadb): add enrichArtistImageByMbid + ByName helpers"
```

---

## Task 5: Extend `enrichCatalog` worker with TheAudioDB pass

**Files:**
- Modify: `worker/jobs/enrichCatalog.ts`

- [ ] **Step 1: Add imports**

At the top of `worker/jobs/enrichCatalog.ts`, add :

```ts
import {
  enrichArtistImageByMbid,
  enrichArtistImageByName,
} from "@/lib/musicbrainz/catalog";
```

Wait — that's wrong. The new helpers live in `@/lib/theaudiodb/catalog`. Use :

```ts
import {
  enrichArtistImageByMbid,
  enrichArtistImageByName,
} from "@/lib/theaudiodb/catalog";
```

Also add `isNull` and `and` to the existing `drizzle-orm` import if not present (they should be).

- [ ] **Step 2: Define sentinel constant**

In `worker/jobs/enrichCatalog.ts`, near the top of the file (after imports), add :

```ts
const SENTINEL_MBID = "00000000-0000-0000-0000-000000000000";
```

(This duplicates the constant in `@/lib/musicbrainz/catalog.ts` where it's not exported. Acceptable — it's a stable invariant.)

- [ ] **Step 3: Extend `EnrichCatalogResult` interface**

Find the interface :

```ts
export interface EnrichCatalogResult {
  albumsEnriched: number;
  artistsEnriched: number;
}
```

Replace with :

```ts
export interface EnrichCatalogResult {
  albumsEnriched: number;
  artistsEnriched: number;
  imagesEnriched: number;
}
```

- [ ] **Step 4: Add the third pass at the end of `enrichCatalog()`**

Locate the end of `enrichCatalog()`, just before the final log line `wlog.info({ albumsEnriched, artistsEnriched }, "enrich complete");`.

Replace the block from `// Artists : separate sweep` to the end of the function with :

```ts
  // Artists : separate sweep for MBz mbid.
  const unenrichedArtists = await db
    .select({ artistId: artists.id, name: artists.name })
    .from(artists)
    .where(isNull(artists.mbid));

  wlog.info({ artists: unenrichedArtists.length }, "artist sweep starting");

  let artistsEnriched = 0;
  for (let i = 0; i < unenrichedArtists.length; i++) {
    if (i > 0 || unenrichedAlbums.length > 0) await sleep(RATE_DELAY_MS);
    const row = unenrichedArtists[i];
    try {
      await enrichArtistByName({ artistId: row.artistId, name: row.name });
      artistsEnriched++;
    } catch (err) {
      wlog.error({ err, artistId: row.artistId }, "enrich artist failed");
      throw err;
    }
  }

  // TheAudioDB image sweep : artists without image_url and not yet tried (tadb_id IS NULL).
  const unenrichedImages = await db
    .select({ artistId: artists.id, name: artists.name, mbid: artists.mbid })
    .from(artists)
    .where(and(isNull(artists.imageUrl), isNull(artists.tadbId)));

  wlog.info({ artists: unenrichedImages.length }, "tadb image sweep starting");

  let imagesEnriched = 0;
  for (let i = 0; i < unenrichedImages.length; i++) {
    if (i > 0 || unenrichedArtists.length > 0 || unenrichedAlbums.length > 0) {
      await sleep(RATE_DELAY_MS);
    }
    const row = unenrichedImages[i];
    const hasRealMbid = row.mbid !== null && row.mbid !== SENTINEL_MBID;
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

  wlog.info(
    { albumsEnriched, artistsEnriched, imagesEnriched },
    "enrich complete",
  );
  return { albumsEnriched, artistsEnriched, imagesEnriched };
}
```

- [ ] **Step 5: Update `selfHealEnrichCatalog` to count tadb_id**

Locate `selfHealEnrichCatalog()`. Find the two count queries (albums + artists). Add a third :

```ts
  const [imgCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(artists)
    .where(and(isNull(artists.imageUrl), isNull(artists.tadbId)));
  const unenrichedImages = Number(imgCount?.n ?? 0);
```

Update the result type :

```ts
export interface SelfHealResult {
  unenrichedAlbums: number;
  unenrichedArtists: number;
  unenrichedImages: number;
  enqueued: boolean;
}
```

Update the "fully enriched" early return :

```ts
if (unenrichedAlbums === 0 && unenrichedArtists === 0 && unenrichedImages === 0) {
  slog.info("catalog fully enriched, no action");
  return { unenrichedAlbums, unenrichedArtists, unenrichedImages, enqueued: false };
}
```

Update all subsequent log + return statements to include `unenrichedImages`.

- [ ] **Step 6: Run typecheck**

```bash
pnpm tsc --noEmit 2>&1 | grep -E "worker/jobs/enrichCatalog" | head -10
```

Expected : 0 errors in `enrichCatalog.ts`.

- [ ] **Step 7: Run tests**

```bash
pnpm test worker/jobs/enrichCatalog.test.ts
```

Expected : PASS (existing 1/1 smoke test still works).

- [ ] **Step 8: Commit**

```bash
git add worker/jobs/enrichCatalog.ts
git commit -m "feat(worker): extend enrichCatalog with TheAudioDB image sweep"
```

---

## Task 6: Extend `ArtistAvatar` to accept `imageUrl`

**Files:**
- Modify: `src/components/ui/artist-avatar.tsx`

- [ ] **Step 1: Update the component**

Replace the contents of `src/components/ui/artist-avatar.tsx` :

```tsx
import { avatarGradient } from "@/lib/ui/avatar-color";

interface Props {
  name: string;
  imageUrl?: string | null;
  size?: number;
  className?: string;
}

/**
 * Avatar for an artist. Shows the real photo if `imageUrl` is provided,
 * otherwise falls back to a deterministic gradient circle with the artist's
 * initial. The gradient palette stays on-brand (violet/mauve nébuleuse).
 */
export function ArtistAvatar({ name, imageUrl, size = 48, className = "" }: Props) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
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

  const initial = (name.trim()[0] ?? "?").toUpperCase();
  const bg = avatarGradient(name);
  const fontSize = Math.round(size * 0.42);

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full text-white font-semibold ${className}`}
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize,
      }}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck + tests**

```bash
pnpm tsc --noEmit 2>&1 | grep -E "artist-avatar" | head -5
pnpm test src/lib/ui/avatar-color.test.ts
```

Expected : 0 errors. Avatar-color tests still pass (3/3).

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/artist-avatar.tsx
git commit -m "feat(ui): ArtistAvatar accepts imageUrl with gradient fallback"
```

---

## Task 7: Pass `imageUrl` through `RankedList` + callsites

**Files:**
- Modify: `src/components/stats/ranked-list.tsx`
- Modify: `src/app/top/artists/page.tsx`
- Modify: `src/app/artist/[id]/page.tsx`

- [ ] **Step 1: Inspect current `RankedList`/`RankedRow`**

```bash
grep -n "avatarName\|ArtistAvatar" src/components/stats/ranked-list.tsx
```

Note where `avatarName` is used and where `ArtistAvatar` is rendered.

- [ ] **Step 2: Add `avatarImageUrl` prop to `RankedRow`**

In `src/components/stats/ranked-list.tsx`, find the `RankedRow` props type. Add `avatarImageUrl?: string | null` to the props interface.

Find the `<ArtistAvatar name={avatarName} ... />` JSX (likely conditional on `avatarName && !imageUrl`). Update it to :

```tsx
<ArtistAvatar name={avatarName} imageUrl={avatarImageUrl ?? undefined} size={48} />
```

- [ ] **Step 3: Wire through `/top/artists`**

In `src/app/top/artists/page.tsx`, find the `RankedRow` JSX. Add `avatarImageUrl={artist.imageUrl}` next to `avatarName={artist.name}` :

```tsx
<RankedRow
  rank={index + 1}
  title={artist.name}
  href={`/artist/${artist.artistId}`}
  metric={`${formatNumber(artist.plays)} écoutes`}
  imageUrl={artist.imageUrl}
  avatarName={artist.name}
  avatarImageUrl={artist.imageUrl}
/>
```

(Both `imageUrl` and `avatarImageUrl` — the existing `imageUrl` prop should already work, but the avatar fallback now uses the same URL when present. If the `RankedRow` already renders `<img src={imageUrl}>` directly when set, no avatar is shown — passing `avatarImageUrl` is just a safety net.)

Do the same edit for any demo-mode branch in the same file.

- [ ] **Step 4: Update `/artist/[id]/page.tsx` hero**

In `src/app/artist/[id]/page.tsx`, find the artist hero placeholder. Replace any `<ArtistAvatar name={artist.name} size={192} />` (or equivalent placeholder div) with :

```tsx
<ArtistAvatar name={artist.name} imageUrl={artist.imageUrl} size={192} />
```

Do this for both demo and real branches.

- [ ] **Step 5: Run typecheck + tests**

```bash
pnpm tsc --noEmit 2>&1 | tail -3
pnpm test 2>&1 | grep -E "Test Files|Tests" | head -3
```

Expected : 0 errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/stats/ranked-list.tsx src/app/top/artists/page.tsx src/app/artist
git commit -m "feat(ui): wire artists.image_url through to ArtistAvatar"
```

---

## Task 8: Document `TADB_API_KEY` in `.env.example`

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add the env var**

Append to `.env.example` :

```
# TheAudioDB API key — '2' = dev key public (rate limit conservateur).
# Pour la prod : sign-up gratuit sur https://www.theaudiodb.com/api_guide.php
TADB_API_KEY=2
```

- [ ] **Step 2: Add to local `.env.local`**

```bash
echo "" >> .env.local
echo "TADB_API_KEY=2" >> .env.local
```

(Not committed — `.env.local` is gitignored.)

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore(env): document TADB_API_KEY"
```

---

## Task 9: Manual verification — trigger worker, observe images

**Files:** none

- [ ] **Step 1: Restart the worker**

If `pnpm worker` is running (background process from previous sessions), kill it and restart so it picks up the new code :

```bash
pkill -f "tsx watch worker/index.ts" 2>/dev/null
sleep 2
pnpm worker > /tmp/worker.log 2>&1 &
```

Wait ~5s, check :

```bash
tail -10 /tmp/worker.log
```

Expected : `enrich-catalog worker ready` + `scheduler registered`.

- [ ] **Step 2: Trigger enrich manually**

```bash
pnpm exec dotenv -e .env.local -- tsx scripts/enqueue-enrich.ts
```

Expected : `Enqueued enrich-catalog job`.

- [ ] **Step 3: Watch the worker log**

```bash
tail -f /tmp/worker.log
```

Expected sequence (over ~1-2 hours total) :
- `album sweep starting` (might be 0 if already done).
- `artist sweep starting` (might be 0 if already done).
- `tadb image sweep starting` with `artists=NNNN`.
- Eventually `enrich complete imagesEnriched=NN imagesSkipped=NN total=NN`.

After a few minutes you should see the first image_urls appearing in the DB :

```bash
docker exec loopstat_postgres psql -U loopstat -d loopstat -c \
  "SELECT name, tadb_id, image_url FROM artists WHERE image_url IS NOT NULL LIMIT 5;"
```

Expected : 5 rows with `image_url` like `https://r2.theaudiodb.com/images/media/artist/thumb/...jpg`.

- [ ] **Step 4: Visual verification**

Open `http://127.0.0.1:3000/top/artists` in a browser. Artists with `tadb_id` matched should show real photos. Others keep the gradient.

Open `http://127.0.0.1:3000/artist/<some-id>` for a known mainstream artist (e.g. Sabrina Carpenter). Hero should show photo.

- [ ] **Step 5: Match rate check**

After the sweep finishes :

```bash
docker exec loopstat_postgres psql -U loopstat -d loopstat -c "
SELECT
  count(*) FILTER (WHERE image_url IS NOT NULL) AS matched,
  count(*) FILTER (WHERE tadb_id = 0) AS not_found,
  count(*) FILTER (WHERE tadb_id IS NULL) AS pending,
  count(*) AS total
FROM artists;"
```

If matched / total < 50% on mainstream music → flag for follow-up (Wikipedia fallback in a future sub-projet).

---

## Task 10: Push + merge to main

**Files:** none

- [ ] **Step 1: Push the worktree branch**

```bash
git push -u origin <branch-name>
```

- [ ] **Step 2: Merge to main (from the main repo)**

From `/Users/poney53/Documents/Projets/loopstat` (main repo) :

```bash
git checkout main
git merge --no-ff <branch-name> -m "Merge feat/artist-images: TheAudioDB artist photos

Sub-projet F. Migration 0007 adds artists.tadb_id. New src/lib/theaudiodb/
module mirrors src/lib/musicbrainz/. enrichCatalog gains a 3rd sweep
for artist photos (1.1s/req). ArtistAvatar accepts imageUrl with
gradient fallback."
git push origin main
```

---

## Self-review

- ✅ **Spec coverage** : 
  - Migration 0007 → Task 1.
  - `src/lib/theaudiodb/` module → Tasks 2, 3, 4.
  - Worker extension → Task 5.
  - `ArtistAvatar` + callsites → Tasks 6, 7.
  - `TADB_API_KEY` env var → Task 8.
  - Manual verification → Task 9.
  - Push + merge → Task 10.
  - All spec sections covered.
- ✅ **Placeholders** : no TBD/TODO. All code blocks complete.
- ✅ **Type consistency** :
  - `tadbId` (camelCase TS) maps to `tadb_id` (snake_case DB) consistently.
  - `SENTINEL_TADB_ID = 0` mentioned in catalog.ts test, declared once.
  - `SENTINEL_MBID` referenced in worker extension matches the literal in MBz catalog (acceptable duplicate of a stable invariant).
  - `TadbArtistMatch` interface used consistently in search.ts and catalog.ts.
- ✅ **TDD** : Tasks 2, 3, 4 all follow strict TDD (write test → fail → impl → pass → commit).
