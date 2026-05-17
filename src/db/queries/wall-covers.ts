import { and, desc, eq, gte, isNotNull, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { albums, streams, tracks } from "@/db/schema";

/**
 * What counts as a "real" play, matching Spotify's own definition:
 * ms_played >= 30 000 (30 s) OR ms_played is null (= polling source where
 * the duration isn't available, but Spotify has already counted the play
 * server-side). Plays under 30 s are skips and don't count.
 *
 * Applied to every aggregation that reports play counts to the user. NOT
 * applied to `getTrackPlayQuality` which explicitly inspects skip rate.
 */
const QUALIFYING_PLAY = or(
  gte(streams.msPlayed, 30000),
  isNull(streams.msPlayed),
);

/**
 * Top N album cover URLs for a user over a period, deduped by album_id.
 * Used as the `bg=wall` collage on share cards (echoes the dashboard
 * album wall pattern from src/components/album-wall.tsx).
 *
 * Returns absolute Spotify CDN URLs only (skips albums without artwork).
 */
export async function getWallCovers(
  userId: string,
  since: Date | null,
  limit: number,
): Promise<string[]> {
  const where = and(
    eq(streams.userId, userId),
    since ? gte(streams.playedAt, since) : undefined,
    isNotNull(albums.imageUrl),
    QUALIFYING_PLAY,
  );

  const rows = await db
    .select({
      albumId: albums.id,
      imageUrl: albums.imageUrl,
      plays: sql<number>`count(*)::int`,
    })
    .from(streams)
    .innerJoin(tracks, eq(tracks.id, streams.trackId))
    .innerJoin(albums, eq(albums.id, tracks.albumId))
    .where(where)
    .groupBy(albums.id, albums.imageUrl)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  return rows
    .map((r) => r.imageUrl)
    .filter((url): url is string => url !== null);
}
