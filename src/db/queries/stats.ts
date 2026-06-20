import { cache } from "react";

import { and, asc, desc, eq, gte, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { albumArtists, albums, artists, streams, trackArtists, tracks } from "@/db/schema";
import { escapeLikePattern } from "@/db/queries/users";
import { periodSince, type StreamPeriod } from "@/lib/stats/period";

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
 * The user's most recent play timestamp, cached per request. Used as the
 * reference "now" for period windows on user-owned pages — since the data
 * is a static JSON import that may end days/weeks before today, anchoring
 * "last 7 days" to MAX(played_at) keeps the windows meaningful.
 *
 * Returns null if the user has no plays — callers should fall back to
 * `Date.now()` so the UI doesn't break for fresh accounts.
 */
export const getUserLatestPlayedAt = cache(async (userId: string): Promise<Date | null> => {
  // postgres-js returns timestamp columns as strings, not Date objects —
  // the Drizzle `sql<Date>` type hint lies at runtime. Coerce explicitly.
  const [row] = await db
    .select({ max: sql<string | null>`max(${streams.playedAt})` })
    .from(streams)
    .where(eq(streams.userId, userId));
  return row?.max ? new Date(row.max) : null;
});

type ListeningWindow = "7d" | "30d" | "lifetime";

export async function getListeningTotals(
  userId: string,
  ref: Date = new Date(),
): Promise<{ window: ListeningWindow; count: number; msPlayed: number }[]> {
  const now = ref.getTime();
  const windows: { window: ListeningWindow; since: Date | null }[] = [
    { window: "7d", since: new Date(now - 7 * 24 * 60 * 60 * 1000) },
    { window: "30d", since: new Date(now - 30 * 24 * 60 * 60 * 1000) },
    { window: "lifetime", since: null },
  ];

  const results = await Promise.all(
    windows.map(async ({ window, since }) => {
      const where = since
        ? and(
            eq(streams.userId, userId),
            gte(streams.playedAt, since),
            QUALIFYING_PLAY,
          )
        : and(eq(streams.userId, userId), QUALIFYING_PLAY);

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
    .where(
      and(
        eq(streams.userId, userId),
        inArray(streams.trackId, trackIds),
        QUALIFYING_PLAY,
      ),
    )
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
    .where(
      and(
        eq(streams.userId, userId),
        inArray(trackArtists.artistId, artistIds),
        QUALIFYING_PLAY,
      ),
    )
    .groupBy(trackArtists.artistId);

  return new Map(rows.map((r) => [r.artistId, Number(r.count)]));
}

export async function getTrackPlayStats(
  userId: string,
  trackId: string,
  since: Date | null = null,
): Promise<{ count: number; firstPlayedAt: Date | null; lastPlayedAt: Date | null }> {
  const whereClause = since
    ? and(
        eq(streams.userId, userId),
        eq(streams.trackId, trackId),
        gte(streams.playedAt, since),
        QUALIFYING_PLAY,
      )
    : and(
        eq(streams.userId, userId),
        eq(streams.trackId, trackId),
        QUALIFYING_PLAY,
      );

  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      firstPlayedAt: sql<string | null>`min(${streams.playedAt})`,
      lastPlayedAt: sql<string | null>`max(${streams.playedAt})`,
    })
    .from(streams)
    .where(whereClause);

  return {
    count: Number(row?.count ?? 0),
    firstPlayedAt: row?.firstPlayedAt ? new Date(row.firstPlayedAt) : null,
    lastPlayedAt: row?.lastPlayedAt ? new Date(row.lastPlayedAt) : null,
  };
}

/**
 * Total ms_played by the user, optionally filtered to streams since a date.
 * Used as the denominator for "% du temps" computations that need to match
 * a period filter applied elsewhere.
 */
export async function getUserTotalMsPlayed(
  userId: string,
  since: Date | null = null,
): Promise<number> {
  const whereClause = since
    ? and(eq(streams.userId, userId), gte(streams.playedAt, since), QUALIFYING_PLAY)
    : and(eq(streams.userId, userId), QUALIFYING_PLAY);

  const [row] = await db
    .select({
      msPlayed: sql<number>`coalesce(sum(${streams.msPlayed}), 0)::bigint`,
    })
    .from(streams)
    .where(whereClause);

  return Number(row?.msPlayed ?? 0);
}

export async function getArtistPlayStats(
  userId: string,
  artistId: string,
  since: Date | null = null,
): Promise<{
  count: number;
  msPlayed: number;
  firstPlayedAt: Date | null;
  lastPlayedAt: Date | null;
}> {
  const whereClause = since
    ? and(
        eq(streams.userId, userId),
        eq(trackArtists.artistId, artistId),
        gte(streams.playedAt, since),
        QUALIFYING_PLAY,
      )
    : and(
        eq(streams.userId, userId),
        eq(trackArtists.artistId, artistId),
        QUALIFYING_PLAY,
      );

  // postgres-js returns timestamp aggregates as ISO strings, not Date —
  // the `sql<Date>` annotation lies at runtime. Type as string + coerce.
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      msPlayed: sql<number>`coalesce(sum(${streams.msPlayed}), 0)::bigint`,
      firstPlayedAt: sql<string | null>`min(${streams.playedAt})`,
      lastPlayedAt: sql<string | null>`max(${streams.playedAt})`,
    })
    .from(streams)
    .innerJoin(trackArtists, eq(trackArtists.trackId, streams.trackId))
    .where(whereClause);

  return {
    count: Number(row?.count ?? 0),
    msPlayed: Number(row?.msPlayed ?? 0),
    firstPlayedAt: row?.firstPlayedAt ? new Date(row.firstPlayedAt) : null,
    lastPlayedAt: row?.lastPlayedAt ? new Date(row.lastPlayedAt) : null,
  };
}

