import { isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { spotifyTokens, tracks } from "@/db/schema";
import { log } from "@/lib/log";
import { SpotifyError, spotifyFetch } from "@/lib/spotify/client";
import { upsertCatalogFromTracks } from "@/lib/spotify/catalog";
import type { SpotifyTrack } from "@/lib/spotify/types";
import { enrichQueue } from "../queue";

export interface SelfHealResult {
  unenrichedCount: number;
  enqueued: boolean;
}

/**
 * Idempotent health check : if any track has no metadata yet AND no enrich
 * job is currently active or queued, picks any user with valid Spotify creds
 * and re-enqueues an enrich job. Used by the hourly self-heal scheduler so
 * that a previously-failed enrich (Spotify ban > BullMQ attempts, worker
 * crash, etc.) doesn't leave the catalog permanently incomplete.
 *
 * Removes any stale failed enrich job before enqueueing — otherwise the
 * jobId dedup would block the new attempt for the next 24 h (removeOnFail).
 */
export async function selfHealEnrich(): Promise<SelfHealResult> {
  const slog = log.child({ job: "enrich-self-heal" });

  const [unenriched] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(tracks)
    .where(isNull(tracks.durationMs));
  const unenrichedCount = Number(unenriched?.n ?? 0);

  if (unenrichedCount === 0) {
    slog.info({ unenrichedCount }, "catalog fully enriched, no action");
    return { unenrichedCount, enqueued: false };
  }

  const [creds] = await db
    .select({ userId: spotifyTokens.userId })
    .from(spotifyTokens)
    .limit(1);
  if (!creds) {
    slog.warn(
      { unenrichedCount },
      "tracks need enrichment but no user has Spotify creds — skipping",
    );
    return { unenrichedCount, enqueued: false };
  }

  // Clear any stale terminal-failed job blocking our jobId, so the new add()
  // actually queues a fresh attempt.
  const existing = await enrichQueue.getJob("enrich-metadata-global");
  if (existing) {
    const state = await existing.getState();
    if (state === "failed") {
      slog.info({ jobId: existing.id, state }, "removing stale failed job");
      await existing.remove();
    } else {
      slog.info(
        { jobId: existing.id, state, unenrichedCount },
        "enrich already pending — no re-enqueue",
      );
      return { unenrichedCount, enqueued: false };
    }
  }

  await enrichQueue.add(
    "enrich-metadata",
    { userId: creds.userId },
    { jobId: "enrich-metadata-global" },
  );
  slog.info(
    { unenrichedCount, userId: creds.userId },
    "self-heal enqueued enrich-metadata",
  );
  return { unenrichedCount, enqueued: true };
}

// The batched GET /tracks?ids= endpoint returns 403 for this app's Spotify
// credentials, so we fetch one at a time via GET /tracks/{id}.
//
// Pourquoi 30 000 ms (0.033 req/s) : observé empiriquement, l'app en dev tier
// se faisait toujours bannir 1 h à 2 s/track quand un catalog massif (~10k
// tracks) était enrichi à froid. À 30 s on est sûr de ne jamais déclencher le
// throttle, MÊME en bg continu. Tradeoff : 10k tracks × 30 s ≈ 87 h ≈ 3.6 j,
// mais ça tourne en arrière-plan sans urgence — les pages /album/[id] que
// l'utilisateur visite sont enrichies à la volée à 0 appel Spotify
// supplémentaire (cf. lazy enrich dans src/app/album/[id]/page.tsx).
// Demander l'Extended Quota Mode à Spotify pour baisser ce délai.
const RATE_DELAY_MS = 30_000;

// Persiste progressivement plutôt que de tout upsert à la fin : un crash
// (429, réseau) au milieu d'une boucle de 27 minutes ne perd pas tout le
// travail déjà fait.
const CHUNK_SIZE = 50;

// Nombre max de re-fetch d'une même track après 429 *dans* la boucle (en plus
// du retry interne déjà fait par spotifyFetch). Au-delà, on laisse remonter
// l'erreur et BullMQ retry le job entier avec son backoff exponentiel (5/10/20s).
// La progression précédente reste durable grâce au flush par chunk.
const MAX_429_RETRIES = 3;

// Buffer ajouté au Retry-After de Spotify pour éviter de retomber pile sur
// la limite suivante.
const RETRY_BUFFER_MS = 1000;

export interface EnrichMetadataResult {
  enrichedCount: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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
  wlog.info({ total: ids.length }, "enrich batch starting");

  let totalEnriched = 0;
  let totalSkipped = 0;
  let chunk: SpotifyTrack[] = [];

  async function flushChunk(): Promise<void> {
    if (chunk.length === 0) return;
    await upsertCatalogFromTracks(chunk);
    totalEnriched += chunk.length;
    wlog.info(
      { persisted: chunk.length, totalEnriched, total: ids.length },
      "chunk persisted",
    );
    chunk = [];
  }

  try {
    for (let i = 0; i < ids.length; i++) {
      if (i > 0) {
        await sleep(RATE_DELAY_MS);
      }

      const id = ids[i];
      let attempt = 0;
      let fetched: SpotifyTrack | null = null;

      // Inner retry loop: handle 429 inline by waiting Retry-After, instead
      // of throwing and losing the in-memory chunk. After MAX_429_RETRIES on
      // the *same* track, give up and let BullMQ retry the whole job — but
      // the already-flushed chunks are durable so we resume cleanly.
      while (fetched === null) {
        try {
          fetched = await spotifyFetch<SpotifyTrack>(userId, `/tracks/${id}`);
        } catch (err) {
          if (
            err instanceof SpotifyError &&
            err.status === 429 &&
            attempt < MAX_429_RETRIES
          ) {
            const wait = (err.retryAfterMs ?? 10_000) + RETRY_BUFFER_MS;
            attempt += 1;
            wlog.warn(
              { track: id, attempt, waitMs: wait },
              "429 in enrich loop, backing off",
            );
            await sleep(wait);
            continue;
          }
          if (isSkippableTrackError(err)) {
            wlog.warn({ track: id, err }, "skipping unenriched track");
            totalSkipped += 1;
            break; // exit while with fetched still null — no push
          }
          throw err;
        }
      }

      if (fetched !== null) {
        chunk.push(fetched);
        if (chunk.length >= CHUNK_SIZE) {
          await flushChunk();
        }
      }
    }
  } catch (err) {
    // Persist whatever we've buffered before letting BullMQ retry. Without
    // this, a crash mid-loop would lose up to CHUNK_SIZE - 1 successfully-
    // fetched tracks per attempt → infinite churn.
    if (chunk.length > 0) {
      try {
        await flushChunk();
      } catch (flushErr) {
        wlog.error({ flushErr }, "failed to flush partial chunk before rethrow");
      }
    }
    throw err;
  }

  await flushChunk();

  wlog.info(
    { unenriched: ids.length, enriched: totalEnriched, skipped: totalSkipped },
    "enrich complete",
  );

  return { enrichedCount: totalEnriched };
}
