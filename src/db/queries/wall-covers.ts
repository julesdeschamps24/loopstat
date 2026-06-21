import { and, desc, eq, gte, inArray, isNotNull, isNull, not, or, sql } from "drizzle-orm";

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
 * Convenience wrapper used by every page that renders <AlbumWall> as
 * background : fetches top albums (with global catalog padding) and pads
 * to exactly `cells` entries so the wall grid is always full. Avoids
 * duplicating the padding loop across callsites.
 */
export async function getPaddedWallCovers(
  userId: string | null,
  since: Date | null,
  cells: number,
): Promise<WallAlbum[]> {
  const albums = await getWallCovers(userId, since, cells);
  const padded: WallAlbum[] = [...albums];
  while (padded.length < cells) {
    padded.push({ name: `slot-${padded.length}`, imageUrl: null });
  }
  return padded;
}

/**
 * Top N albums for the wall background, ALWAYS with covers.
 *
 * Strategy:
 *  1. User's own top albums (by play count) that are enriched (image_url set).
 *  2. If less than `limit`, pad with other enriched albums from the global
 *     catalog (= any album any user has played that has a cover). This keeps
 *     the wall visually full while the background enrich worker catches up
 *     with the user's tail of unenriched albums.
 *
 * `imageUrl` in the returned shape is non-null in practice. The type stays
 * nullable so AlbumWall's gradient fallback handles the (rare) edge case of
 * a brand-new catalog with no enriched albums anywhere.
 */
export async function getWallCovers(
  userId: string | null,
  since: Date | null,
  limit: number,
): Promise<WallAlbum[]> {
  // Anonymous (no userId, e.g. logged-out /pricing visitor): skip the
  // user-scoped query — the wall is filled entirely from the global catalog
  // favourites below. (Passing a non-uuid placeholder here crashes Postgres.)
  const userTop = userId
    ? await db
        .select({
          albumId: albums.id,
          name: albums.name,
          imageUrl: albums.imageUrl,
        })
        .from(streams)
        .innerJoin(tracks, eq(tracks.id, streams.trackId))
        .innerJoin(albums, eq(albums.id, tracks.albumId))
        .where(
          and(
            eq(streams.userId, userId),
            since ? gte(streams.playedAt, since) : undefined,
            isNotNull(albums.imageUrl),
            QUALIFYING_PLAY,
          ),
        )
        .groupBy(albums.id, albums.name, albums.imageUrl)
        .orderBy(desc(sql`count(*)`))
        .limit(limit)
    : [];

  if (userTop.length >= limit) {
    return userTop.map((r) => ({ name: r.name, imageUrl: r.imageUrl }));
  }

  // Pad with other enriched albums from the catalog, excluding the user's
  // top set. Ordered by global play frequency so the most-listened albums
  // (across all users) appear first — the wall looks like a curated mood
  // board instead of random.
  const exclude = userTop.map((r) => r.albumId);
  const fillerWhere = and(
    isNotNull(albums.imageUrl),
    exclude.length > 0 ? not(inArray(albums.id, exclude)) : undefined,
  );

  const filler = await db
    .select({
      name: albums.name,
      imageUrl: albums.imageUrl,
      plays: sql<number>`count(${streams.id})::int`,
    })
    .from(albums)
    .leftJoin(tracks, eq(tracks.albumId, albums.id))
    .leftJoin(streams, eq(streams.trackId, tracks.id))
    .where(fillerWhere)
    .groupBy(albums.id, albums.name, albums.imageUrl)
    .orderBy(desc(sql`count(${streams.id})`))
    .limit(limit - userTop.length);

  return [
    ...userTop.map((r) => ({ name: r.name, imageUrl: r.imageUrl })),
    ...filler.map((r) => ({ name: r.name, imageUrl: r.imageUrl })),
  ];
}
