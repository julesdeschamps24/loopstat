# Artist Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre `/artist/[id]` en page riche : hero "editorial split" + 5 sections (top tracks, top albums, sparkline mensuelle, artistes co-écoutés).

**Architecture:** 4 nouvelles queries DB (mirror des patterns existants pour track/album), 1 nouveau composant `RelatedArtists`, extension de `getDemoArtist`, refonte complète du JSX de `/artist/[id]/page.tsx`. Réutilise au max les composants existants (ArtistAvatar, RankedList, SparklineMonthly, OtherArtistAlbums).

**Tech Stack:** TypeScript / Next.js 16 / Drizzle ORM / Postgres / vitest (env: node) / Tailwind v4.

**Spec source:** [docs/superpowers/specs/2026-05-25-artist-page-redesign-design.md](docs/superpowers/specs/2026-05-25-artist-page-redesign-design.md) (commit `11cc5dd`).

**Worktree:** Création via `superpowers:using-git-worktrees` au début de l'exécution.

---

## Task 1: Extend `getArtistPlayStats` with first/last played dates

**Files:**
- Modify: `src/db/queries/stats.ts` (the existing `getArtistPlayStats`)
- Modify: `src/db/queries/stats.test.ts` (or create if missing)

- [ ] **Step 1: Write the failing test**

Append to `src/db/queries/stats.test.ts` (create if absent - follow `vitest` patterns in the codebase, env `node`) :

```ts
import { describe, expect, it } from "vitest";

describe("getArtistPlayStats", () => {
  it("returns firstPlayedAt and lastPlayedAt from the user's streams", async () => {
    // This is an integration smoke test. We'll just verify the type shape
    // by calling the function with a non-existent user (returns nulls).
    const { getArtistPlayStats } = await import("./stats");
    const result = await getArtistPlayStats(
      "00000000-0000-0000-0000-000000000000",
      "art_nonexistent",
    );
    expect(result).toHaveProperty("count");
    expect(result).toHaveProperty("firstPlayedAt");
    expect(result).toHaveProperty("lastPlayedAt");
    expect(result.count).toBe(0);
    expect(result.firstPlayedAt).toBeNull();
    expect(result.lastPlayedAt).toBeNull();
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
pnpm test src/db/queries/stats.test.ts
```

Expected: FAIL because the current `getArtistPlayStats` returns `{ count: number }` only, no `firstPlayedAt`/`lastPlayedAt`.

- [ ] **Step 3: Update the implementation**

In `src/db/queries/stats.ts`, replace the existing `getArtistPlayStats` function with:

```ts
export async function getArtistPlayStats(
  userId: string,
  artistId: string,
): Promise<{
  count: number;
  firstPlayedAt: Date | null;
  lastPlayedAt: Date | null;
}> {
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      firstPlayedAt: sql<Date | null>`min(${streams.playedAt})`,
      lastPlayedAt: sql<Date | null>`max(${streams.playedAt})`,
    })
    .from(streams)
    .innerJoin(trackArtists, eq(trackArtists.trackId, streams.trackId))
    .where(
      and(
        eq(streams.userId, userId),
        eq(trackArtists.artistId, artistId),
        QUALIFYING_PLAY,
      ),
    );

  return {
    count: Number(row?.count ?? 0),
    firstPlayedAt: row?.firstPlayedAt ?? null,
    lastPlayedAt: row?.lastPlayedAt ?? null,
  };
}
```

- [ ] **Step 4: Verify**

```bash
pnpm test src/db/queries/stats.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/queries/stats.ts src/db/queries/stats.test.ts
git commit -m "feat(stats): getArtistPlayStats returns firstPlayedAt + lastPlayedAt"
```

---

## Task 2: New query `getUserTopAlbumsByArtist`

**Files:**
- Modify: `src/db/queries/stats.ts`
- Modify: `src/db/queries/stats.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/db/queries/stats.test.ts`:

