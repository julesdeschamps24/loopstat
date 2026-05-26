import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { artists } from "@/db/schema";
import { searchArtistByName } from "./search";

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