export async function getUserTopTracksByArtist(
  userId: string,
  artistId: string,
  limit: number,
  since: Date | null = null,
): Promise<{ trackId: string; trackName: string; playCount: number }[]> {
  const whereClause = since
    ? and(
        eq(streams.userId, userId),
        eq(trackArtists.artistId, artistId),
        gte(streams.playedAt, since),
        QUALIFYING_PLAY,
      )
    : and(
        eq(streams.userId, userId),
        eq(trackArtists.artistId, artistId),
        QUALIFYING_PLAY,
      );

  const rows = await db
    .select({
      trackId: streams.trackId,
      trackName: tracks.name,
      playCount: sql<number>`count(*)::int`,
    })
    .from(streams)
    .innerJoin(trackArtists, eq(trackArtists.trackId, streams.trackId))
    .innerJoin(tracks, eq(tracks.id, streams.trackId))
    .where(whereClause)
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
  since: Date | null = null,
): Promise<{
  count: number;
  firstPlayedAt: Date | null;
  lastPlayedAt: Date | null;
  totalMsPlayed: number;
}> {
  const whereClause = since
    ? and(
        eq(streams.userId, userId),
        eq(tracks.albumId, albumId),
        gte(streams.playedAt, since),
        QUALIFYING_PLAY,
      )
    : and(
        eq(streams.userId, userId),
        eq(tracks.albumId, albumId),
        QUALIFYING_PLAY,
      );

  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      firstPlayedAt: sql<string | null>`min(${streams.playedAt})`,
      lastPlayedAt: sql<string | null>`max(${streams.playedAt})`,
      totalMsPlayed: sql<string | null>`coalesce(sum(${streams.msPlayed}), 0)`,
    })
    .from(streams)
    .innerJoin(tracks, eq(tracks.id, streams.trackId))
    .where(whereClause);

  return {
    count: Number(row?.count ?? 0),
    firstPlayedAt: row?.firstPlayedAt ? new Date(row.firstPlayedAt) : null,
    lastPlayedAt: row?.lastPlayedAt ? new Date(row.lastPlayedAt) : null,
    totalMsPlayed: Number(row?.totalMsPlayed ?? 0),
  };
}

/**
 * Pour chaque track de l'album, son nombre de plays par l'utilisateur (incluant
 * les tracks à 0 plays via LEFT JOIN streams). Tri par `track_number` ASC
 * (ordre album). Utilisé par la tracklist avec barres de proportion.
 */
export async function getAlbumTrackPlays(
  userId: string,
  albumId: string,
  since: Date | null = null,
): Promise<
  { trackId: string; name: string; trackNumber: number | null; plays: number }[]
