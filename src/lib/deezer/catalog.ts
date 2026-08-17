import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { albums, artists } from "@/db/schema";
import { searchAlbumByName, searchArtistByName } from "./search";
import { fetchAlbumDetails } from "./album";

const SENTINEL_DEEZER_ID = 0;

/**
 * Enrich artist image via Deezer. Single enrichment source - Deezer's
 * catalog covers ~99% of mainstream + non-English artists.
 *
 * Stores Deezer's artist ID for tracking. On miss, stores the sentinel (0)
 * so the same item isn't retried indefinitely. On match with no thumbnail,
 * stores the ID but leaves image_url null.
 */
export async function enrichArtistImageByDeezer({
  artistId,
  name,
}: {
  artistId: string;
  name: string;
}): Promise<void> {
  const match = await searchArtistByName({ name });
  if (!match) {
    await db
      .update(artists)
      .set({ deezerId: SENTINEL_DEEZER_ID })
      .where(eq(artists.id, artistId));
    return;
  }
  await db
    .update(artists)
    .set({ deezerId: match.deezerId, imageUrl: match.pictureUrl })
    .where(eq(artists.id, artistId));
}

/** Enrich an album via Deezer: sentinel on miss, image + release_date on hit. */
export async function enrichAlbumImageByDeezer({
  albumId,
  artistName,
  albumName,
}: {
  albumId: string;
  artistName: string;
  albumName: string;
}): Promise<void> {
  const match = await searchAlbumByName({ artistName, albumName });
  if (!match) {
    await db
      .update(albums)
      .set({ deezerId: SENTINEL_DEEZER_ID })
      .where(eq(albums.id, albumId));
    return;
  }

  let releaseDate: string | null = null;
  try {
    const details = await fetchAlbumDetails({ deezerAlbumId: match.deezerAlbumId });
    releaseDate = details?.releaseDate ?? null;
  } catch {
    // best-effort
  }

  await db
    .update(albums)
    .set({
      deezerId: match.deezerAlbumId,
      imageUrl: match.coverUrl,
      releaseDate,
    })
    .where(eq(albums.id, albumId));
}
