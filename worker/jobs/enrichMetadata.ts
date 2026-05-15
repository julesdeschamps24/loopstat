import { isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { tracks } from "@/db/schema";
import { log } from "@/lib/log";
import { SpotifyError, spotifyFetch } from "@/lib/spotify/client";
import { upsertCatalogFromTracks } from "@/lib/spotify/catalog";
import type { SpotifyTrack } from "@/lib/spotify/types";

// The batched GET /tracks?ids= endpoint returns 403 for this app's Spotify
// credentials, so we fetch one at a time via GET /tracks/{id}. Fixed delay
// between calls to space out requests. NOTE: there is no HTTP 429/Retry-After
// handling — if Spotify rate-limits us, spotifyFetch throws and we rely on
// BullMQ to retry the whole job (cheap, since enriched tracks self-exclude).
const RATE_DELAY_MS = 150;

export interface EnrichMetadataResult {
  enrichedCount: number;
}

// spotifyFetch throws SpotifyError carrying .status from Spotify's response.
// A 404 means the track is gone from Spotify's catalog; a 400 "Invalid base62
// id" means the stored id is malformed. Both are permanent, per-track data
// problems — skip just that one track rather than failing (and retrying) the
// whole job. Any other status (403, 5xx, network) is treated as transient and
// allowed to propagate so BullMQ retries.
function isSkippableTrackError(err: unknown): boolean {
  return (
    err instanceof SpotifyError && (err.status === 400 || err.status === 404)
  );
}

// Sweeps tracks inserted "minimal" by importHistory ({id,name}, duration_ms NULL)
// and backfills full metadata from the Spotify catalog. Idempotent: once a track
// is enriched it has duration_ms set, so a re-run won't re-select it.
// NOTE: `tracks` is a global shared catalog (no userId column), so this is a
// GLOBAL sweep — it enriches every unenriched track, not just one user's.
// `userId` here is only the Spotify credential used for the API calls (and the
// log prefix). Concurrent enrich enqueues are deduplicated at the enqueue
// boundary via jobId: "enrich-metadata-global", so only one job runs at a time.
export async function enrichMetadata(
  userId: string,
): Promise<EnrichMetadataResult> {
  const wlog = log.child({ job: "enrich-metadata", userId });

  const unenriched = await db
    .select({ id: tracks.id })
    .from(tracks)
    .where(isNull(tracks.durationMs));

  if (unenriched.length === 0) {
    wlog.info({ unenriched: 0 }, "nothing to do");
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
        wlog.warn(
          { track: id, err },
          "skipping unenriched track",
        );
        skipped += 1;
        continue;
      }
      throw err;
    }
  }

  await upsertCatalogFromTracks(collected);

  wlog.info(
    { unenriched: ids.length, enriched: collected.length, skipped },
    "enrich batch complete",
  );

  return { enrichedCount: collected.length };
}