> {
  const sinceFilter = since
    ? sql`and ${streams.playedAt} >= ${since}`
    : sql``;

  const rows = await db
    .select({
      trackId: tracks.id,
      name: tracks.name,
      plays: sql<number>`coalesce(count(${streams.id}) filter (where ${streams.userId} = ${userId} and ${QUALIFYING_PLAY} ${sinceFilter}), 0)::int`,
    })
    .from(tracks)
    .leftJoin(streams, eq(streams.trackId, tracks.id))
    .where(eq(tracks.albumId, albumId))
    .groupBy(tracks.id, tracks.name)
    .orderBy(asc(tracks.name));

  return rows.map((r) => ({
    trackId: r.trackId,
    name: r.name,
    trackNumber: null,
    plays: Number(r.plays),
  }));
}

/**
 * Top tracks aggregated from the local streams table. Replaces the
 * Spotify-API-backed top list for the /top/tracks page now that we have
 * the full lifetime history imported. No 50-track cap, consistent counts
 * across all windows including "all time".
 *
 * Returns the track id, name, album cover, joined artist names (ordered
 * by position) and the play count for the window.
 */
export async function getTopTracksFromStreams(
  userId: string,
  since: Date | null,
  limit: number,
): Promise<
  {
    trackId: string;
    name: string;
    albumImageUrl: string | null;
    artistNames: string[];
    plays: number;
  }[]
> {
  const where = since
    ? and(
        eq(streams.userId, userId),
        gte(streams.playedAt, since),
        QUALIFYING_PLAY,
      )
    : and(eq(streams.userId, userId), QUALIFYING_PLAY);

  const rows = await db
    .select({
      trackId: streams.trackId,
      name: tracks.name,
      albumImageUrl: albums.imageUrl,
      plays: sql<number>`count(*)::int`,
    })
    .from(streams)
    .innerJoin(tracks, eq(tracks.id, streams.trackId))
    .leftJoin(albums, eq(albums.id, tracks.albumId))
    .where(where)
    .groupBy(streams.trackId, tracks.name, albums.imageUrl)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  if (rows.length === 0) return [];

  // Second query: fetch artist names for these tracks in one shot, then
  // join in JS. Doing this inline in the aggregation would multiply
  // grouping rows by artist count and break the COUNT(*).
  const trackIds = rows.map((r) => r.trackId);
  const artistRows = await db
    .select({
      trackId: trackArtists.trackId,
      name: artists.name,
      position: trackArtists.position,
    })
    .from(trackArtists)
    .innerJoin(artists, eq(artists.id, trackArtists.artistId))
    .where(inArray(trackArtists.trackId, trackIds))
    .orderBy(asc(trackArtists.trackId), asc(trackArtists.position));

  const namesByTrack = new Map<string, string[]>();
  for (const row of artistRows) {
    const list = namesByTrack.get(row.trackId) ?? [];
    list.push(row.name);
    namesByTrack.set(row.trackId, list);
  }

  return rows.map((r) => ({
    trackId: r.trackId,
    name: r.name,
    albumImageUrl: r.albumImageUrl,
    artistNames: namesByTrack.get(r.trackId) ?? [],
    plays: Number(r.plays),
  }));
}

/**
 * Top artistes agrégés depuis la table streams locale. Même approche que
 * getTopTracksFromStreams : COUNT(*) sur les streams qualifying, JOIN sur
 * trackArtists pour obtenir l'artiste, puis fetch en seconde passe le name +
 * imageUrl. Pas de limite à 50, "all time" trivial, chiffres cohérents avec
 * la période sélectionnée.
 */
export async function getTopArtistsFromStreams(
  userId: string,
  since: Date | null,
  limit: number,
): Promise<
  {
    artistId: string;
    name: string;
    imageUrl: string | null;
    plays: number;
  }[]
> {
  const where = since
    ? and(
        eq(streams.userId, userId),
        gte(streams.playedAt, since),
        QUALIFYING_PLAY,
      )
    : and(eq(streams.userId, userId), QUALIFYING_PLAY);

  const rows = await db
    .select({
      artistId: trackArtists.artistId,
      plays: sql<number>`count(*)::int`,
    })
    .from(streams)
    .innerJoin(trackArtists, eq(trackArtists.trackId, streams.trackId))
    .where(where)
    .groupBy(trackArtists.artistId)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  if (rows.length === 0) return [];

  // Seconde query pour name + imageUrl en un round-trip.
  const artistIds = rows.map((r) => r.artistId);
  const meta = await db
    .select({
      id: artists.id,
      name: artists.name,
      imageUrl: artists.imageUrl,
    })
    .from(artists)
    .where(inArray(artists.id, artistIds));

  const metaById = new Map(meta.map((a) => [a.id, a]));

  return rows.map((r) => {
    const m = metaById.get(r.artistId);
    return {
      artistId: r.artistId,
      name: m?.name ?? r.artistId,
      imageUrl: m?.imageUrl ?? null,
      plays: Number(r.plays),
    };
  });
}

