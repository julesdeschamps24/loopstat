import { and, desc, eq, gte, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { albums, streams, tracks } from "@/db/schema";

/**
 * What counts as a "real" play, matching Spotify's own definition:
 * ms_played >= 30 000 (30 s) OR ms_played is null (= polling source where
 * the duration isn't available, but Spotify has already counted the play
 * server-side). Plays under 30 s are skips and don't count.
 */
const QUALIFYING_PLAY = or(
  gte(streams.msPlayed, 30000),
  isNull(streams.msPlayed),
);

export interface WallAlbum {
  name: string;
  imageUrl: string | null;
}

/**
 * Top N albums (by play count) for a user over a period, deduped by album_id.
 * Returns albums even when they don't yet have a cover URL — the consumer
 * (AlbumWall) renders a deterministic gradient fallback derived from the
 * album name. As the background enrich job populates albums.image_url over
 * time, each reload of the dashboard reveals more real covers.
 */
export async function getWallCovers(
  userId: string,
  since: Date | null,
  limit: number,
): Promise<WallAlbum[]> {
  const where = and(
    eq(streams.userId, userId),
    since ? gte(streams.playedAt, since) : undefined,
    QUALIFYING_PLAY,
  );

  const rows = await db
    .select({
      albumId: albums.id,
      name: albums.name,
      imageUrl: albums.imageUrl,
      plays: sql<number>`count(*)::int`,
    })
    .from(streams)
    .innerJoin(tracks, eq(tracks.id, streams.trackId))
    .innerJoin(albums, eq(albums.id, tracks.albumId))
    .where(where)
    .groupBy(albums.id, albums.name, albums.imageUrl)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  return rows.map((r) => ({ name: r.name, imageUrl: r.imageUrl }));
}
