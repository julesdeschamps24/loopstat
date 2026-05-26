import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { albums, artists } from "@/db/schema";
import { searchAlbumByName, searchArtistByName } from "./search";

const SENTINEL_DEEZER_ID = 0;

/**
 * Enrich artist image via Deezer. Single enrichment source — Deezer's
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

/**
 * Best-effort album cover enrich via Deezer. Used by the ultra-priority tier
 * to bypass the slow MBz → CAA chain. Sets `albums.image_url` directly.
 * No sentinel column (the MBz background sweep will set mbid later anyway,
 * and our retry filter is based on image_url IS NULL).
 */
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
  if (!match || !match.coverUrl) return;
  await db
    .update(albums)
    .set({ imageUrl: match.coverUrl })
    .where(eq(albums.id, albumId));
}
