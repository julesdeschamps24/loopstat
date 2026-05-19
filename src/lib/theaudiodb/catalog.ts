import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { artists } from "@/db/schema";
import { lookupArtistByMbid, searchArtistByName } from "./search";

/**
 * Sentinel tadb_id stored when TheAudioDB returned no match. Distinguishes
 * "not yet attempted" (tadb_id IS NULL) from "tried and failed" (tadb_id = 0),
 * avoiding infinite re-attempts on the next worker sweep.
 */
const SENTINEL_TADB_ID = 0;

/**
 * Enrich an artist row's image via TheAudioDB, using its MusicBrainz MBID for
 * precise lookup. Updates artists.tadb_id + artists.image_url, or stores the
 * sentinel when no match is found.
 */
export async function enrichArtistImageByMbid({
  artistId,
  mbid,
}: {
  artistId: string;
  mbid: string;
}): Promise<void> {
  const match = await lookupArtistByMbid({ mbid });

  if (!match) {
    await db.update(artists).set({ tadbId: SENTINEL_TADB_ID }).where(eq(artists.id, artistId));
    return;
  }

  await db
    .update(artists)
    .set({ tadbId: match.tadbId, imageUrl: match.thumbUrl })
    .where(eq(artists.id, artistId));
}

/**
 * Enrich an artist row's image via TheAudioDB by name search. Fallback when
 * the artist has no MBz mbid. TheAudioDB ranks results by popularity ; we
 * take the first match.
 */
export async function enrichArtistImageByName({
  artistId,
  name,
}: {
  artistId: string;
  name: string;
}): Promise<void> {
  const match = await searchArtistByName({ name });

  if (!match) {
    await db.update(artists).set({ tadbId: SENTINEL_TADB_ID }).where(eq(artists.id, artistId));
    return;
  }

  await db
    .update(artists)
    .set({ tadbId: match.tadbId, imageUrl: match.thumbUrl })
    .where(eq(artists.id, artistId));
}
