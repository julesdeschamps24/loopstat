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
