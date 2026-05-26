import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { artists } from "@/db/schema";
import {
  enrichArtistImageByMbid,
  enrichArtistImageByName,
} from "@/lib/theaudiodb/catalog";
import { enrichArtistImageByDeezer } from "@/lib/deezer/catalog";

const SENTINEL_MBID = "00000000-0000-0000-0000-000000000000";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Enrich a single artist's image with a TADB → Deezer fallback chain.
 *
 * 1. Try TheAudioDB (by MBID if available, else by name).
 * 2. After TADB, if image_url is still null and deezer_id is not yet set
 *    → try Deezer as fallback (better coverage of French rap / non-EN artists).
 *
 * Deezer is only called when TADB missed — it's free and has no aggressive
 * rate limit (~50 req/s), but we add a 300ms courtesy sleep after the extra
 * call to stay polite.
 */
export async function enrichArtistImageWithFallback(row: {
  artistId: string;
  name: string;
  mbid: string | null;
}): Promise<void> {
  // Look at current state. If TADB was already tried (tadb_id set), skip
  // straight to Deezer — re-querying TADB would waste a rate-limited call
  // and return the same miss.
  const [pre] = await db
    .select({
      tadbId: artists.tadbId,
      imageUrl: artists.imageUrl,
      deezerId: artists.deezerId,
    })
    .from(artists)
    .where(eq(artists.id, row.artistId))
    .limit(1);
  if (!pre || pre.imageUrl !== null) return;

  const tadbAlreadyTried = pre.tadbId !== null;
  if (!tadbAlreadyTried) {
    const hasRealMbid = row.mbid !== null && row.mbid !== SENTINEL_MBID;
    if (hasRealMbid) {
      await enrichArtistImageByMbid({ artistId: row.artistId, mbid: row.mbid! });
    } else {
      await enrichArtistImageByName({ artistId: row.artistId, name: row.name });
    }

    // Re-check after TADB. If it returned a URL, we're done.
    const [post] = await db
      .select({ imageUrl: artists.imageUrl })
      .from(artists)
      .where(eq(artists.id, row.artistId))
      .limit(1);
    if (post && post.imageUrl !== null) return;
  }

  // Either TADB was already tried, OR we just tried and missed. Either way,
  // attempt Deezer if not already done.
  if (pre.deezerId === null) {
    await enrichArtistImageByDeezer({ artistId: row.artistId, name: row.name });
    // Extra API call made — courtesy sleep.
    await sleep(300);
  }
}