/**
 * Top albums agrégés depuis la table streams locale. JOIN streams → tracks
 * → albums pour récupérer l'album_id, puis COUNT par album. Skip les
 * streams dont le track n'a pas d'album_id (track non encore enrichi par
 * le worker — leur album sera comptabilisé quand l'enrich aura tourné).
 */
export async function getTopAlbumsFromStreams(
  userId: string,
  since: Date | null,
  limit: number,
): Promise<
  {
    albumId: string;
    name: string;
    imageUrl: string | null;
    artistNames: string[];
    plays: number;
  }[]
> {
  const where = since
    ? and(
        eq(streams.userId, userId),
        gte(streams.playedAt, since),
        QUALIFYING_PLAY,
      )
    : and(eq(streams.userId, userId), QUALIFYING_PLAY);

  const rows = await db
    .select({
      albumId: tracks.albumId,
      name: albums.name,
      imageUrl: albums.imageUrl,
      plays: sql<number>`count(*)::int`,
    })
    .from(streams)
    .innerJoin(tracks, eq(tracks.id, streams.trackId))
    .innerJoin(albums, eq(albums.id, tracks.albumId))
    .where(where)
    .groupBy(tracks.albumId, albums.name, albums.imageUrl)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  if (rows.length === 0) return [];

  // Récupère les noms d'artistes par album (en seconde passe pour les
  // mêmes raisons que dans getTopTracksFromStreams).
  const albumIds = rows
    .map((r) => r.albumId)
    .filter((id): id is string => id !== null);
  const artistRows = await db
    .select({
      albumId: sql<string>`${tracks.albumId}`,
      name: artists.name,
      position: trackArtists.position,
    })
    .from(tracks)
    .innerJoin(trackArtists, eq(trackArtists.trackId, tracks.id))
    .innerJoin(artists, eq(artists.id, trackArtists.artistId))
    .where(inArray(tracks.albumId, albumIds))
    .orderBy(asc(tracks.albumId), asc(trackArtists.position));

  // Dédup les artistes par album (un album a typiquement N tracks × M
  // artistes = potentiellement beaucoup de doublons via le JOIN).
  const namesByAlbum = new Map<string, Set<string>>();
  for (const row of artistRows) {
    const set = namesByAlbum.get(row.albumId) ?? new Set<string>();
    set.add(row.name);
    namesByAlbum.set(row.albumId, set);
  }

  return rows.map((r) => ({
    albumId: r.albumId as string,
    name: r.name,
    imageUrl: r.imageUrl,
    artistNames: Array.from(namesByAlbum.get(r.albumId as string) ?? []),
    plays: Number(r.plays),
  }));
}

/**
 * Per-window play counts for a single track. Used on the track detail
 * page to show "4w / 6m / 1y / all" breakdown.
 */
export async function getTrackBreakdownByWindow(
  userId: string,
  trackId: string,
): Promise<Record<StreamPeriod, number>> {
  const windows: StreamPeriod[] = ["1w", "4w", "6m", "1y", "all"];

  const results = await Promise.all(
    windows.map(async (window) => {
      const since = periodSince(window);
      const where = since
        ? and(
            eq(streams.userId, userId),
            eq(streams.trackId, trackId),
            gte(streams.playedAt, since),
            QUALIFYING_PLAY,
          )
        : and(
            eq(streams.userId, userId),
            eq(streams.trackId, trackId),
            QUALIFYING_PLAY,
          );

      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(streams)
        .where(where);

      return [window, Number(row?.count ?? 0)] as const;
    }),
  );

  return Object.fromEntries(results) as Record<StreamPeriod, number>;
}

/**
 * Monthly play counts for a single track, ordered chronologically. Used
 * for the sparkline on the track detail page. Months with zero plays are
 * NOT returned — caller can gap-fill if a dense series is needed.
 */
