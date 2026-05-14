import { isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { tracks } from "@/db/schema";
import { spotifyFetch } from "@/lib/spotify/client";
import { upsertCatalogFromTracks } from "@/lib/spotify/catalog";
import type { SpotifyTrack } from "@/lib/spotify/types";

const BATCH_SIZE = 50;

export interface EnrichMetadataResult {
  enrichedCount: number;
}

// GET /tracks?ids=... returns nulls for ids invalid/unavailable in the market.
interface SpotifyTracksResponse {
  tracks: (SpotifyTrack | null)[];
}

// Sweeps tracks inserted "minimal" by importHistory ({id,name}, duration_ms NULL)
// and backfills full metadata from the Spotify catalog. Idempotent: once a track
// is enriched it has duration_ms set, so a re-run won't re-select it.
export async function enrichMetadata(
  userId: string,
): Promise<EnrichMetadataResult> {
  const unenriched = await db
    .select({ id: tracks.id })
    .from(tracks)
    .where(isNull(tracks.durationMs));

  if (unenriched.length === 0) {
    console.log(
      `[enrichMetadata] user=${userId} unenriched=0 — nothing to do`,
    );
    return { enrichedCount: 0 };
  }

  const ids = unenriched.map((t) => t.id);
  let enrichedCount = 0;
  let nullCount = 0;

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    // Let spotifyFetch errors propagate: BullMQ retries the whole job, which is
    // safe since already-enriched tracks won't be re-selected.
    const res = await spotifyFetch<SpotifyTracksResponse>(
      userId,
      `/tracks?ids=${batch.join(",")}`,
    );

    const found = res.tracks.filter(
      (t): t is SpotifyTrack => t !== null,
    );
    nullCount += res.tracks.length - found.length;

    await upsertCatalogFromTracks(found);
    enrichedCount += found.length;
  }

  console.log(
    `[enrichMetadata] user=${userId} unenriched=${ids.length} enriched=${enrichedCount} null=${nullCount}`,
  );

  return { enrichedCount };
}
