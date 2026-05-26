import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { artists } from "@/db/schema";
import { enrichArtistImageByDeezer } from "@/lib/deezer/catalog";

/**
 * Enrich an artist's image via Deezer. Single source — Deezer's catalog
 * covers ~99% of mainstream + non-English artists, so the dual-source
 * (TADB → Deezer fallback) of earlier iterations was dead complexity.
 *
 * Skips the API call entirely if image_url is already set or Deezer was
 * already attempted (deezer_id NOT NULL).
 */
export async function enrichArtistImageWithFallback(row: {
  artistId: string;
  name: string;
}): Promise<void> {
  const [pre] = await db
    .select({ imageUrl: artists.imageUrl, deezerId: artists.deezerId })
    .from(artists)
    .where(eq(artists.id, row.artistId))
    .limit(1);
  if (!pre || pre.imageUrl !== null || pre.deezerId !== null) return;
  await enrichArtistImageByDeezer({ artistId: row.artistId, name: row.name });
}