export async function getTrackMonthlyPlays(
  userId: string,
  trackId: string,
): Promise<{ month: Date; plays: number }[]> {
  const rows = await db
    .select({
      month: sql<string>`date_trunc('month', ${streams.playedAt})::text`,
      plays: sql<number>`count(*)::int`,
    })
    .from(streams)
    .where(
      and(
        eq(streams.userId, userId),
        eq(streams.trackId, trackId),
        QUALIFYING_PLAY,
      ),
    )
    .groupBy(sql`date_trunc('month', ${streams.playedAt})`)
    .orderBy(asc(sql`date_trunc('month', ${streams.playedAt})`));

  return rows.map((r) => ({
    month: new Date(r.month),
    plays: Number(r.plays),
  }));
}

/**
 * Per-track listening distribution by hour of day (0-23). Same shape as
 * `getListeningClock` but scoped to one track.
 */
export async function getTrackListeningHours(
  userId: string,
  trackId: string,
  since: Date | null = null,
): Promise<{ hour: number; count: number }[]> {
  const whereClause = since
    ? and(
        eq(streams.userId, userId),
        eq(streams.trackId, trackId),
        gte(streams.playedAt, since),
        QUALIFYING_PLAY,
      )
    : and(
        eq(streams.userId, userId),
        eq(streams.trackId, trackId),
        QUALIFYING_PLAY,
      );

  const rows = await db
    .select({
      hour: sql<number>`extract(hour from ${streams.playedAt})::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(streams)
    .where(whereClause)
    .groupBy(sql`extract(hour from ${streams.playedAt})`);

  const counts = new Map(rows.map((r) => [Number(r.hour), Number(r.count)]));
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: counts.get(hour) ?? 0,
  }));
}

/**
 * "Quality" of plays for a track: avg ms played + skip rate. Skips are
 * defined as plays under 30s (Spotify's own definition).
 *
 * Returns NULL for both if every stream for this track has
 * `ms_played = null` (e.g. older polling sources didn't record duration).
 */
export async function getTrackPlayQuality(
  userId: string,
  trackId: string,
  since: Date | null = null,
): Promise<{ avgMs: number | null; skipRate: number | null }> {
  const whereClause = since
    ? and(
        eq(streams.userId, userId),
        eq(streams.trackId, trackId),
        gte(streams.playedAt, since),
      )
    : and(eq(streams.userId, userId), eq(streams.trackId, trackId));

  const [row] = await db
    .select({
      avgMs: sql<string | null>`avg(${streams.msPlayed}) filter (where ${streams.msPlayed} is not null)`,
      skipRate: sql<string | null>`
        (sum(case when ${streams.msPlayed} < 30000 then 1 else 0 end)::float
         / nullif(count(*) filter (where ${streams.msPlayed} is not null), 0))
      `,
    })
    .from(streams)
    .where(whereClause);

  return {
    avgMs: row?.avgMs != null ? Number(row.avgMs) : null,
    skipRate: row?.skipRate != null ? Number(row.skipRate) : null,
  };
}

/**
 * ILIKE search on track names, restricted to tracks the user has actually
 * streamed (so the sidebar search finds music from their own catalog, not
 * random Spotify tracks). Ordered by play count desc.
 *
 * Caller is responsible for trimming + length-validating `query`.
 */
export async function searchTracks(
  userId: string,
  query: string,
  limit: number,
): Promise<
  {
    trackId: string;
    name: string;
    albumImageUrl: string | null;
    artistNames: string[];
    plays: number;
  }[]
> {
  const rows = await db
    .select({
      trackId: tracks.id,
      name: tracks.name,
      albumImageUrl: albums.imageUrl,
      plays: sql<number>`count(${streams.id})::int`,
    })
    .from(tracks)
    .innerJoin(streams, eq(streams.trackId, tracks.id))
    .leftJoin(albums, eq(albums.id, tracks.albumId))
    .where(
      and(
        eq(streams.userId, userId),
        ilike(tracks.name, `%${escapeLikePattern(query)}%`),
        QUALIFYING_PLAY,
      ),
    )
    .groupBy(tracks.id, tracks.name, albums.imageUrl)
    .orderBy(desc(sql`count(${streams.id})`))
    .limit(limit);

  if (rows.length === 0) return [];

  const trackIds = rows.map((r) => r.trackId);
  const artistRows = await db
    .select({
      trackId: trackArtists.trackId,
      name: artists.name,
      position: trackArtists.position,
    })
    .from(trackArtists)
    .innerJoin(artists, eq(artists.id, trackArtists.artistId))
    .where(inArray(trackArtists.trackId, trackIds))
    .orderBy(asc(trackArtists.trackId), asc(trackArtists.position));

  const namesByTrack = new Map<string, string[]>();
  for (const row of artistRows) {
    const list = namesByTrack.get(row.trackId) ?? [];
    list.push(row.name);
    namesByTrack.set(row.trackId, list);
  }

  return rows.map((r) => ({
    trackId: r.trackId,
    name: r.name,
    albumImageUrl: r.albumImageUrl,
    artistNames: namesByTrack.get(r.trackId) ?? [],
    plays: Number(r.plays),
  }));
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
    .where(and(eq(streams.userId, userId), QUALIFYING_PLAY))
    .groupBy(sql`extract(hour from ${streams.playedAt})`);

  const counts = new Map(rows.map((r) => [Number(r.hour), Number(r.count)]));
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: counts.get(hour) ?? 0,
  }));
}

/**
 * Nombre de plays sur l'album, ventilé par fenêtre (4w / 6m / 1y / all).
 * Pattern identique à getTrackBreakdownByWindow avec tracks.albumId = ?.
 */
export async function getAlbumBreakdownByWindow(
  userId: string,
  albumId: string,
): Promise<Record<StreamPeriod, number>> {
  const windows: StreamPeriod[] = ["1w", "4w", "6m", "1y", "all"];

  const results = await Promise.all(
    windows.map(async (window) => {
      const since = periodSince(window);
      const where = since
        ? and(
            eq(streams.userId, userId),
            eq(tracks.albumId, albumId),
            gte(streams.playedAt, since),
            QUALIFYING_PLAY,
          )
        : and(
            eq(streams.userId, userId),
            eq(tracks.albumId, albumId),
            QUALIFYING_PLAY,
          );

      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(streams)
        .innerJoin(tracks, eq(tracks.id, streams.trackId))
        .where(where);

      return [window, Number(row?.count ?? 0)] as const;
    }),
  );

  return Object.fromEntries(results) as Record<StreamPeriod, number>;
}

/**
 * Plays mensuels agrégés au niveau album, ordre chronologique. Mois à 0 plays
 * NON retournés.
 */
export async function getAlbumMonthlyPlays(
  userId: string,
  albumId: string,
): Promise<{ month: Date; plays: number }[]> {
  const rows = await db
    .select({
      month: sql<string>`date_trunc('month', ${streams.playedAt})::text`,
      plays: sql<number>`count(*)::int`,
    })
    .from(streams)
    .innerJoin(tracks, eq(tracks.id, streams.trackId))
    .where(
      and(
        eq(streams.userId, userId),
        eq(tracks.albumId, albumId),
        QUALIFYING_PLAY,
      ),
    )
    .groupBy(sql`date_trunc('month', ${streams.playedAt})`)
    .orderBy(asc(sql`date_trunc('month', ${streams.playedAt})`));

  return rows.map((r) => ({
    month: new Date(r.month),
    plays: Number(r.plays),
  }));
}

/**
 * Distribution des écoutes de l'album par heure de la journée (0-23). Retourne
 * toujours 24 entrées (heures sans écoute = count 0).
 */
export async function getAlbumListeningHours(
  userId: string,
  albumId: string,
  since: Date | null = null,
): Promise<{ hour: number; count: number }[]> {
  const whereClause = since
    ? and(
        eq(streams.userId, userId),
        eq(tracks.albumId, albumId),
        gte(streams.playedAt, since),
        QUALIFYING_PLAY,
      )
    : and(
        eq(streams.userId, userId),
        eq(tracks.albumId, albumId),
        QUALIFYING_PLAY,
      );

  const rows = await db
    .select({
      hour: sql<number>`extract(hour from ${streams.playedAt})::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(streams)
    .innerJoin(tracks, eq(tracks.id, streams.trackId))
    .where(whereClause)
    .groupBy(sql`extract(hour from ${streams.playedAt})`);

  const counts = new Map(rows.map((r) => [Number(r.hour), Number(r.count)]));
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: counts.get(hour) ?? 0,
  }));
}

