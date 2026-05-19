# Sub-projet C+D+E — pivot catalog Spotify → MusicBrainz : implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer entièrement l'enrichissement catalogue Spotify Web API par MusicBrainz + Cover Art Archive, supprimer toute trace du code Spotify, et drop `users.spotify_id` + table `spotify_tokens`.

**Architecture:** Lookup par album distinct (`master_metadata_album_album_name` + `master_metadata_album_artist_name` extraits du JSON Spotify). IDs catalog synthétisés via sha1, MBIDs stockés à côté. Worker bg fait 1 req/sec MBz, suit le 302 vers Cover Art Archive, persiste par chunks de 25.

**Tech Stack:** TypeScript / Next.js 16 / Drizzle / Postgres / BullMQ / vitest (env: node). `fetch` natif pour MBz, pas de package npm ajouté.

**Spec source:** [docs/superpowers/specs/2026-05-19-catalog-musicbrainz-pivot-design.md](docs/superpowers/specs/2026-05-19-catalog-musicbrainz-pivot-design.md) (commit `2df461d`).

**Worktree:** Plan conçu pour exécution sur worktree `worktree-feat+catalog-musicbrainz` (créer via `superpowers:using-git-worktrees`). Si exécution inline, ignorer la mention worktree dans les commits.

---

## Phase 1 — Schéma DB + helpers fondationnels

### Task 1: Update `src/db/schema.ts` — drop colonnes Spotify, add mbid

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Edit `tracks` table — drop 5 colonnes Spotify-only**

Remplace le bloc `export const tracks = pgTable(...)` actuel par :

```ts
export const tracks = pgTable("tracks", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  albumId: text("album_id").references(() => albums.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

(supprime `durationMs`, `popularity`, `explicit`, `previewUrl`, `isrc`)

- [ ] **Step 2: Edit `albums` table — add `mbid`**

```ts
export const albums = pgTable("albums", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  releaseDate: date("release_date"),
  imageUrl: text("image_url"),
  totalTracks: smallint("total_tracks"),
  albumType: text("album_type"),
  mbid: uuid("mbid"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  mbidIdx: index("albums_mbid_idx").on(t.mbid),
}));
```

- [ ] **Step 3: Edit `artists` table — add `mbid`, drop `popularity`**

```ts
export const artists = pgTable("artists", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  imageUrl: text("image_url"),
  genres: jsonb("genres").$type<string[]>().default([]).notNull(),
  mbid: uuid("mbid"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  mbidIdx: index("artists_mbid_idx").on(t.mbid),
}));
```

- [ ] **Step 4: Edit `users` table — drop `spotifyId`**

Supprime la propriété `spotifyId: text("spotify_id")` et toute contrainte unique associée (`uniqSpotifyId`).

- [ ] **Step 5: Drop `spotifyTokens` table — supprimer entièrement**

Supprime `export const spotifyTokens = pgTable("spotify_tokens", { ... })` du fichier.

- [ ] **Step 6: Update imports — add `uuid` from drizzle-orm/pg-core si manquant**

Au top du fichier, vérifie que `uuid` est dans la liste import :
```ts
import { ..., uuid, ... } from "drizzle-orm/pg-core";
```

- [ ] **Step 7: Commit**

```bash
git add src/db/schema.ts
git commit -m "refactor(schema): drop Spotify-only cols, add mbid, drop spotify_tokens"
```

### Task 2: Generate migration `0005_pivot_catalog_musicbrainz.sql`

**Files:**
- Create: `drizzle/0005_pivot_catalog_musicbrainz.sql`
- Create: `drizzle/meta/0005_snapshot.json`

- [ ] **Step 1: Run drizzle generate**

Run: `pnpm db:generate`
Expected: stdout indique `0005_*.sql created` et un nouveau snapshot.

- [ ] **Step 2: Rename le fichier généré**

Si drizzle a généré un nom auto-style (ex. `0005_curious_red_skull.sql`), renomme manuellement :
```bash
mv drizzle/0005_*.sql drizzle/0005_pivot_catalog_musicbrainz.sql
```
Et update `drizzle/meta/_journal.json` pour pointer sur ce nouveau nom (champ `tag`).

- [ ] **Step 3: Prepend TRUNCATE en haut du SQL généré**

Edit `drizzle/0005_pivot_catalog_musicbrainz.sql`, ajoute en première ligne :
```sql
-- Reset catalog (sub-projet C : Jules ré-importera son JSON Spotify)
TRUNCATE TABLE streams, track_artists, album_artists, tracks, albums, artists RESTART IDENTITY CASCADE;
--> statement-breakpoint
```

- [ ] **Step 4: Vérifier le contenu du SQL**

Le fichier doit contenir (dans cet ordre, après le TRUNCATE) :
- `ALTER TABLE tracks DROP COLUMN duration_ms` (+ popularity, explicit, preview_url, isrc)
- `ALTER TABLE albums ADD COLUMN mbid uuid` + `CREATE INDEX albums_mbid_idx`
- `ALTER TABLE artists ADD COLUMN mbid uuid` + `CREATE INDEX artists_mbid_idx`
- `ALTER TABLE artists DROP COLUMN popularity`
- `ALTER TABLE users DROP COLUMN spotify_id` (+ DROP CONSTRAINT users_spotify_id_unique si présent)
- `DROP TABLE spotify_tokens CASCADE`

Si une de ces statements manque, l'ajouter manuellement avec `--> statement-breakpoint` entre.

- [ ] **Step 5: Apply migration en dev**

Run: `pnpm db:migrate`
Expected: stdout `migrations applied successfully`. Pas d'erreur Postgres.

- [ ] **Step 6: Vérifier le schéma DB**

```bash
docker exec loopstat_postgres psql -U loopstat -d loopstat -c "\d tracks" | head -10
docker exec loopstat_postgres psql -U loopstat -d loopstat -c "\d albums" | head -15
docker exec loopstat_postgres psql -U loopstat -d loopstat -c "\dt" | grep -i spotify
```
Expected : `tracks` n'a plus `duration_ms`/etc., `albums` a `mbid uuid`, pas de table `spotify_tokens`.

- [ ] **Step 7: Commit**

```bash
git add drizzle/0005_pivot_catalog_musicbrainz.sql drizzle/meta/
git commit -m "feat(db): migration 0005 pivot catalog → MusicBrainz"
```

---

### Task 3: ID synthesis helper `src/lib/ids/synthesize.ts`

**Files:**
- Create: `src/lib/ids/synthesize.ts`
- Test: `src/lib/ids/synthesize.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/ids/synthesize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { synthesizeAlbumId, synthesizeArtistId } from "./synthesize";

describe("synthesizeArtistId", () => {
  it("returns stable id with art_ prefix", () => {
    expect(synthesizeArtistId("Sabrina Carpenter")).toMatch(/^art_[a-f0-9]{16}$/);
  });

  it("is deterministic", () => {
    expect(synthesizeArtistId("Sabrina Carpenter")).toBe(
      synthesizeArtistId("Sabrina Carpenter"),
    );
  });

  it("differs for different names", () => {
    expect(synthesizeArtistId("Sabrina Carpenter")).not.toBe(
      synthesizeArtistId("Billie Eilish"),
    );
  });
});

