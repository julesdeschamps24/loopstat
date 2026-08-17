import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { albums, streams, tracks, trackArtists } from "@/db/schema";

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

import { periodSince, type StreamPeriod } from "@/lib/stats/period";

/**
 * Tiered limits per time window for the priority enrich pass. 1w is the
 * default period shown on /top/* - gets the largest slice. Older windows
 * get smaller slices since they're consulted less often. "all" ferme la
 * marche avec le top 100 complet : c'est la vue "Tout" des pages /top/*
 * (et la vue par défaut des profils partagés) - sans ce tier, ses entrées
 * de milieu de liste attendaient le sweep global.
 */
const WINDOW_LIMITS: { window: StreamPeriod; limit: number }[] = [
  { window: "1w", limit: 100 },
  { window: "4w", limit: 50 },
  { window: "6m", limit: 30 },
  { window: "1y", limit: 30 },
  { window: "all", limit: 100 },
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