/**
 * "Qualité" d'écoute de l'album : durée moyenne + taux de skip (< 30s).
 * NULL si aucun stream n'a de ms_played enregistré.
 */
export async function getAlbumPlayQuality(
  userId: string,
  albumId: string,
  since: Date | null = null,
): Promise<{ avgMs: number | null; skipRate: number | null }> {
  const whereClause = since
    ? and(
        eq(streams.userId, userId),
        eq(tracks.albumId, albumId),
        gte(streams.playedAt, since),
      )
    : and(eq(streams.userId, userId), eq(tracks.albumId, albumId));

  const [row] = await db
    .select({
      avgMs: sql<string | null>`avg(${streams.msPlayed}) filter (where ${streams.msPlayed} is not null)`,
      skipRate: sql<string | null>`
        (sum(case when ${streams.msPlayed} < 30000 then 1 else 0 end)::float
         / nullif(count(*) filter (where ${streams.msPlayed} is not null), 0))
      `,
    })
    .from(streams)
    .innerJoin(tracks, eq(tracks.id, streams.trackId))
    .where(whereClause);

  return {
    avgMs: row?.avgMs != null ? Number(row.avgMs) : null,
    skipRate: row?.skipRate != null ? Number(row.skipRate) : null,
  };
}

/**
 * Autres albums d'un artiste donné qu'a écouté l'utilisateur, triés par plays
 * desc. Exclut l'album fourni en paramètre. Utilisé par le carousel "Autres
 * albums de [artiste]" sur la page detail album.
 */