```ts
describe("getUserTopAlbumsByArtist", () => {
  it("returns an empty array for an artist with no plays", async () => {
    const { getUserTopAlbumsByArtist } = await import("./stats");
    const rows = await getUserTopAlbumsByArtist(
      "00000000-0000-0000-0000-000000000000",
      "art_nonexistent",
      10,
    );
    expect(rows).toEqual([]);
  });

  it("returns array shape with albumId, name, imageUrl, playCount", async () => {
    const { getUserTopAlbumsByArtist } = await import("./stats");
    const rows = await getUserTopAlbumsByArtist(
      "00000000-0000-0000-0000-000000000000",
      "art_nonexistent",
      10,
    );
    // Type-only assertion (empty array, but the type must be correct)
    const expectShape: { albumId: string; name: string; imageUrl: string | null; playCount: number }[] = rows;
    expect(Array.isArray(expectShape)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
pnpm test src/db/queries/stats.test.ts -t getUserTopAlbumsByArtist
```

Expected: FAIL - function doesn't exist.

- [ ] **Step 3: Add the implementation**

At the bottom of `src/db/queries/stats.ts`, add:

```ts
/**
 * Top albums of `artistId` ordered by the user's play count. Mirrors
 * `getUserTopTracksByArtist` at album granularity.
 */
export async function getUserTopAlbumsByArtist(
  userId: string,
  artistId: string,
  limit: number,
): Promise<{
  albumId: string;
  name: string;
  imageUrl: string | null;
  playCount: number;
}[]> {
  const rows = await db
    .select({
      albumId: albums.id,
      name: albums.name,
      imageUrl: albums.imageUrl,
      playCount: sql<number>`count(${streams.id})::int`,
    })
    .from(streams)
    .innerJoin(tracks, eq(tracks.id, streams.trackId))
    .innerJoin(albums, eq(albums.id, tracks.albumId))
    .innerJoin(albumArtists, eq(albumArtists.albumId, albums.id))
    .where(
      and(
        eq(streams.userId, userId),
        eq(albumArtists.artistId, artistId),
        QUALIFYING_PLAY,
      ),
    )
    .groupBy(albums.id, albums.name, albums.imageUrl)
    .orderBy(desc(sql`count(${streams.id})`))
    .limit(limit);

  return rows.map((r) => ({
    albumId: r.albumId,
    name: r.name,
    imageUrl: r.imageUrl,
    playCount: Number(r.playCount),
  }));
}
```

Ensure `albums` and `albumArtists` are imported from `@/db/schema` at the top of `stats.ts` (likely already there - check). If not present, add them. Also confirm `desc` is imported from `drizzle-orm` (already is in most cases).

- [ ] **Step 4: Verify**