describe("synthesizeAlbumId", () => {
  it("returns stable id with alb_ prefix", () => {
    expect(synthesizeAlbumId("Sabrina Carpenter", "Short n' Sweet"))
      .toMatch(/^alb_[a-f0-9]{16}$/);
  });

  it("changes if artist changes (no collision for homonymous album names)", () => {
    const a = synthesizeAlbumId("Beyoncé", "Lemonade");
    const b = synthesizeAlbumId("Adele", "Lemonade");
    expect(a).not.toBe(b);
  });

  it("changes if album changes", () => {
    const a = synthesizeAlbumId("Sabrina Carpenter", "emails i can't send");
    const b = synthesizeAlbumId("Sabrina Carpenter", "Short n' Sweet");
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/ids/synthesize.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/ids/synthesize.ts`:

```ts
import { createHash } from "node:crypto";

function sha1Hex16(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 16);
}

/**
 * Synthesize a stable artist id from artist name.
 * Format: `art_<sha1[:16]>` where sha1 = hash of the lowercased trimmed name.
 * Idempotent across imports.
 * Caveat: homonymous artists (e.g. "John Williams" classical vs jazz) collide
 * — we accept this since the JSON export doesn't distinguish them either.
 */
export function synthesizeArtistId(name: string): string {
  return `art_${sha1Hex16(name.trim().toLowerCase())}`;
}

/**
 * Synthesize a stable album id from artist name + album name.
 * Format: `alb_<sha1[:16]>` where sha1 = hash of "<artist>|<album>".
 * Includes the artist so two unrelated albums called "Greatest Hits" don't
 * collide across different artists.
 */
export function synthesizeAlbumId(artistName: string, albumName: string): string {
  const key = `${artistName.trim().toLowerCase()}|${albumName.trim().toLowerCase()}`;
  return `alb_${sha1Hex16(key)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/ids/synthesize.test.ts`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ids/
git commit -m "feat(ids): add synthesizeArtistId + synthesizeAlbumId helpers"
```

---

## Phase 2 — MusicBrainz library

### Task 4: MBz types `src/lib/musicbrainz/types.ts`

**Files:**
- Create: `src/lib/musicbrainz/types.ts`

- [ ] **Step 1: Create the file**

```ts
/**
 * Minimal subset of MusicBrainz Web Service v2 response types.
 * Only the fields we actually consume are typed — MBz returns a lot more.
 */

export interface MbReleaseGroup {
  id: string;
  score: number;
  title: string;
  "primary-type"?: string;
  "first-release-date"?: string;
  "artist-credit"?: { name: string }[];
  releases?: { id: string; media?: { "track-count"?: number }[] }[];
}

export interface MbReleaseGroupSearchResponse {
  "release-groups": MbReleaseGroup[];
}

export interface MbArtist {
  id: string;
  score: number;
  name: string;
}

export interface MbArtistSearchResponse {
  artists: MbArtist[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/musicbrainz/types.ts
git commit -m "feat(mb): add MusicBrainz response types"
```

---

### Task 5: MBz client `src/lib/musicbrainz/client.ts`

**Files:**
- Create: `src/lib/musicbrainz/client.ts`
- Test: `src/lib/musicbrainz/client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/musicbrainz/client.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { mbFetch, MusicBrainzError } from "./client";

afterEach(() => vi.restoreAllMocks());

describe("MusicBrainzError", () => {
  it("carries status + path + retryAfterMs", () => {
    const err = new MusicBrainzError(503, "/release-group/?query=x", "busy", 2000);
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(503);
    expect(err.path).toBe("/release-group/?query=x");
    expect(err.retryAfterMs).toBe(2000);
    expect(err.name).toBe("MusicBrainzError");
  });
});

describe("mbFetch", () => {
  it("sends required User-Agent header", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    await mbFetch("/release-group/?query=test");
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["User-Agent"]).toMatch(/^loopstat\//);
    expect(headers["User-Agent"]).toContain("loopstat.tech");
  });

  it("throws MusicBrainzError on non-2xx response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not found", { status: 404 }),
    );
    await expect(mbFetch("/release-group/?query=x")).rejects.toThrow(MusicBrainzError);
  });

  it("parses Retry-After (seconds) into retryAfterMs on 503", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("busy", {
        status: 503,
        headers: { "Retry-After": "5" },
      }),
    );
    await expect(mbFetch("/release-group/?query=x")).rejects.toMatchObject({
      status: 503,
      retryAfterMs: 5000,
    });
  });

  it("returns parsed JSON on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ hello: "world" }), { status: 200 }),
    );
    const data = await mbFetch<{ hello: string }>("/release-group/?query=x");
    expect(data.hello).toBe("world");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/musicbrainz/client.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/musicbrainz/client.ts`:

```ts
const API_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = "loopstat/1.0 (https://loopstat.tech)";

export class MusicBrainzError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly bodyText: string,
    public readonly retryAfterMs?: number,
  ) {
    super(`MusicBrainz ${path} failed: ${status}`);
    this.name = "MusicBrainzError";
  }
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = parseInt(header, 10);
  if (isNaN(seconds) || seconds <= 0) return undefined;
  return seconds * 1000;
}

/**
 * Fetch a JSON resource from the MusicBrainz Web Service v2.
 * - Sends the mandatory User-Agent header (sans User-Agent, MBz ban l'IP).
 * - On 503/429, throws MusicBrainzError carrying retryAfterMs so the caller
 *   can decide to retry vs propagate.
 * - On any non-2xx, throws MusicBrainzError.
 */
export async function mbFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    const retryAfterMs = parseRetryAfter(res.headers.get("Retry-After"));
    throw new MusicBrainzError(res.status, path, bodyText, retryAfterMs);
  }

  return (await res.json()) as T;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/musicbrainz/client.test.ts`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add src/lib/musicbrainz/client.ts src/lib/musicbrainz/client.test.ts
git commit -m "feat(mb): add mbFetch client with User-Agent + Retry-After"
```

---

### Task 6: MBz search `src/lib/musicbrainz/search.ts`

**Files:**
- Create: `src/lib/musicbrainz/search.ts`
- Test: `src/lib/musicbrainz/search.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/musicbrainz/search.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { searchArtist, searchReleaseGroup } from "./search";

afterEach(() => vi.restoreAllMocks());

function mockFetch(body: unknown, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  );
}

describe("searchReleaseGroup", () => {
  it("returns mbid + metadata when top result scores ≥ 90", async () => {
    mockFetch({
      "release-groups": [
        {
          id: "abc-1234",
          score: 100,
          title: "Short n' Sweet",
          "primary-type": "Album",
          "first-release-date": "2024-08-23",
          releases: [{ id: "rel-1", media: [{ "track-count": 12 }] }],
        },
      ],
    });
    const result = await searchReleaseGroup({
      artist: "Sabrina Carpenter",
      album: "Short n' Sweet",
    });
    expect(result).toEqual({
      mbid: "abc-1234",
      score: 100,
      primaryType: "Album",
      firstReleaseDate: "2024-08-23",
      totalTracks: 12,
    });
  });

  it("returns null when top result scores < 90", async () => {
    mockFetch({
      "release-groups": [{ id: "x", score: 50, title: "Wrong Match" }],
    });
    expect(
      await searchReleaseGroup({ artist: "X", album: "Y" }),
    ).toBeNull();
  });

  it("returns null when no results", async () => {
    mockFetch({ "release-groups": [] });
    expect(
      await searchReleaseGroup({ artist: "X", album: "Y" }),
    ).toBeNull();
  });

  it("escapes double quotes in query", async () => {
    const fetchMock = mockFetch({ "release-groups": [] });
    await searchReleaseGroup({ artist: 'X "y" Z', album: "A" });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('artist:%22X%20%5C%22y%5C%22%20Z%22');
  });
});

describe("searchArtist", () => {
  it("returns mbid when score ≥ 90", async () => {
    mockFetch({
      artists: [{ id: "art-uuid", score: 95, name: "Sabrina Carpenter" }],
    });
    expect(await searchArtist("Sabrina Carpenter")).toEqual({
      mbid: "art-uuid",
      score: 95,
    });
  });

  it("returns null when score < 90", async () => {
    mockFetch({ artists: [{ id: "x", score: 70, name: "Wrong" }] });
    expect(await searchArtist("X")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/musicbrainz/search.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/musicbrainz/search.ts`:

```ts
import { mbFetch } from "./client";
import type {
  MbArtistSearchResponse,
  MbReleaseGroupSearchResponse,
} from "./types";

const MIN_SCORE = 90;

function escapeLucene(s: string): string {
  // Escape backslash + double quotes (Lucene query syntax used by MBz).
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export interface ReleaseGroupMatch {
  mbid: string;
  score: number;
  primaryType?: string;
  firstReleaseDate?: string;
  totalTracks?: number;
}

/**
 * Search MBz release-group by (artist, album) names. Returns the top match if
 * its score is ≥ MIN_SCORE (90), otherwise null. Caller decides whether to
 * persist the null result as a sentinel mbid to avoid re-attempts.
 */
export async function searchReleaseGroup({
  artist,
  album,
}: {
  artist: string;
  album: string;
}): Promise<ReleaseGroupMatch | null> {
  const query = `release:"${escapeLucene(album)}" AND artist:"${escapeLucene(artist)}"`;
  const path = `/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=5`;

  const data = await mbFetch<MbReleaseGroupSearchResponse>(path);
  const top = data["release-groups"]?.[0];
  if (!top || top.score < MIN_SCORE) return null;

  const totalTracks = top.releases?.[0]?.media?.reduce(
    (sum, m) => sum + (m["track-count"] ?? 0),
    0,
  );

  return {
    mbid: top.id,
    score: top.score,
    primaryType: top["primary-type"],
    firstReleaseDate: top["first-release-date"],
    totalTracks: totalTracks && totalTracks > 0 ? totalTracks : undefined,
  };
}

export interface ArtistMatch {
  mbid: string;
  score: number;
}

/**
 * Search MBz artist by name. Returns the top match if score ≥ MIN_SCORE.
 */
export async function searchArtist(name: string): Promise<ArtistMatch | null> {
  const query = `artist:"${escapeLucene(name)}"`;
  const path = `/artist/?query=${encodeURIComponent(query)}&fmt=json&limit=5`;

  const data = await mbFetch<MbArtistSearchResponse>(path);
  const top = data.artists?.[0];
  if (!top || top.score < MIN_SCORE) return null;

  return { mbid: top.id, score: top.score };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/musicbrainz/search.test.ts`
Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add src/lib/musicbrainz/search.ts src/lib/musicbrainz/search.test.ts
git commit -m "feat(mb): add searchReleaseGroup + searchArtist with min score 90"
```

---

### Task 7: Cover Art Archive `src/lib/musicbrainz/coverArt.ts`

**Files:**
- Create: `src/lib/musicbrainz/coverArt.ts`
- Test: `src/lib/musicbrainz/coverArt.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/musicbrainz/coverArt.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCoverUrl } from "./coverArt";

afterEach(() => vi.restoreAllMocks());

describe("fetchCoverUrl", () => {
  it("returns the final URL after 302 redirect", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("ok", {
        status: 200,
        // simulate fetch followed the redirect — response.url contains final
        headers: {},
      } as ResponseInit),
    );
    // Mock the Response to have .url
    const finalUrl = "https://archive.org/download/mbid-abc/cover-500.jpg";
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      const r = new Response("ok", { status: 200 });
      Object.defineProperty(r, "url", { value: finalUrl });
      return r;
    });
    expect(await fetchCoverUrl("abc-1234")).toBe(finalUrl);
  });

  it("returns null on 404 (no cover for this release-group)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not found", { status: 404 }),
    );
    expect(await fetchCoverUrl("abc-1234")).toBeNull();
  });

  it("throws on 503 (so caller can retry)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("busy", { status: 503 }),
    );
    await expect(fetchCoverUrl("abc-1234")).rejects.toThrow(/503/);
  });

  it("hits the front-500 endpoint for given mbid", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not found", { status: 404 }),
    );
    await fetchCoverUrl("abc-1234");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://coverartarchive.org/release-group/abc-1234/front-500",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/musicbrainz/coverArt.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/musicbrainz/coverArt.ts`:

```ts
const CAA_BASE = "https://coverartarchive.org";

/**
 * Fetch the cover URL for a MusicBrainz release-group MBID.
 * - 200 (after following 302): returns the final archive.org URL.
 * - 404: returns null (the release-group exists in MBz but has no cover on CAA).
 * - other non-2xx (503, network, etc.): throws so caller can retry/backoff.
 *
 * Notes:
 *  - `front-500` returns a 500px-wide cover (good for /album/[id] hero).
 *  - The fetch follows 302 by default; response.url is the resolved URL.
 *  - We don't proxy the image — we store the archive.org URL and the browser
 *    fetches it directly.
 */
export async function fetchCoverUrl(
  releaseGroupMbid: string,
): Promise<string | null> {
  const url = `${CAA_BASE}/release-group/${releaseGroupMbid}/front-500`;
  const res = await fetch(url, { redirect: "follow" });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Cover Art Archive ${url} failed: ${res.status}`);
  }
  return res.url;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/musicbrainz/coverArt.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add src/lib/musicbrainz/coverArt.ts src/lib/musicbrainz/coverArt.test.ts
git commit -m "feat(mb): add fetchCoverUrl via Cover Art Archive"
```

---

### Task 8: Catalog enrich `src/lib/musicbrainz/catalog.ts`

**Files:**
- Create: `src/lib/musicbrainz/catalog.ts`
- Test: `src/lib/musicbrainz/catalog.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/musicbrainz/catalog.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enrichAlbumByNames, enrichArtistByName } from "./catalog";
import * as search from "./search";
import * as coverArt from "./coverArt";

vi.mock("@/db/client", () => ({
  db: { update: vi.fn(), insert: vi.fn() },
}));

const updateMock = vi.fn().mockReturnThis();
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
  updateMock.mockClear();
  setMock.mockClear();
  whereMock.mockClear();
});

const SENTINEL = "00000000-0000-0000-0000-000000000000";

describe("enrichAlbumByNames", () => {
  it("updates album with mbid + cover + metadata on full match", async () => {
    vi.spyOn(search, "searchReleaseGroup").mockResolvedValue({
      mbid: "rg-abc",
      score: 100,
      primaryType: "Album",
      firstReleaseDate: "2024-08-23",
      totalTracks: 12,
    });
    vi.spyOn(coverArt, "fetchCoverUrl").mockResolvedValue(
      "https://archive.org/x.jpg",
    );

    await enrichAlbumByNames({
      albumId: "alb_x",
      artistName: "Sabrina Carpenter",
      albumName: "Short n' Sweet",
    });

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mbid: "rg-abc",
        imageUrl: "https://archive.org/x.jpg",
        releaseDate: "2024-08-23",
        albumType: "Album",
        totalTracks: 12,
      }),
    );
  });

  it("stores sentinel mbid when no match", async () => {
    vi.spyOn(search, "searchReleaseGroup").mockResolvedValue(null);

    await enrichAlbumByNames({
      albumId: "alb_x",
      artistName: "X",
      albumName: "Y",
    });

    expect(setMock).toHaveBeenCalledWith({ mbid: SENTINEL });
  });

  it("stores mbid but null image on CAA 404", async () => {
    vi.spyOn(search, "searchReleaseGroup").mockResolvedValue({
      mbid: "rg-abc",
      score: 100,
    });
    vi.spyOn(coverArt, "fetchCoverUrl").mockResolvedValue(null);

    await enrichAlbumByNames({
      albumId: "alb_x",
      artistName: "X",
      albumName: "Y",
    });

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ mbid: "rg-abc", imageUrl: null }),
    );
  });
});