export async function getOtherAlbumsByArtist(
  userId: string,
  artistId: string,
  excludeAlbumId: string,
  limit = 10,
): Promise<
  { albumId: string; name: string; imageUrl: string | null; plays: number }[]
> {
  const rows = await db
    .select({
      albumId: albums.id,
      name: albums.name,
      imageUrl: albums.imageUrl,
      plays: sql<number>`count(${streams.id})::int`,
    })
    .from(streams)
    .innerJoin(tracks, eq(tracks.id, streams.trackId))
    .innerJoin(albums, eq(albums.id, tracks.albumId))
    .innerJoin(trackArtists, eq(trackArtists.trackId, tracks.id))
    .where(
      and(
        eq(streams.userId, userId),
        eq(trackArtists.artistId, artistId),
        ne(albums.id, excludeAlbumId),
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
    plays: Number(r.plays),
  }));
}

/**
 * Top albums of `artistId` ordered by the user's play count. Mirrors
 * `getUserTopTracksByArtist` at album granularity.
 */
export async function getUserTopAlbumsByArtist(
  userId: string,
  artistId: string,
  limit: number,
  since: Date | null = null,
): Promise<{
  albumId: string;
  name: string;
  imageUrl: string | null;
  playCount: number;
}[]> {
  const whereClause = since
    ? and(
        eq(streams.userId, userId),
        eq(albumArtists.artistId, artistId),
        gte(streams.playedAt, since),
        QUALIFYING_PLAY,
      )
    : and(
        eq(streams.userId, userId),
        eq(albumArtists.artistId, artistId),
        QUALIFYING_PLAY,
      );

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
    .where(whereClause)
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

/**
 * Top N artists that the user listens to within ±30 min of plays from
 * `artistId`. Self-join on streams.played_at within a 30-min window where
 * one side is the focal artist and the other side is any other artist.
 */
export async function getCoListenedArtists(
  userId: string,
  artistId: string,
  limit: number,
  since: Date | null = null,
): Promise<{
  artistId: string;
  name: string;
  imageUrl: string | null;
  coCount: number;
}[]> {
  const sinceFilter = since ? sql`AND s.played_at >= ${since}` : sql``;
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
        ${sinceFilter}
    )
    SELECT
      a.id AS artist_id,
      a.name,
      -- Fall back to one of the artist's album covers when TheAudioDB hasn't
      -- enriched artists.image_url yet (which is most artists right now).
      COALESCE(
        a.image_url,
        (SELECT alb.image_url
         FROM albums alb
         JOIN album_artists aa ON aa.album_id = alb.id
         WHERE aa.artist_id = a.id AND alb.image_url IS NOT NULL
         LIMIT 1)
      ) AS image_url,
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