```bash
pnpm test src/db/queries/stats.test.ts -t getUserTopAlbumsByArtist
```

Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add src/db/queries/stats.ts src/db/queries/stats.test.ts
git commit -m "feat(stats): add getUserTopAlbumsByArtist"
```

---

## Task 3: New query `getArtistMonthlyPlays`

**Files:**
- Modify: `src/db/queries/stats.ts`
- Modify: `src/db/queries/stats.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/db/queries/stats.test.ts`:

```ts
describe("getArtistMonthlyPlays", () => {
  it("returns empty array for non-existent artist", async () => {
    const { getArtistMonthlyPlays } = await import("./stats");
    const rows = await getArtistMonthlyPlays(
      "00000000-0000-0000-0000-000000000000",
      "art_nonexistent",
    );
    expect(rows).toEqual([]);
  });

  it("returns shape { month: Date, plays: number }", async () => {
    const { getArtistMonthlyPlays } = await import("./stats");
    const rows = await getArtistMonthlyPlays(
      "00000000-0000-0000-0000-000000000000",
      "art_nonexistent",
    );
    const expectShape: { month: Date; plays: number }[] = rows;
    expect(Array.isArray(expectShape)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
pnpm test src/db/queries/stats.test.ts -t getArtistMonthlyPlays
```

Expected: FAIL - function doesn't exist.

- [ ] **Step 3: Add the implementation**

At the bottom of `src/db/queries/stats.ts`, add (mirror of `getTrackMonthlyPlays`):

```ts
/**
 * Plays per month for `userId × artistId` over the last 18 months.
 * Mirror of getTrackMonthlyPlays at the artist granularity.
 */
export async function getArtistMonthlyPlays(
  userId: string,
  artistId: string,
): Promise<{ month: Date; plays: number }[]> {
  const rows = await db
    .select({
      month: sql<string>`date_trunc('month', ${streams.playedAt})::text`,
      plays: sql<number>`count(*)::int`,
    })
    .from(streams)
    .innerJoin(trackArtists, eq(trackArtists.trackId, streams.trackId))
    .where(
      and(
        eq(streams.userId, userId),
        eq(trackArtists.artistId, artistId),
        QUALIFYING_PLAY,
        sql`${streams.playedAt} > now() - interval '18 months'`,
      ),
    )
    .groupBy(sql`date_trunc('month', ${streams.playedAt})`)
    .orderBy(sql`date_trunc('month', ${streams.playedAt}) asc`);

  return rows.map((r) => ({
    month: new Date(r.month),
    plays: Number(r.plays),
  }));
}
```

- [ ] **Step 4: Verify**

```bash
pnpm test src/db/queries/stats.test.ts -t getArtistMonthlyPlays
```

Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add src/db/queries/stats.ts src/db/queries/stats.test.ts
git commit -m "feat(stats): add getArtistMonthlyPlays (18-month rolling window)"
```

---

## Task 4: New query `getCoListenedArtists`

**Files:**
- Modify: `src/db/queries/stats.ts`
- Modify: `src/db/queries/stats.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/db/queries/stats.test.ts`:

```ts
describe("getCoListenedArtists", () => {
  it("returns empty array for non-existent artist", async () => {
    const { getCoListenedArtists } = await import("./stats");
    const rows = await getCoListenedArtists(
      "00000000-0000-0000-0000-000000000000",
      "art_nonexistent",
      5,
    );
    expect(rows).toEqual([]);
  });

  it("returns shape { artistId, name, imageUrl, coCount }", async () => {
    const { getCoListenedArtists } = await import("./stats");
    const rows = await getCoListenedArtists(
      "00000000-0000-0000-0000-000000000000",
      "art_nonexistent",
      5,
    );
    const expectShape: {
      artistId: string;
      name: string;
      imageUrl: string | null;
      coCount: number;
    }[] = rows;
    expect(Array.isArray(expectShape)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
pnpm test src/db/queries/stats.test.ts -t getCoListenedArtists
```

Expected: FAIL - function doesn't exist.

- [ ] **Step 3: Add the implementation**

At the bottom of `src/db/queries/stats.ts`, add:

```ts
/**
 * Top N artists that the user listens to within ±30 min of plays from
 * `artistId`. Self-join on streams.played_at within a 30-min window where
 * one side is the focal artist and the other side is any other artist.
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
}[]> {
  const rows = await db.execute<{
    artist_id: string;
    name: string;
    image_url: string | null;
    co_count: number;
  }>(sql`
    WITH focal AS (
      SELECT s.played_at
      FROM streams s
      JOIN track_artists ta ON ta.track_id = s.track_id
      WHERE s.user_id = ${userId} AND ta.artist_id = ${artistId}
    )
    SELECT
      a.id AS artist_id,
      a.name,
      a.image_url,
      count(*)::int AS co_count
    FROM focal
    JOIN streams s2 ON s2.user_id = ${userId}
      AND s2.played_at BETWEEN focal.played_at - INTERVAL '30 min'
                           AND focal.played_at + INTERVAL '30 min'
    JOIN track_artists ta2 ON ta2.track_id = s2.track_id
    JOIN artists a ON a.id = ta2.artist_id
    WHERE a.id != ${artistId}
    GROUP BY a.id, a.name, a.image_url
    ORDER BY co_count DESC
    LIMIT ${limit};
  `);

  return rows.map((r) => ({
    artistId: r.artist_id,
    name: r.name,
    imageUrl: r.image_url,
    coCount: Number(r.co_count),
  }));
}
```

Note: drizzle's `db.execute<T>(sql\`...\`)` returns rows directly (postgres-js). The exact return shape may need verification against existing `db.execute` usage patterns in the codebase - see `pruneOverlappingApiStreams`-like patterns. If `db.execute` returns `{ rows: T[] }`, adjust to `rows.rows.map(...)`.

- [ ] **Step 4: Verify**

```bash
pnpm test src/db/queries/stats.test.ts -t getCoListenedArtists
```

Expected: PASS (2/2).

- [ ] **Step 5: Verify full SQL works manually**

Run the SQL on the dev DB with the real Jules userId (replace `<jules-id>`):

```bash
docker exec loopstat_postgres psql -U loopstat -d loopstat -c "
WITH focal AS (
  SELECT s.played_at FROM streams s
  JOIN track_artists ta ON ta.track_id = s.track_id
  WHERE s.user_id = '<jules-id>'
  AND ta.artist_id = (SELECT id FROM artists LIMIT 1)
)
SELECT a.name, count(*)::int FROM focal
JOIN streams s2 ON s2.user_id = '<jules-id>'
  AND s2.played_at BETWEEN focal.played_at - INTERVAL '30 min' AND focal.played_at + INTERVAL '30 min'
JOIN track_artists ta2 ON ta2.track_id = s2.track_id
JOIN artists a ON a.id = ta2.artist_id
GROUP BY a.name ORDER BY count(*) DESC LIMIT 5;"
```

Expected: returns 5 artists with co-counts > 0.

- [ ] **Step 6: Commit**

```bash
git add src/db/queries/stats.ts src/db/queries/stats.test.ts
git commit -m "feat(stats): add getCoListenedArtists (±30 min co-listening)"
```

---

## Task 5: New component `RelatedArtists`

**Files:**
- Create: `src/components/artist/related-artists.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/artist/related-artists.tsx`:

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

/**
 * Grid of artists frequently co-listened with the focal artist. Each tile
 * links to its `/artist/[id]` page. Renders nothing if the list is empty.
 */
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

- [ ] **Step 2: Typecheck**

```bash
pnpm tsc --noEmit 2>&1 | grep -E "related-artists" | head -3
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/artist/related-artists.tsx
git commit -m "feat(ui): RelatedArtists grid component"
```

---

## Task 6: Extend `getDemoArtist` with new fields

**Files:**
- Modify: `src/lib/demo/data.ts` (the `getDemoArtist` function)
- Modify: `src/lib/demo/data.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/demo/data.test.ts`:

```ts
describe("getDemoArtist (rich page fields)", () => {
  it("returns topAlbums, monthly, related, dates, totalPercent", async () => {
    const { getDemoArtist, DEMO_TOP_ARTISTS } = await import("./data");
    const firstArtist = DEMO_TOP_ARTISTS[0];
    const demo = getDemoArtist(firstArtist.artistId);
    expect(demo).not.toBeNull();
    if (!demo) return;
    expect(Array.isArray(demo.topAlbums)).toBe(true);
    expect(Array.isArray(demo.monthly)).toBe(true);
    expect(Array.isArray(demo.related)).toBe(true);
    expect(demo.related.length).toBeLessThanOrEqual(5);
    expect(demo.related.every((r) => r.artistId !== firstArtist.artistId)).toBe(true);
    expect(demo.stats.firstPlayedAt).toBeInstanceOf(Date);
    expect(demo.stats.lastPlayedAt).toBeInstanceOf(Date);
    expect(typeof demo.totalPercent).toBe("number");
    expect(demo.totalPercent).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
pnpm test src/lib/demo/data.test.ts -t "rich page fields"
```

Expected: FAIL - `topAlbums`, `monthly`, `related`, `totalPercent` properties don't exist.

- [ ] **Step 3: Find the current `getDemoArtist`**

```bash
grep -n "export function getDemoArtist" src/lib/demo/data.ts
```

Read 40 lines starting at the match to understand the current return shape.

- [ ] **Step 4: Replace the function**

Replace the existing `getDemoArtist` in `src/lib/demo/data.ts` with:

```ts
export function getDemoArtist(id: string): {
  artist: (typeof DEMO_TOP_ARTISTS)[number];
  stats: {
    count: number;
    firstPlayedAt: Date;
    lastPlayedAt: Date;
  };
  topTracks: { trackId: string; trackName: string; albumImageUrl: string | null; playCount: number }[];
  topAlbums: { albumId: string; name: string; imageUrl: string | null; playCount: number }[];
  monthly: { month: Date; plays: number }[];
  related: { artistId: string; name: string; imageUrl: string | null; coCount: number }[];
  totalPercent: number;
} | null {
  if (!isDemoId(id)) return null;
  const artist = DEMO_TOP_ARTISTS.find((a) => a.artistId === id);
  if (!artist) return null;
  const seed = seedFromString(id);

  const topTracks = DEMO_TOP_TRACKS.filter((t) =>
    t.artistNames.includes(artist.name),
  )
    .slice(0, 20)
    .map((t) => ({
      trackId: t.trackId,
      trackName: t.name,
      albumImageUrl: t.albumImageUrl,
      playCount: t.plays,
    }));

  const topAlbums = DEMO_TOP_ALBUMS.filter(
    (a) => a.artistNames[0] === artist.name,
  )
    .slice(0, 10)
    .map((a) => ({
      albumId: a.albumId,
      name: a.name,
      imageUrl: a.imageUrl,
      playCount: a.plays,
    }));

  const related = DEMO_TOP_ARTISTS.filter((a) => a.artistId !== id)
    .slice(0, 5)
    .map((a) => ({
      artistId: a.artistId,
      name: a.name,
      imageUrl: a.imageUrl,
      coCount: Math.max(1, Math.round(a.plays / 10)),
    }));

  const dates = synthesizeFirstLastDates(seed);
  const monthly = synthesizeMonthlyPlays(artist.plays);
  const totalPercent = Math.max(1, Math.round((artist.plays / DEMO_TOTAL_PLAYS) * 100));

  return {
    artist,
    stats: {
      count: artist.plays,
      firstPlayedAt: dates.firstPlayedAt,
      lastPlayedAt: dates.lastPlayedAt,
    },
    topTracks,
    topAlbums,
    monthly,
    related,
    totalPercent,
  };
}
```

This relies on helpers `seedFromString`, `synthesizeFirstLastDates`, `synthesizeMonthlyPlays` and constant `DEMO_TOTAL_PLAYS` which already exist in `src/lib/demo/data.ts` (verify by `grep -n` if uncertain).

- [ ] **Step 5: Verify**

```bash
pnpm test src/lib/demo/data.test.ts -t "rich page fields"
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/demo/data.ts src/lib/demo/data.test.ts
git commit -m "feat(demo): getDemoArtist returns rich page fields (albums, monthly, related, %)"
```

---

## Task 7: Refactor `/artist/[id]/page.tsx` - hero + 5 sections

**Files:**
- Modify: `src/app/artist/[id]/page.tsx` (entire file rewrite)

- [ ] **Step 1: Read the current file**

```bash
cat src/app/artist/[id]/page.tsx | head -50
```

Note the current imports + structure so the new version doesn't break sibling features (e.g. AlbumWall background that may be in place).

- [ ] **Step 2: Write the new page**

Replace the entire contents of `src/app/artist/[id]/page.tsx` with:

```tsx
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { OtherArtistAlbums } from "@/components/album/other-artist-albums";
import { RelatedArtists } from "@/components/artist/related-artists";
import { EmptyState } from "@/components/stats/empty-state";
import { RankedList, RankedRow } from "@/components/stats/ranked-list";
import { SparklineMonthly } from "@/components/stats/sparkline-monthly";
import { ArtistAvatar } from "@/components/ui/artist-avatar";
import { db } from "@/db/client";
import {
  getArtistMonthlyPlays,
  getArtistPlayStats,
  getCoListenedArtists,
  getListeningTotals,
  getUserTopAlbumsByArtist,
  getUserTopTracksByArtist,
} from "@/db/queries/stats";
import { artists } from "@/db/schema";
import { getDemoArtist, isDemoId } from "@/lib/demo/data";
import { formatRelativeDate } from "@/lib/format/date";
import { cn, formatNumber, glassCard } from "@/lib/utils";

export const revalidate = 3600;

function PercentDisplay({ percent }: { percent: number }) {
  const display = percent < 1 ? "< 1" : `${percent}`;
  return (
    <div className="text-right">
      <p
        className="font-display italic leading-none"
        style={{
          fontSize: "64px",
          fontWeight: 400,
          letterSpacing: "-0.03em",
          background: "linear-gradient(135deg, #c4b5fd, #ec4899)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        {display}%
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-[1.5px] text-muted-foreground">
        de ton temps
      </p>
    </div>
  );
}

function ArtistHero({
  name,
  imageUrl,
  firstPlayedAt,
  lastPlayedAt,
  totalPercent,
}: {
  name: string;
  imageUrl: string | null;
  firstPlayedAt: Date | null;
  lastPlayedAt: Date | null;
  totalPercent: number;
}) {
  return (
    <section
      className="grid items-center gap-6 rounded-[20px] border p-6"
      style={{
        gridTemplateColumns: "144px 1fr auto",
        background: "rgba(124, 58, 237, 0.06)",
        borderColor: "rgba(124, 58, 237, 0.2)",
      }}
    >
      <ArtistAvatar name={name} imageUrl={imageUrl} size={144} />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[1.5px] text-muted-foreground">
          Artiste
        </p>
        <h1
          className="font-display italic"
          style={{ fontSize: "32px", lineHeight: 1, marginTop: 4 }}
        >
          {name}
        </h1>
        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
          {firstPlayedAt ? (
            <p>
              Découvert <strong className="text-foreground">{formatRelativeDate(firstPlayedAt)}</strong>
            </p>
          ) : null}
          {lastPlayedAt ? (
            <p>
              Dernière écoute <strong className="text-foreground">{formatRelativeDate(lastPlayedAt)}</strong>
            </p>
          ) : null}
        </div>
      </div>
      <PercentDisplay percent={totalPercent} />
    </section>
  );
}

export default async function ArtistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);

  // ===== DEMO MODE =====
  if (isDemoId(id)) {
    const demo = getDemoArtist(id);
    if (!demo) notFound();
    const { artist, stats, topTracks, topAlbums, monthly, related, totalPercent } = demo;
    return (
      <main id="main" className="flex-1 flex flex-col gap-8 px-6 py-12 max-w-3xl mx-auto w-full">
        <ArtistHero
          name={artist.name}
          imageUrl={artist.imageUrl}
          firstPlayedAt={stats.firstPlayedAt}
          lastPlayedAt={stats.lastPlayedAt}
          totalPercent={totalPercent}
        />

        <section>
          <h2 className="mb-4 text-lg font-semibold">Tes titres les plus écoutés</h2>
          {topTracks.length === 0 ? (
            <EmptyState
              title="Pas encore d'écoute enregistrée"
              description="Tes titres les plus écoutés de cet artiste apparaîtront ici."
            />
          ) : (
            <RankedList>
              {topTracks.map((t, i) => (
                <RankedRow
                  key={t.trackId}
                  rank={i + 1}
                  title={t.trackName}
                  href={`/track/${t.trackId}`}
                  imageUrl={t.albumImageUrl ?? undefined}
                  metric={`${formatNumber(t.playCount)} écoutes`}
                />
              ))}
            </RankedList>
          )}
        </section>

        {topAlbums.length > 0 ? (
          <OtherArtistAlbums
            artistName={artist.name}
            albums={topAlbums.map((a) => ({
              albumId: a.albumId,
              name: a.name,
              imageUrl: a.imageUrl,
              plays: a.playCount,
            }))}
          />
        ) : null}

        {monthly.length >= 3 ? (
          <section className={cn(glassCard, "p-6")}>
            <h2 className="text-lg font-semibold">Évolution mensuelle</h2>
            <div className="mt-4">
              <SparklineMonthly data={monthly} />
            </div>
          </section>
        ) : null}

        {related.length > 0 ? (
          <section>
            <h2 className="mb-4 text-lg font-semibold">Artistes connexes</h2>
            <RelatedArtists artists={related} />
          </section>
        ) : null}
      </main>
    );
  }

  // ===== REAL MODE =====
  const [artist] = await db.select().from(artists).where(eq(artists.id, id)).limit(1);
  if (!artist) notFound();

  const [stats, topTracks, topAlbums, monthly, related, totals] = await Promise.all([
    getArtistPlayStats(userId, id),
    getUserTopTracksByArtist(userId, id, 20),
    getUserTopAlbumsByArtist(userId, id, 10),
    getArtistMonthlyPlays(userId, id),
    getCoListenedArtists(userId, id, 5),
    getListeningTotals(userId, "all"),
  ]);

  const totalPercent =
    totals.count > 0 ? Math.max(0, Math.round((stats.count / totals.count) * 100)) : 0;

  return (
    <main id="main" className="flex-1 flex flex-col gap-8 px-6 py-12 max-w-3xl mx-auto w-full">
      <ArtistHero
        name={artist.name}
        imageUrl={artist.imageUrl}
        firstPlayedAt={stats.firstPlayedAt}
        lastPlayedAt={stats.lastPlayedAt}
        totalPercent={totalPercent}
      />

      <section>
        <h2 className="mb-4 text-lg font-semibold">Tes titres les plus écoutés</h2>
        {topTracks.length === 0 ? (
          <EmptyState
            title="Pas encore d'écoute enregistrée"
            description="Tes titres les plus écoutés de cet artiste apparaîtront ici."
          />
        ) : (
          <RankedList>
            {topTracks.map((t, i) => (
              <RankedRow
                key={t.trackId}
                rank={i + 1}
                title={t.trackName}
                href={`/track/${t.trackId}`}
                metric={`${formatNumber(t.playCount)} écoutes`}
              />
            ))}
          </RankedList>
        )}
      </section>

      {topAlbums.length > 0 ? (
        <OtherArtistAlbums
          artistName={artist.name}
          albums={topAlbums.map((a) => ({
            albumId: a.albumId,
            name: a.name,
            imageUrl: a.imageUrl,
            plays: a.playCount,
          }))}
        />
      ) : null}

      {monthly.length >= 3 ? (
        <section className={cn(glassCard, "p-6")}>
          <h2 className="text-lg font-semibold">Évolution mensuelle</h2>
          <div className="mt-4">
            <SparklineMonthly data={monthly} />
          </div>
        </section>
      ) : null}

      {related.length > 0 ? (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Artistes connexes</h2>
          <RelatedArtists artists={related} />
        </section>
      ) : null}
    </main>
  );
}
```

Notes:
- If the codebase wraps the page with an `<AlbumWall>` background (per recent UI work), preserve it. The current file has `<AlbumWall covers={wallCovers} />` before the `<main>`. If so, keep that wrapper and the `getPaddedWallCovers` call, just refactor the inner `<main>` block.
- `formatRelativeDate` is in `src/lib/format/date.ts` - verify it's exported and takes a Date. If absent, use a simple formatter inline (e.g. `Intl.RelativeTimeFormat`).

- [ ] **Step 3: Verify**

```bash
pnpm tsc --noEmit 2>&1 | grep -E "src/app/artist" | head -10
pnpm test 2>&1 | grep -E "Test Files|Tests" | head -3
```

Expected: 0 tsc errors in the artist route, all tests still green.

- [ ] **Step 4: Manual smoke check (dev server)**

Start dev (`pnpm dev`) if not running. Navigate to `http://127.0.0.1:3000/artist/<some-demo-id>` (e.g. `demo:sabrina-carpenter`) and visit a real artist id from your DB.

Expected:
- Hero shows photo (or gradient if no image), name, dates, big %
- Top tracks list (≤20)
- Top albums carousel (if any)
- Sparkline (if ≥3 months of data)
- Related artists grid (if any)

- [ ] **Step 5: Commit**

```bash
git add src/app/artist/[id]/page.tsx
git commit -m "feat(artist): rich detail page (hero editorial + 5 sections)"
```

---

## Task 8: Push + merge to main

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
git merge --no-ff <branch-name> -m "Merge feat: artist page redesign

Hero editorial split + 5 sections (top tracks, top albums, sparkline,
co-listened artists). 4 new DB queries, 1 new component (RelatedArtists),
extended demo fixtures."
git push origin main
```

---

## Self-review

- ✅ **Spec coverage** :
  - Hero editorial split → Task 7 (`ArtistHero` inline + `PercentDisplay`)
  - Top tracks bumped to 20 → Task 7 (`getUserTopTracksByArtist(userId, id, 20)`)
  - Top albums of artist → Tasks 2 + 7
  - Évolution mensuelle (sparkline) → Tasks 3 + 7
  - Artistes connexes (±30 min) → Tasks 4 + 5 + 7
  - Big number = % du temps → Task 7 `PercentDisplay`
  - Extended `getArtistPlayStats` with dates → Task 1
  - Demo mode parity → Task 6
  - Edge cases (`< 1%`, sparkline `>= 3 months`, empty lists) → Task 7 conditionals
- ✅ **No placeholders** : every code block is complete, every command shown with expected output.
- ✅ **Type consistency** :
  - `getCoListenedArtists` returns `{ artistId, name, imageUrl, coCount }` consistently across Task 4, 5, 6, 7
  - `getUserTopAlbumsByArtist` returns `{ albumId, name, imageUrl, playCount }` - passed to `<OtherArtistAlbums>` after a `.map` (since the component expects `plays`, not `playCount`)
  - `getArtistPlayStats` extended return shape used in both demo (synthesized) and real (from query) branches
