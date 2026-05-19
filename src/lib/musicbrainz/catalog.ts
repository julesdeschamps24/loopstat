import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { albums, artists } from "@/db/schema";
import { fetchCoverUrl } from "./coverArt";
import { searchArtist, searchReleaseGroup } from "./search";

/**
 * Sentinel mbid stored when MBz returned no match. Distinguishes "not yet
 * attempted" (mbid IS NULL) from "tried and failed" (mbid = sentinel),
 * avoiding infinite re-attempts.
 */
const SENTINEL_MBID = "00000000-0000-0000-0000-000000000000";

/**
 * Enrich an album row by name lookup against MusicBrainz + Cover Art Archive.
 * Updates `albums` with mbid + cover URL + release metadata, or marks the row
 * with a sentinel mbid when no match is found.
 */
export async function enrichAlbumByNames({
  albumId,
  artistName,
  albumName,
}: {
  albumId: string;
  artistName: string;
  albumName: string;
}): Promise<void> {
  const match = await searchReleaseGroup({ artist: artistName, album: albumName });

  if (!match) {
    await db.update(albums).set({ mbid: SENTINEL_MBID }).where(eq(albums.id, albumId));
    return;
  }

  const coverUrl = await fetchCoverUrl(match.mbid);

  await db
    .update(albums)
    .set({
      mbid: match.mbid,
      imageUrl: coverUrl,
      releaseDate: match.firstReleaseDate ?? null,
      albumType: match.primaryType ?? null,
      totalTracks: match.totalTracks ?? null,
    })
    .where(eq(albums.id, albumId));
}

/**
 * Enrich an artist row by name lookup against MusicBrainz.
 * Updates `artists.mbid`, or marks with sentinel mbid on no match.
 * Does NOT fetch artist images — MBz doesn't host them; deferred to TheAudioDB.
 */
export async function enrichArtistByName({
  artistId,
  name,
}: {
  artistId: string;
  name: string;
}): Promise<void> {
  const match = await searchArtist(name);

  if (!match) {
    await db.update(artists).set({ mbid: SENTINEL_MBID }).where(eq(artists.id, artistId));
    return;
  }

  await db.update(artists).set({ mbid: match.mbid }).where(eq(artists.id, artistId));
}
