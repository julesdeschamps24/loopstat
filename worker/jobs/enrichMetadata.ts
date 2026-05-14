import { isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { tracks } from "@/db/schema";
import { spotifyFetch } from "@/lib/spotify/client";
import { upsertCatalogFromTracks } from "@/lib/spotify/catalog";
import type { SpotifyTrack } from "@/lib/spotify/types";

// The batched GET /tracks?ids= endpoint returns 403 for this app's Spotify
// credentials, so we fetch one at a time via GET /tracks/{id}. Delay between
// calls to stay polite with rate limits.
const RATE_DELAY_MS = 150;

export interface EnrichMetadataResult {
  enrichedCount: number;
}

// spotifyFetch throws Error("Spotify /tracks/xxx failed: <status> ...").
// A 404 means the track is gone from Spotify's catalog; a 400 "Invalid base62
// id" means the stored id is malformed. Both are permanent, per-track data
// problems — skip just that one track rather than failing (and retrying) the
// whole job. Any other status (403, 5xx, network) is treated as transient and
// allowed to propagate so BullMQ retries.
function isSkippableTrackError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (/ failed: 404\b/.test(err.message) ||
      / failed: 400\b/.test(err.message))
  );
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
  const collected: SpotifyTrack[] = [];
  let skipped = 0;

  for (let i = 0; i < ids.length; i++) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, RATE_DELAY_MS));
    }

    const id = ids[i];
    try {
      // Let non-404 errors (403, 5xx, network) propagate: BullMQ retries the
      // whole job, which is safe since already-enriched tracks won't re-select.
      const track = await spotifyFetch<SpotifyTrack>(userId, `/tracks/${id}`);
      collected.push(track);
    } catch (err) {
      if (isSkippableTrackError(err)) {
        console.warn(
          `[enrichMetadata] user=${userId} track=${id} — skipping: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        skipped += 1;
        continue;
      }
      throw err;
    }
  }

  await upsertCatalogFromTracks(collected);

  console.log(
    `[enrichMetadata] user=${userId} unenriched=${ids.length} enriched=${collected.length} skipped=${skipped}`,
  );

  return { enrichedCount: collected.length };
}
