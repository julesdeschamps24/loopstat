import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db/client";
import {
  albumArtists,
  albums,
  artists,
  trackArtists,
  tracks,
} from "@/db/schema";
import {
  DEMO_TOP_ALBUMS,
  DEMO_TOP_ARTISTS,
  DEMO_TOP_TRACKS,
} from "./data";

/**
 * Look up real cover URLs in the catalog for each demo fixture, matching
 * by lowercased name + first artist name. Returns Maps keyed by the
 * fixture's `trackId` / `artistId` / `albumId`.
 *
 * Memoized per request via `cache()` so the 3 queries run at most once
 * per page even when multiple components ask for the same data.
 *
 * Fallbacks (in order):
 *   - Real catalog cover when matched.
 *   - For artists without an artists.image_url (TADB pending), uses one of
 *     their album covers as a stand-in.
 *   - Otherwise the imageUrl stays null and the consumer renders its
 *     usual placeholder.
 */
export const enrichDemoFixtures = cache(async (): Promise<{
  trackImages: Map<string, string>;
  artistImages: Map<string, string>;
  albumImages: Map<string, string>;
}> => {
  const trackNamesLower = DEMO_TOP_TRACKS.map((t) => t.name.toLowerCase());
  const trackArtistsLower = DEMO_TOP_TRACKS.flatMap((t) =>
    t.artistNames.map((n) => n.toLowerCase()),
  );
  const albumNamesLower = DEMO_TOP_ALBUMS.map((a) => a.name.toLowerCase());
  const albumArtistsLower = DEMO_TOP_ALBUMS.flatMap((a) =>
    a.artistNames.map((n) => n.toLowerCase()),
  );
  const artistNamesLower = DEMO_TOP_ARTISTS.map((a) => a.name.toLowerCase());

  // 1. Tracks → fetch (track name, artist name) → album image_url.
  const trackRows = trackNamesLower.length === 0
    ? []
    : await db
        .select({
          trackName: sql<string>`LOWER(${tracks.name})`,
          artistName: sql<string>`LOWER(${artists.name})`,
          imageUrl: albums.imageUrl,
        })
        .from(tracks)
        .innerJoin(trackArtists, eq(trackArtists.trackId, tracks.id))
        .innerJoin(artists, eq(artists.id, trackArtists.artistId))
        .innerJoin(albums, eq(albums.id, tracks.albumId))
        .where(
          and(
            isNotNull(albums.imageUrl),
            inArray(sql`LOWER(${tracks.name})`, trackNamesLower),
            inArray(sql`LOWER(${artists.name})`, trackArtistsLower),
          ),
        );

  const trackLookup = new Map<string, string>();
  for (const row of trackRows) {
    trackLookup.set(`${row.trackName}|${row.artistName}`, row.imageUrl!);
  }

  const trackImages = new Map<string, string>();
  for (const fixture of DEMO_TOP_TRACKS) {
    const artistName = fixture.artistNames[0]?.toLowerCase();
    if (!artistName) continue;
    const key = `${fixture.name.toLowerCase()}|${artistName}`;
    const url = trackLookup.get(key);
    if (url) trackImages.set(fixture.trackId, url);
  }

  // 2. Albums → fetch (album name, artist name) → image_url.
  const albumRows = albumNamesLower.length === 0
    ? []
    : await db
        .select({
          albumName: sql<string>`LOWER(${albums.name})`,
          artistName: sql<string>`LOWER(${artists.name})`,
          imageUrl: albums.imageUrl,
        })
        .from(albums)
        .innerJoin(albumArtists, eq(albumArtists.albumId, albums.id))
        .innerJoin(artists, eq(artists.id, albumArtists.artistId))
        .where(
          and(
            isNotNull(albums.imageUrl),
            inArray(sql`LOWER(${albums.name})`, albumNamesLower),
            inArray(sql`LOWER(${artists.name})`, albumArtistsLower),
          ),
        );

  const albumLookup = new Map<string, string>();
  for (const row of albumRows) {
    albumLookup.set(`${row.albumName}|${row.artistName}`, row.imageUrl!);
  }

  const albumImages = new Map<string, string>();
  for (const fixture of DEMO_TOP_ALBUMS) {
    const artistName = fixture.artistNames[0]?.toLowerCase();
    if (!artistName) continue;
    const key = `${fixture.name.toLowerCase()}|${artistName}`;
    const url = albumLookup.get(key);
    if (url) albumImages.set(fixture.albumId, url);
  }

  // 3. Artists → fetch artists.image_url, else first album cover as fallback.
  const artistRows = artistNamesLower.length === 0
    ? []
    : await db
        .select({
          name: sql<string>`LOWER(${artists.name})`,
          artistImage: artists.imageUrl,
        })
        .from(artists)
        .where(inArray(sql`LOWER(${artists.name})`, artistNamesLower));

  const artistImageLookup = new Map<string, string | null>();
  for (const row of artistRows) {
    if (!artistImageLookup.has(row.name) || row.artistImage) {
      artistImageLookup.set(row.name, row.artistImage);
    }
  }

  const artistImages = new Map<string, string>();
  for (const fixture of DEMO_TOP_ARTISTS) {
    const nameLower = fixture.name.toLowerCase();
    const direct = artistImageLookup.get(nameLower);
    if (direct) {
      artistImages.set(fixture.artistId, direct);
      continue;
    }
    // Fallback : trouve un album du même artiste enrichi, prends sa cover.
    const fallback = albumRows.find((r) => r.artistName === nameLower);
    if (fallback?.imageUrl) {
      artistImages.set(fixture.artistId, fallback.imageUrl);
    }
  }

  return { trackImages, artistImages, albumImages };
});

/**
 * Enriched versions of the DEMO_TOP_* fixtures with real cover URLs from the
 * catalog. Use these in place of the raw fixtures in any demo-mode page that
 * displays imagery (lists, top pages, dashboard summaries).
 */
export async function getEnrichedDemoTopTracks(): Promise<typeof DEMO_TOP_TRACKS> {
  const { trackImages } = await enrichDemoFixtures();
  return DEMO_TOP_TRACKS.map((t) => ({
    ...t,
    albumImageUrl: trackImages.get(t.trackId) ?? null,
  }));
}

export async function getEnrichedDemoTopArtists(): Promise<typeof DEMO_TOP_ARTISTS> {
  const { artistImages } = await enrichDemoFixtures();
  return DEMO_TOP_ARTISTS.map((a) => ({
    ...a,
    imageUrl: artistImages.get(a.artistId) ?? null,
  }));
}

export async function getEnrichedDemoTopAlbums(): Promise<typeof DEMO_TOP_ALBUMS> {
  const { albumImages } = await enrichDemoFixtures();
  return DEMO_TOP_ALBUMS.map((a) => ({
    ...a,
    imageUrl: albumImages.get(a.albumId) ?? null,
  }));
}
