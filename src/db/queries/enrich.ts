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