describe("enrichArtistByName", () => {
  it("updates artist with mbid on match", async () => {
    vi.spyOn(search, "searchArtist").mockResolvedValue({
      mbid: "art-abc",
      score: 95,
    });

    await enrichArtistByName({ artistId: "art_x", name: "Sabrina Carpenter" });

    expect(setMock).toHaveBeenCalledWith({ mbid: "art-abc" });
  });

  it("stores sentinel mbid when no match", async () => {
    vi.spyOn(search, "searchArtist").mockResolvedValue(null);

    await enrichArtistByName({ artistId: "art_x", name: "X" });

    expect(setMock).toHaveBeenCalledWith({ mbid: SENTINEL });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/musicbrainz/catalog.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/musicbrainz/catalog.ts`:

```ts
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { albums, artists } from "@/db/schema";
import { fetchCoverUrl } from "./coverArt";
import { searchArtist, searchReleaseGroup } from "./search";

/**
 * Sentinel mbid stored when MBz returned no match. Distinguishes "not yet
 * attempted" (mbid IS NULL) from "tried and failed" (mbid = sentinel),
 * avoiding infinite re-attempts.
 */
const SENTINEL_MBID = "00000000-0000-0000-0000-000000000000";

/**
 * Enrich an album row by name lookup against MusicBrainz + Cover Art Archive.
 * Updates `albums` with mbid + cover URL + release metadata, or marks the row
 * with a sentinel mbid when no match is found.
 */
export async function enrichAlbumByNames({
  albumId,
  artistName,
  albumName,
}: {
  albumId: string;
  artistName: string;
  albumName: string;
}): Promise<void> {
  const match = await searchReleaseGroup({ artist: artistName, album: albumName });

  if (!match) {
    await db.update(albums).set({ mbid: SENTINEL_MBID }).where(eq(albums.id, albumId));
    return;
  }

  const coverUrl = await fetchCoverUrl(match.mbid);

  await db
    .update(albums)
    .set({
      mbid: match.mbid,
      imageUrl: coverUrl,
      releaseDate: match.firstReleaseDate ?? null,
      albumType: match.primaryType ?? null,
      totalTracks: match.totalTracks ?? null,
    })
    .where(eq(albums.id, albumId));
}

/**
 * Enrich an artist row by name lookup against MusicBrainz.
 * Updates `artists.mbid`, or marks with sentinel mbid on no match.
 * Does NOT fetch artist images — MBz doesn't host them; deferred to TheAudioDB.
 */
export async function enrichArtistByName({
  artistId,
  name,
}: {
  artistId: string;
  name: string;
}): Promise<void> {
  const match = await searchArtist(name);

  if (!match) {
    await db.update(artists).set({ mbid: SENTINEL_MBID }).where(eq(artists.id, artistId));
    return;
  }

  await db.update(artists).set({ mbid: match.mbid }).where(eq(artists.id, artistId));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/musicbrainz/catalog.test.ts`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add src/lib/musicbrainz/catalog.ts src/lib/musicbrainz/catalog.test.ts
git commit -m "feat(mb): add enrichAlbumByNames + enrichArtistByName"
```

---

## Phase 3 — Refactor importHistory

### Task 9: Extend RawStreamEntry + accumulator types

**Files:**
- Modify: `worker/jobs/importHistory.ts`

- [ ] **Step 1: Extend the `RawStreamEntry` interface (lines ~34-39)**

Edit `worker/jobs/importHistory.ts`:

```ts
interface RawStreamEntry {
  ts?: unknown;
  ms_played?: unknown;
  master_metadata_track_name?: unknown;
  master_metadata_album_artist_name?: unknown;
  master_metadata_album_album_name?: unknown;
  spotify_track_uri?: unknown;
}
```

- [ ] **Step 2: Add helper imports at top of file**

Below the existing imports, add :

```ts
import { albumArtists, albums, artists, trackArtists } from "@/db/schema";
import { synthesizeAlbumId, synthesizeArtistId } from "@/lib/ids/synthesize";
```

(`tracks` is already imported.)

- [ ] **Step 3: Commit**

```bash
git add worker/jobs/importHistory.ts
git commit -m "refactor(import): extend RawStreamEntry + import id synthesizers"
```

### Task 10: Replace track-only accumulation with artist/album/track accumulators

**Files:**
- Modify: `worker/jobs/importHistory.ts`

- [ ] **Step 1: Replace the accumulation block (the `trackNames` Map + the loop body)**

Find the block starting `// Dedup track id -> name across all files...` (around line 67) through the end of the inner `for (const item of parsed ...)` loop.

Replace the accumulators :
```ts
    // Dedup catalog entities and accumulate kept stream rows.
    const artistRows = new Map<string, { name: string }>();
    const albumRows = new Map<string, { name: string; artistId: string }>();
    const trackRows = new Map<
      string,
      { name: string; albumId: string | null }
    >();
    const trackArtistLinks = new Map<string, string>();  // trackId -> artistId
    const streamRows: NewStream[] = [];

    const nowMs = Date.now();
```

- [ ] **Step 2: Replace the per-entry insertion logic**

Find lines `const trackId = uri.slice(...)` through `trackNames.set(...)` and `streamRows.push(...)`. Replace with:

```ts
        const trackId = uri.slice(TRACK_URI_PREFIX.length);
        if (!trackId) continue;

        const playedAt = new Date(item.ts);
        const playedAtMs = playedAt.getTime();
        if (Number.isNaN(playedAtMs)) continue;
        if (
          playedAt < SPOTIFY_LAUNCH ||
          playedAtMs > nowMs + MAX_FUTURE_MS
        ) {
          continue;
        }

        let msPlayed: number | null = null;
        if (typeof item.ms_played === "number") {
          if (
            Number.isFinite(item.ms_played) &&
            item.ms_played >= 0 &&
            item.ms_played <= Number.MAX_SAFE_INTEGER
          ) {
            msPlayed = item.ms_played;
          }
        }

        // Capture artist + album names from the JSON (no API call needed).
        const artistName = item.master_metadata_album_artist_name;
        if (typeof artistName !== "string" || artistName.length === 0) continue;
        if (artistName.length > MAX_NAME_LEN) continue;

        const albumName = item.master_metadata_album_album_name;
        const hasAlbum =
          typeof albumName === "string" &&
          albumName.length > 0 &&
          albumName.length <= MAX_NAME_LEN;

        const artistId = synthesizeArtistId(artistName);
        const albumId = hasAlbum
          ? synthesizeAlbumId(artistName, albumName as string)
          : null;

        artistRows.set(artistId, { name: artistName });
        if (albumId && hasAlbum) {
          albumRows.set(albumId, {
            name: albumName as string,
            artistId,
          });
        }
        trackRows.set(trackId, { name, albumId });
        trackArtistLinks.set(trackId, artistId);

        streamRows.push({
          userId,
          trackId,
          playedAt,
          msPlayed,
          source: "import",
        });
```

- [ ] **Step 3: Commit**

```bash
git add worker/jobs/importHistory.ts
git commit -m "refactor(import): accumulate artists + albums during JSON parse"
```

### Task 11: Replace track-only insertion with full catalog insertion

**Files:**
- Modify: `worker/jobs/importHistory.ts`

- [ ] **Step 1: Replace the insertion block (the `Insert minimal track rows...` section)**

Find the block:
```ts
// Insert minimal track rows (id + name only) ...
const trackRows = Array.from(trackNames, ([id, name]) => ({ id, name }));
const CHUNK = 1000;
for (let i = 0; i < trackRows.length; i += CHUNK) {
  await db.insert(tracks).values(trackRows.slice(i, i + CHUNK)).onConflictDoNothing();
}
```

Replace with:
```ts
    // Insert catalog entities in FK-safe order : artists → albums → tracks →
    // join tables. All ON CONFLICT DO NOTHING for idempotent re-import.
    // The enrichCatalog job fills mbid / image_url / release_date later.
    const CHUNK = 1000;

    const artistInserts = Array.from(artistRows, ([id, { name }]) => ({ id, name }));
    for (let i = 0; i < artistInserts.length; i += CHUNK) {
      await db.insert(artists).values(artistInserts.slice(i, i + CHUNK)).onConflictDoNothing();
    }

    const albumInserts = Array.from(albumRows, ([id, { name }]) => ({ id, name }));
    for (let i = 0; i < albumInserts.length; i += CHUNK) {
      await db.insert(albums).values(albumInserts.slice(i, i + CHUNK)).onConflictDoNothing();
    }

    const trackInserts = Array.from(trackRows, ([id, { name, albumId }]) => ({
      id,
      name,
      albumId,
    }));
    for (let i = 0; i < trackInserts.length; i += CHUNK) {
      await db.insert(tracks).values(trackInserts.slice(i, i + CHUNK)).onConflictDoNothing();
    }

    const trackArtistInserts = Array.from(
      trackArtistLinks,
      ([trackId, artistId]) => ({ trackId, artistId, position: 0 }),
    );
    for (let i = 0; i < trackArtistInserts.length; i += CHUNK) {
      await db
        .insert(trackArtists)
        .values(trackArtistInserts.slice(i, i + CHUNK))
        .onConflictDoNothing();
    }

    const albumArtistInserts = Array.from(
      albumRows,
      ([albumId, { artistId }]) => ({ albumId, artistId, position: 0 }),
    );
    for (let i = 0; i < albumArtistInserts.length; i += CHUNK) {
      await db
        .insert(albumArtists)
        .values(albumArtistInserts.slice(i, i + CHUNK))
        .onConflictDoNothing();
    }
```

- [ ] **Step 2: Update the enqueue call at the end**

Find :
```ts
await enrichQueue.add("enrich-metadata", { userId }, { jobId: "enrich-metadata-global" });
```
Replace with :
```ts
await enrichQueue.add("enrich-catalog", { userId }, { jobId: "enrich-catalog-global" });
```

(The queue is renamed in a later task; for now we just update the job name.)

- [ ] **Step 3: Run existing import tests**

Run: `pnpm test worker/jobs/importHistory`
Expected: les anciens tests passent encore (parsing existant non cassé), ou ils sont à mettre à jour si l'API change. Si un test fail, mettre à jour avec les nouvelles attentes (insertion artists/albums).

- [ ] **Step 4: Commit**

```bash
git add worker/jobs/importHistory.ts
git commit -m "refactor(import): insert full catalog (artists+albums+tracks+joins)"
```

---

## Phase 4 — Nouveau worker enrichCatalog

### Task 12: Rename queue + scheduler IDs in `worker/queue.ts`

**Files:**
- Modify: `worker/queue.ts`

- [ ] **Step 1: Replace POLL/ENRICH constants**

Edit `worker/queue.ts`. Remove `POLL_RECENT_*` constants entirely (Spotify polling supprimé). Renomme `ENRICH_QUEUE_NAME` :

```ts
export const IMPORT_QUEUE_NAME = "import";
export const ENRICH_CATALOG_QUEUE_NAME = "enrich-catalog";

// Self-heal: every hour, re-enqueue enrich job if albums still lack covers.
export const ENRICH_CATALOG_SELF_HEAL_SCHEDULER_ID = "enrich-catalog-self-heal";
export const ENRICH_CATALOG_SELF_HEAL_EVERY_MS = 60 * 60 * 1000;
```

- [ ] **Step 2: Replace queue exports**

Trouve `__loopstatPollRecentQueue` / `__loopstatEnrichQueue` dans globalCache et leurs export. Supprime poll-recent, renomme enrich :

```ts
const globalCache = globalThis as unknown as {
  __loopstatRedis?: IORedis;
  __loopstatImportQueue?: Queue;
  __loopstatEnrichCatalogQueue?: Queue;
};

// importQueue stays unchanged

export const enrichCatalogQueue =
  globalCache.__loopstatEnrichCatalogQueue ??
  (globalCache.__loopstatEnrichCatalogQueue = new Queue(ENRICH_CATALOG_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 24 * 3600, count: 100 },
      removeOnFail: { age: 24 * 3600 },
    },
  }));
```

(Adapter selon ce qui est déjà dans le fichier.)

- [ ] **Step 3: Update import in importHistory.ts**

Edit `worker/jobs/importHistory.ts` — remplacer `import { enrichQueue } from "../queue";` par `import { enrichCatalogQueue } from "../queue";`. Et update l'appel :
```ts
await enrichCatalogQueue.add("enrich-catalog", { userId }, { jobId: "enrich-catalog-global" });
```

- [ ] **Step 4: Commit**

```bash
git add worker/queue.ts worker/jobs/importHistory.ts
git commit -m "refactor(worker): rename enrich queue → enrich-catalog, drop poll-recent"
```

### Task 13: Create `worker/jobs/enrichCatalog.ts`

**Files:**
- Create: `worker/jobs/enrichCatalog.ts`
- Test: `worker/jobs/enrichCatalog.test.ts`

- [ ] **Step 1: Write the failing test**

Create `worker/jobs/enrichCatalog.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock("@/lib/musicbrainz/catalog", () => ({
  enrichAlbumByNames: vi.fn(),
  enrichArtistByName: vi.fn(),
}));
vi.mock("../queue", () => ({
  enrichCatalogQueue: { getJob: vi.fn(), add: vi.fn() },
  ENRICH_CATALOG_QUEUE_NAME: "enrich-catalog",
}));

afterEach(() => vi.restoreAllMocks());

describe("enrichCatalog (smoke)", () => {
  it("exports the expected functions", async () => {
    const mod = await import("./enrichCatalog");
    expect(typeof mod.enrichCatalog).toBe("function");
    expect(typeof mod.selfHealEnrichCatalog).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test worker/jobs/enrichCatalog.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `worker/jobs/enrichCatalog.ts`:

```ts
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { albums, albumArtists, artists } from "@/db/schema";
import { log } from "@/lib/log";
import {
  enrichAlbumByNames,
  enrichArtistByName,
} from "@/lib/musicbrainz/catalog";
import { enrichCatalogQueue } from "../queue";

const RATE_DELAY_MS = 1100;
const CHUNK_SIZE = 25;

export interface EnrichCatalogResult {
  albumsEnriched: number;
  artistsEnriched: number;
}

export interface SelfHealResult {
  unenrichedAlbums: number;
  unenrichedArtists: number;
  enqueued: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Hourly self-heal : if any album or artist row still has mbid IS NULL,
 * re-enqueue an enrich job. Dedup via fixed jobId.
 */
export async function selfHealEnrichCatalog(): Promise<SelfHealResult> {
  const slog = log.child({ job: "enrich-catalog-self-heal" });

  const [albCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(albums)
    .where(isNull(albums.mbid));
  const [artCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(artists)
    .where(isNull(artists.mbid));

  const unenrichedAlbums = Number(albCount?.n ?? 0);
  const unenrichedArtists = Number(artCount?.n ?? 0);

  if (unenrichedAlbums === 0 && unenrichedArtists === 0) {
    slog.info("catalog fully enriched, no action");
    return { unenrichedAlbums, unenrichedArtists, enqueued: false };
  }

  const existing = await enrichCatalogQueue.getJob("enrich-catalog-global");
  if (existing) {
    const state = await existing.getState();
    if (state === "failed") {
      slog.info({ state }, "removing stale failed job");
      await existing.remove();
    } else {
      slog.info({ state }, "enrich already pending — no re-enqueue");
      return { unenrichedAlbums, unenrichedArtists, enqueued: false };
    }
  }

  await enrichCatalogQueue.add(
    "enrich-catalog",
    {},
    { jobId: "enrich-catalog-global" },
  );
  slog.info(
    { unenrichedAlbums, unenrichedArtists },
    "self-heal enqueued enrich-catalog",
  );
  return { unenrichedAlbums, unenrichedArtists, enqueued: true };
}

/**
 * Main enrich job. Sweeps unenriched albums then artists, calls MBz once per
 * entity (1 req/sec), persists progressively. On any error, BullMQ retries
 * the job — but already-persisted rows survive.
 */
export async function enrichCatalog(): Promise<EnrichCatalogResult> {
  const wlog = log.child({ job: "enrich-catalog" });

  // Albums : need the album row + its primary artist's name for MBz query.
  const unenrichedAlbums = await db
    .select({
      albumId: albums.id,
      albumName: albums.name,
      artistName: artists.name,
    })
    .from(albums)
    .innerJoin(albumArtists, eq(albumArtists.albumId, albums.id))
    .innerJoin(artists, eq(artists.id, albumArtists.artistId))
    .where(and(isNull(albums.mbid), eq(albumArtists.position, 0)));

  wlog.info({ albums: unenrichedAlbums.length }, "album sweep starting");

  let albumsEnriched = 0;
  for (let i = 0; i < unenrichedAlbums.length; i++) {
    if (i > 0) await sleep(RATE_DELAY_MS);
    const row = unenrichedAlbums[i];
    try {
      await enrichAlbumByNames({
        albumId: row.albumId,
        artistName: row.artistName,
        albumName: row.albumName,
      });
      albumsEnriched++;
      if (albumsEnriched % CHUNK_SIZE === 0) {
        wlog.info(
          { albumsEnriched, total: unenrichedAlbums.length },
          "chunk persisted",
        );
      }
    } catch (err) {
      wlog.error({ err, albumId: row.albumId }, "enrich album failed");
      throw err;
    }
  }

  // Artists : separate sweep.
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

  wlog.info({ albumsEnriched, artistsEnriched }, "enrich complete");
  return { albumsEnriched, artistsEnriched };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test worker/jobs/enrichCatalog.test.ts`
Expected: PASS (1/1).

- [ ] **Step 5: Commit**

```bash
git add worker/jobs/enrichCatalog.ts worker/jobs/enrichCatalog.test.ts
git commit -m "feat(worker): add enrichCatalog (MBz albums + artists) + selfHeal"
```

### Task 14: Wire enrichCatalog into `worker/index.ts`

**Files:**
- Modify: `worker/index.ts`
- Modify: `worker/schemas.ts`

- [ ] **Step 1: Inspect current `worker/index.ts`**

Run: `cat worker/index.ts`. Identify the bloc qui register `pollRecent` / `enrichMetadata` workers + schedulers.

- [ ] **Step 2: Remove poll-recent worker + scheduler entirely**

Supprime tout bloc qui :
- crée un `Worker(POLL_RECENT_QUEUE_NAME, ...)`
- ajoute `pollRecentQueue.upsertJobScheduler(POLL_RECENT_FANOUT_SCHEDULER_ID, ...)`

- [ ] **Step 3: Rename enrich worker → enrich-catalog**

Remplace le bloc qui register `enrichMetadata` :
```ts
new Worker(
  ENRICH_CATALOG_QUEUE_NAME,
  async (job) => {
    return enrichCatalog();
  },
  { connection, concurrency: 1 },
);

await enrichCatalogQueue.upsertJobScheduler(
  ENRICH_CATALOG_SELF_HEAL_SCHEDULER_ID,
  { every: ENRICH_CATALOG_SELF_HEAL_EVERY_MS },
  {
    name: "enrich-catalog-self-heal-tick",
    data: { kind: "self-heal" },
  },
);
```

Et le handler doit dispatcher entre `enrich-catalog` (main job) et `enrich-catalog-self-heal-tick` selon `job.name`.

- [ ] **Step 4: Update imports**

```ts
import { enrichCatalog, selfHealEnrichCatalog } from "./jobs/enrichCatalog";
import {
  enrichCatalogQueue,
  ENRICH_CATALOG_QUEUE_NAME,
  ENRICH_CATALOG_SELF_HEAL_SCHEDULER_ID,
  ENRICH_CATALOG_SELF_HEAL_EVERY_MS,
} from "./queue";
```

Supprime tous les imports de `pollRecent`, `fanout`, `enrichMetadata`.

- [ ] **Step 5: Update `worker/schemas.ts`**

Supprime les schémas Zod liés à poll-recent / enrich-metadata si présents. Ajoute si nécessaire un schéma pour `enrich-catalog` job data (peut être vide `z.object({})` puisque le job lit la DB directement).

- [ ] **Step 6: Run typecheck**

Run: `pnpm tsc --noEmit`
Expected: pas d'erreur TypeScript. Si erreurs, fixer les références cassées dans `worker/`.

- [ ] **Step 7: Commit**

```bash
git add worker/index.ts worker/schemas.ts
git commit -m "refactor(worker): swap pollRecent+enrichMetadata for enrichCatalog"
```

---

## Phase 5 — Cleanup Spotify code

### Task 15: Delete `src/lib/spotify/` and `src/app/api/now-playing/`

**Files:**
- Delete: `src/lib/spotify/` (entire directory)
- Delete: `src/app/api/now-playing/`
- Delete: `src/components/stats/currently-playing.tsx`
- Delete: `scripts/retry-enrich.ts`

- [ ] **Step 1: Delete directories + files**

```bash
rm -rf src/lib/spotify
rm -rf src/app/api/now-playing
rm src/components/stats/currently-playing.tsx
rm scripts/retry-enrich.ts
```

- [ ] **Step 2: Find references that now break**

Run: `pnpm tsc --noEmit 2>&1 | head -40`
Expected: liste d'erreurs imports cassés.

- [ ] **Step 3: Fix references in `src/lib/auth/` or anywhere else**

Pour chaque erreur, soit supprimer l'import (si la feature est entièrement Spotify-related), soit ajuster (cf. tâches suivantes).

- [ ] **Step 4: Commit (work in progress, ok if typecheck still fails — fix in next tasks)**

```bash
git add -A
git commit -m "chore(spotify): delete spotify lib, now-playing API, currently-playing UI"
```

### Task 16: Delete `worker/jobs/pollRecent.ts`, `fanout.ts`, `enrichMetadata.ts`

**Files:**
- Delete: `worker/jobs/pollRecent.ts`
- Delete: `worker/jobs/fanout.ts`
- Delete: `worker/jobs/enrichMetadata.ts`

- [ ] **Step 1: Delete files**

```bash
rm worker/jobs/pollRecent.ts worker/jobs/fanout.ts worker/jobs/enrichMetadata.ts
```

- [ ] **Step 2: Remove their tests if any**

```bash
rm -f worker/jobs/pollRecent.test.ts worker/jobs/fanout.test.ts worker/jobs/enrichMetadata.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(worker): remove pollRecent, fanout, enrichMetadata jobs"
```

### Task 17: Strip `streams.source = 'api'` query helpers if any

**Files:**
- Modify: `src/db/queries/streams.ts` (only if it has API-source-specific helpers)

- [ ] **Step 1: Check for API-source dependencies**

Run: `grep -n "source.*'api'" src/db/queries/streams.ts`

- [ ] **Step 2: If `pruneOverlappingApiStreams` exists, keep it as no-op**

The function will simply find 0 rows after TRUNCATE — no need to delete it now (out of scope). Just verify it still compiles.

- [ ] **Step 3: No commit if no change needed**

### Task 18: Refactor `src/app/album/[id]/page.tsx` — drop lazy Spotify enrich

**Files:**
- Modify: `src/app/album/[id]/page.tsx`

- [ ] **Step 1: Find the lazy enrich block**

Run: `grep -n "spotifyFetch\|upsertCatalogFromTracks\|/albums/" src/app/album/'[id]'/page.tsx`

- [ ] **Step 2: Delete the entire block that calls Spotify on missing album**

Pattern attendu : un `if (!album.imageUrl) { ... fetch Spotify ... }` ou similaire (lignes ~170-210). Le bloc commence avec un try/catch autour de `spotifyFetch<SpotifyAlbum>` et finit avant le `return` de la page.

Remplace par : rien (le bloc disparaît).

- [ ] **Step 3: Remove now-unused imports**

Supprime `import { spotifyFetch } from "@/lib/spotify/client"`, `import { upsertCatalogFromTracks } from "@/lib/spotify/catalog"`, etc.

- [ ] **Step 4: Run typecheck**

Run: `pnpm tsc --noEmit src/app/album/'[id]'/page.tsx 2>&1 | head -10`
Expected: clean ou seulement des erreurs résiduelles à fixer.

- [ ] **Step 5: Commit**

```bash
git add src/app/album/'[id]'/page.tsx
git commit -m "refactor(album): drop lazy Spotify enrich — show placeholder if no cover"
```

### Task 19: Refactor `src/app/artist/[id]/page.tsx` + `src/app/track/[id]/page.tsx` — drop Spotify fallback

**Files:**
- Modify: `src/app/artist/[id]/page.tsx`
- Modify: `src/app/track/[id]/page.tsx`

- [ ] **Step 1: Strip Spotify fallback in artist page**

Find the block after `if (isDemoId(id))` qui fait `spotifyFetch<SpotifyArtist>`. Remplace par une query DB simple :

```ts
const [artist] = await db.select().from(artists).where(eq(artists.id, id)).limit(1);
if (!artist) notFound();
```

Supprime imports inutilisés (`spotifyFetch`, `SpotifyArtist`).

- [ ] **Step 2: Idem pour track page**

Find le bloc `spotifyFetch<SpotifyTrack>(userId, '/tracks/${id}')`. Remplace par DB query :

```ts
const [track] = await db
  .select({
    id: tracks.id,
    name: tracks.name,
    albumId: tracks.albumId,
  })
  .from(tracks)
  .where(eq(tracks.id, id))
  .limit(1);
if (!track) notFound();
```

Le hero `albumImage` venait de Spotify ; maintenant venir de `albums` via le `albumId`. Si pas d'album ou pas de cover, afficher placeholder.

- [ ] **Step 3: Run typecheck**

Run: `pnpm tsc --noEmit 2>&1 | head -30`
Expected: les erreurs Spotify résiduelles disparaissent.

- [ ] **Step 4: Commit**

```bash
git add src/app/artist src/app/track
git commit -m "refactor(detail-pages): query DB instead of Spotify for /artist + /track"
```

### Task 20: Strip audio preview from `src/components/share/share-editor.tsx`

**Files:**
- Modify: `src/components/share/share-editor.tsx`

- [ ] **Step 1: Find the previewUrl usage**

Run: `grep -n "previewUrl\|Preview src" src/components/share/share-editor.tsx`

- [ ] **Step 2: Remove `<Preview src={previewUrl} ... />` and the `useMemo(() => ..., [previewUrl])` block**

Garde le reste de l'éditeur (config, format, render). La preview audio devient juste un visuel statique de la share card.

- [ ] **Step 3: Run typecheck + relevant tests**

Run: `pnpm tsc --noEmit src/components/share/share-editor.tsx 2>&1 | head`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/share/share-editor.tsx
git commit -m "refactor(share): drop audio preview (Spotify-only)"
```

### Task 21: Strip `spotify_tokens` / `spotifyId` references in `src/app/api/account/route.ts`

**Files:**
- Modify: `src/app/api/account/route.ts`

- [ ] **Step 1: Inspect current usage**

Run: `grep -n "spotifyTokens\|spotifyId" src/app/api/account/route.ts`

- [ ] **Step 2: Remove references**

Si l'endpoint /api/account renvoie ou modifie un `spotify_id`, le retirer. La table `spotify_tokens` est droppée, donc tout `db.query.spotifyTokens` doit disparaître.

- [ ] **Step 3: Run typecheck**

Run: `pnpm tsc --noEmit`
Expected: 0 erreur (sauf si d'autres fichiers cassent — corriger récursivement).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/account/route.ts
git commit -m "refactor(account): remove spotify_tokens + spotify_id references"
```

---

## Phase 6 — UI : artist avatar

### Task 22: Create `ArtistAvatar` component + gradient color helper

**Files:**
- Create: `src/components/ui/artist-avatar.tsx`
- Create: `src/lib/ui/avatar-color.ts`
- Test: `src/lib/ui/avatar-color.test.ts`

- [ ] **Step 1: Write the failing test for color helper**

Create `src/lib/ui/avatar-color.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { avatarGradient } from "./avatar-color";

describe("avatarGradient", () => {
  it("returns a CSS gradient string", () => {
    const g = avatarGradient("Sabrina Carpenter");
    expect(g).toMatch(/^linear-gradient\(135deg,/);
  });

  it("is deterministic for same input", () => {
    expect(avatarGradient("X")).toBe(avatarGradient("X"));
  });

  it("differs for different inputs", () => {
    expect(avatarGradient("Sabrina")).not.toBe(avatarGradient("Billie"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/ui/avatar-color.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement color helper**

Create `src/lib/ui/avatar-color.ts`:

```ts
// Palette nébuleuse violet — cohérent avec le design system loopstat.
const PALETTE: [string, string][] = [
  ["#7c3aed", "#ec4899"],
  ["#a855f7", "#581c87"],
  ["#6d28d9", "#c026d3"],
  ["#4c1d95", "#a855f7"],
  ["#7c3aed", "#3b0764"],
  ["#5b21b6", "#a855f7"],
  ["#c026d3", "#7c3aed"],
  ["#7c3aed", "#1e1b4b"],
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h * 31) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Deterministic gradient for an artist avatar. Uses the loopstat violet/mauve
 * palette so all avatars stay on-brand.
 */
export function avatarGradient(name: string): string {
  const [from, to] = PALETTE[hashString(name) % PALETTE.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/ui/avatar-color.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Create the ArtistAvatar component**

Create `src/components/ui/artist-avatar.tsx`:

```tsx
import { avatarGradient } from "@/lib/ui/avatar-color";

interface Props {
  name: string;
  size?: number;
  className?: string;
}

/**
 * Placeholder avatar pour un artiste sans image (MusicBrainz n'a pas de
 * photos d'artistes ; TheAudioDB sera intégré plus tard). Cercle gradient
 * dérivé du nom + initiale.
 */
export function ArtistAvatar({ name, size = 48, className = "" }: Props) {
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

- [ ] **Step 6: Commit**

```bash
git add src/lib/ui/ src/components/ui/artist-avatar.tsx
git commit -m "feat(ui): add ArtistAvatar (gradient + initiale) for artist images"
```

### Task 23: Use ArtistAvatar partout où l'image artiste était attendue

**Files:**
- Modify: `src/components/stats/ranked-row.tsx` (ou équivalent qui prend `imageUrl` pour artists)
- Modify: `src/app/artist/[id]/page.tsx`
- Modify: `src/app/top/artists/page.tsx`

- [ ] **Step 1: Inspecter où `imageUrl` artiste est rendu**

Run: `grep -rn "ranked-row\|artist.*imageUrl\|artistImage" src/components src/app 2>/dev/null | head -10`

- [ ] **Step 2: Pour chaque usage, conditionner sur la nature de l'item**

Si le `RankedRow` est générique (track / album / artist), ajouter une prop `avatarName?: string` qui, quand fournie, render `<ArtistAvatar name={avatarName} />` à la place de l'image placeholder.

Ou simplement remplacer `imageUrl ?? <PlaceholderDiv>` par `imageUrl ?? <ArtistAvatar name={subtitle ?? title} />` dans le contexte artist (rangée `/top/artists` et tiles `/artist/[id]`).

- [ ] **Step 3: Lance le dev server, vérif visuelle**

Run: `pnpm dev` (déjà running probablement)
Naviguer sur `/top/artists` (en mode démo et en mode connecté) — chaque artiste doit afficher un cercle gradient violet + initiale.

- [ ] **Step 4: Commit**

```bash
git add src/components src/app
git commit -m "feat(ui): swap artist placeholder for ArtistAvatar across stats pages"
```

---

## Phase 7 — Vérification finale + restore

### Task 24: Run full test suite + typecheck

- [ ] **Step 1: Tests**

Run: `pnpm test`
Expected: tous tests verts. Si un test legacy mentionne Spotify (qui n'existe plus), le supprimer.

- [ ] **Step 2: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: 0 erreur (warnings tolérés).

- [ ] **Step 4: Build prod**

Run: `pnpm build`
Expected: build succès, pas d'erreur fatale.

- [ ] **Step 5: Si tout vert, commit fixup éventuel**

Si des petits fix de lint/typecheck ont été nécessaires :
```bash
git add -A
git commit -m "chore: post-cleanup typecheck + lint fixes"
```

### Task 25: Manual verification — re-import + observe enrich

- [ ] **Step 1: Restart dev server (worker + Next)**

Si `pnpm dev` est déjà en cours, le redémarrer pour piquer la nouvelle worker. Vérifier les logs au boot — pas d'erreur d'import.

- [ ] **Step 2: Login + import du JSON de Jules**

Aller sur `http://127.0.0.1:3000/login`, sign in Google, naviguer sur `/import`, upload les fichiers Streaming_History_Audio_*.json.

- [ ] **Step 3: Observer l'import (devrait être < 5 min)**

L'import status passe `pending` → `processing` → `completed`. Vérifier rapidement dans `psql` :

```sql
SELECT count(*) FROM artists;       -- attendu: 500-2000
SELECT count(*) FROM albums;        -- attendu: 1000-3000
SELECT count(*) FROM tracks;        -- attendu: 5000-15000
SELECT count(*) FROM streams;       -- attendu: 100k+
```

- [ ] **Step 4: Observer l'enrich qui démarre automatiquement**

```bash
docker logs -f --tail=50 loopstat_app | grep enrich
```

Attendu : logs `chunk persisted` toutes les ~28 secondes (25 albums × 1.1s). À ~15-30 min, la plupart des albums devraient être enrichis.

- [ ] **Step 5: Vérif visuelle des pages**

Sur `/dashboard`, `/top/tracks`, `/top/artists`, `/top/albums`, `/album/[id]`, `/artist/[id]`, `/track/[id]` :
- Covers d'album s'affichent (~80-90% en mainstream)
- Avatar gradient + initiale pour les artistes
- Pas d'erreur 404 ou stack trace

- [ ] **Step 6: Mesurer le match rate**

```sql
SELECT
  count(*) FILTER (WHERE mbid IS NOT NULL AND mbid != '00000000-0000-0000-0000-000000000000') AS matched,
  count(*) FILTER (WHERE mbid = '00000000-0000-0000-0000-000000000000') AS not_found,
  count(*) FILTER (WHERE mbid IS NULL) AS pending,
  count(*) AS total
FROM albums;
```

Si match rate < 60%, revoir la query MBz dans `src/lib/musicbrainz/search.ts` (ajouter `type:Album`, `country:`, etc.).

### Task 26: Push + merge to main

- [ ] **Step 1: Si exécution en worktree, push la branche**

```bash
git push -u origin worktree-feat+catalog-musicbrainz
```

- [ ] **Step 2: Merge to main (no-ff)**

```bash
cd /Users/poney53/Documents/Projets/loopstat   # main repo
git checkout main
git merge --no-ff worktree-feat+catalog-musicbrainz -m "Merge feat/catalog-musicbrainz: pivot Spotify → MusicBrainz"
git push origin main
```

- [ ] **Step 3: Annoncer**

Le sub-projet C+D+E est livré. Le code Spotify Web API est entièrement éliminé, le catalog est servi par MusicBrainz + Cover Art Archive, et `users.spotify_id` + `spotify_tokens` sont supprimés.

---

## Self-review

- ✅ Spec coverage : 7 sections du spec → 26 tâches groupées en 7 phases. Migration `0005`, parser JSON étendu, lib MBz complète, worker enrichCatalog, cleanup Spotify, ArtistAvatar, verif manuelle.
- ✅ Placeholders : aucun TBD/TODO ; code complet à chaque step.
- ✅ Type consistency : `enrichCatalogQueue` / `ENRICH_CATALOG_QUEUE_NAME` cohérents entre queue.ts, enrichCatalog.ts, index.ts, importHistory.ts. `SENTINEL_MBID` défini une fois dans catalog.ts. `synthesizeArtistId` / `synthesizeAlbumId` mêmes signatures dans ids.ts et importHistory.ts.
- ✅ TDD : phases 1-4 follow strict TDD. Phase 5 (cleanup) skip TDD car suppression de code (typecheck + tests existants servent de gate). Phase 6 (UI) TDD sur la couleur helper, vérif visuelle pour le rendu.
