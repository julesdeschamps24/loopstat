import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { albums, artists, streams, trackArtists, tracks } from "@/db/schema";

type ListeningWindow = "7d" | "30d" | "lifetime";

export async function getListeningTotals(
  userId: string,
): Promise<{ window: ListeningWindow; count: number; msPlayed: number }[]> {
  const now = Date.now();
  const windows: { window: ListeningWindow; since: Date | null }[] = [
    { window: "7d", since: new Date(now - 7 * 24 * 60 * 60 * 1000) },
    { window: "30d", since: new Date(now - 30 * 24 * 60 * 60 * 1000) },
    { window: "lifetime", since: null },
  ];

  const results = await Promise.all(
    windows.map(async ({ window, since }) => {
      const where = since
        ? and(eq(streams.userId, userId), gte(streams.playedAt, since))
        : eq(streams.userId, userId);

      const [row] = await db
        .select({
          count: sql<number>`count(*)::int`,
          msPlayed: sql<number>`coalesce(sum(${streams.msPlayed}), 0)::bigint`,
        })
        .from(streams)
        .where(where);

      return {
        window,
        count: Number(row?.count ?? 0),
        msPlayed: Number(row?.msPlayed ?? 0),
      };
    }),
  );

  return results;
}

export async function getPlayCountsForTracks(
  userId: string,
  trackIds: string[],
): Promise<Map<string, number>> {
  if (trackIds.length === 0) return new Map();

  const rows = await db
    .select({
      trackId: streams.trackId,
      count: sql<number>`count(*)::int`,
    })
    .from(streams)
    .where(and(eq(streams.userId, userId), inArray(streams.trackId, trackIds)))
    .groupBy(streams.trackId);

  return new Map(rows.map((r) => [r.trackId, Number(r.count)]));
}

export async function getPlayCountsForArtists(
  userId: string,
  artistIds: string[],
): Promise<Map<string, number>> {
  if (artistIds.length === 0) return new Map();

  const rows = await db
    .select({
      artistId: trackArtists.artistId,
      count: sql<number>`count(*)::int`,
    })
    .from(streams)
    .innerJoin(trackArtists, eq(trackArtists.trackId, streams.trackId))
    .where(and(eq(streams.userId, userId), inArray(trackArtists.artistId, artistIds)))
    .groupBy(trackArtists.artistId);

  return new Map(rows.map((r) => [r.artistId, Number(r.count)]));
}

export async function getTrackPlayStats(
  userId: string,
  trackId: string,
): Promise<{ count: number; firstPlayedAt: Date | null; lastPlayedAt: Date | null }> {
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      firstPlayedAt: sql<string | null>`min(${streams.playedAt})`,
      lastPlayedAt: sql<string | null>`max(${streams.playedAt})`,
    })
    .from(streams)
    .where(and(eq(streams.userId, userId), eq(streams.trackId, trackId)));

  return {
    count: Number(row?.count ?? 0),
    firstPlayedAt: row?.firstPlayedAt ? new Date(row.firstPlayedAt) : null,
    lastPlayedAt: row?.lastPlayedAt ? new Date(row.lastPlayedAt) : null,
  };
}

export async function getArtistPlayStats(
  userId: string,
  artistId: string,
): Promise<{ count: number }> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(streams)
    .innerJoin(trackArtists, eq(trackArtists.trackId, streams.trackId))
    .where(and(eq(streams.userId, userId), eq(trackArtists.artistId, artistId)));

  return { count: Number(row?.count ?? 0) };
}

export async function getUserTopTracksByArtist(
  userId: string,
  artistId: string,
  limit: number,
): Promise<{ trackId: string; trackName: string; playCount: number }[]> {
  const rows = await db
    .select({
      trackId: streams.trackId,
      trackName: tracks.name,
      playCount: sql<number>`count(*)::int`,
    })
    .from(streams)
    .innerJoin(trackArtists, eq(trackArtists.trackId, streams.trackId))
    .innerJoin(tracks, eq(tracks.id, streams.trackId))
    .where(and(eq(streams.userId, userId), eq(trackArtists.artistId, artistId)))
    .groupBy(streams.trackId, tracks.name)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  return rows.map((r) => ({
    trackId: r.trackId,
    trackName: r.trackName,
    playCount: Number(r.playCount),
  }));
}

export async function getAlbumPlayStats(
  userId: string,
  albumId: string,
): Promise<{ count: number }> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(streams)
    .innerJoin(tracks, eq(tracks.id, streams.trackId))
    .where(and(eq(streams.userId, userId), eq(tracks.albumId, albumId)));

  return { count: Number(row?.count ?? 0) };
}

/**
 * Listening distribution by hour of day (0-23). Returns a dense 24-element
 * array so callers can render every bucket without gap-filling.
 *
 * NOTE: groups on `EXTRACT(HOUR FROM played_at)` using the DB/server
 * timezone — there is no per-user timezone in MVP scope.
 */
export async function getListeningClock(
  userId: string,
): Promise<{ hour: number; count: number }[]> {
  const rows = await db
    .select({
      hour: sql<number>`extract(hour from ${streams.playedAt})::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(streams)
    .where(eq(streams.userId, userId))
    .groupBy(sql`extract(hour from ${streams.playedAt})`);

  const counts = new Map(rows.map((r) => [Number(r.hour), Number(r.count)]));
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: counts.get(hour) ?? 0,
  }));
}

export async function getRecentStreams(
  userId: string,
  limit: number,
): Promise<
  {
    playedAt: Date;
    trackId: string;
    trackName: string;
    artistNames: string[];
    albumImageUrl: string | null;
  }[]
> {
  const rows = await db
    .select({
      playedAt: streams.playedAt,
      trackId: streams.trackId,
      trackName: tracks.name,
      albumImageUrl: albums.imageUrl,
    })
    .from(streams)
    .innerJoin(tracks, eq(tracks.id, streams.trackId))
    .leftJoin(albums, eq(albums.id, tracks.albumId))
    .where(eq(streams.userId, userId))
    .orderBy(desc(streams.playedAt))
    .limit(limit);

  if (rows.length === 0) return [];

  const trackIds = [...new Set(rows.map((r) => r.trackId))];
  const artistRows = await db
    .select({
      trackId: trackArtists.trackId,
      artistName: artists.name,
      position: trackArtists.position,
    })
    .from(trackArtists)
    .innerJoin(artists, eq(artists.id, trackArtists.artistId))
    .where(inArray(trackArtists.trackId, trackIds))
    .orderBy(trackArtists.trackId, trackArtists.position);

  const artistsByTrack = new Map<string, string[]>();
  for (const r of artistRows) {
    const list = artistsByTrack.get(r.trackId) ?? [];
    list.push(r.artistName);
    artistsByTrack.set(r.trackId, list);
  }

  return rows.map((r) => ({
    playedAt: r.playedAt,
    trackId: r.trackId,
    trackName: r.trackName,
    artistNames: artistsByTrack.get(r.trackId) ?? [],
    albumImageUrl: r.albumImageUrl,
  }));
}
