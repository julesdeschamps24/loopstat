import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { artists } from "@/db/schema";
import { enrichArtistImageByDeezer } from "@/lib/deezer/catalog";

/** Pre-check then enrich via Deezer; skip if already attempted (deezer_id set) or image present. */
export async function enrichArtistImage(row: {
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
