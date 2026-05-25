import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { albums, albumArtists, artists } from "@/db/schema";
import { log } from "@/lib/log";
import { MusicBrainzError } from "@/lib/musicbrainz/client";
import {
  enrichAlbumByNames,
  enrichArtistByName,
} from "@/lib/musicbrainz/catalog";
import {
  enrichArtistImageByMbid,
  enrichArtistImageByName,
} from "@/lib/theaudiodb/catalog";
import { enrichCatalogQueue } from "../queue";

const SENTINEL_MBID = "00000000-0000-0000-0000-000000000000";

const RATE_DELAY_MS = 1100;
const CHUNK_SIZE = 25;

// In-line retry on MBz 503 ("server busy") so a transient blip doesn't
// fail the whole sweep — losing all in-progress chunks. After this many
// attempts on the same item, give up and let BullMQ retry the job (the
// already-persisted chunks survive).
const MAX_503_RETRIES = 5;
const RETRY_503_BUFFER_MS = 1000;

/**
 * Run `fn` and retry up to MAX_503_RETRIES times on MBz 503 errors,
 * respecting the Retry-After hint when present. Other errors propagate.
 */
async function withMbzRetry<T>(fn: () => Promise<T>, wlog: ReturnType<typeof log.child>): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (
        err instanceof MusicBrainzError &&
        err.status === 503 &&
        attempt < MAX_503_RETRIES
      ) {
        const wait = (err.retryAfterMs ?? 30_000) + RETRY_503_BUFFER_MS;
        attempt += 1;
        wlog.warn({ attempt, waitMs: wait }, "MBz 503, backing off");
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
}

export interface EnrichCatalogResult {
  albumsEnriched: number;
  artistsEnriched: number;
  imagesEnriched: number;
}

export interface SelfHealResult {
  unenrichedAlbums: number;
  unenrichedArtists: number;
  unenrichedImages: number;
  enqueued: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Hourly self-heal : if any album or artist row still has mbid IS NULL,
 * re-enqueue an enrich job. Dedup via fixed jobId.
 */
export async function selfHealEnrichCatalog(): Promise<SelfHealResult> {
  const slog = log.child({ job: "enrich-catalog-self-heal" });

  const [albCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(albums)
    .where(isNull(albums.mbid));
  const [artCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(artists)
    .where(isNull(artists.mbid));
  const [imgCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(artists)
    .where(and(isNull(artists.imageUrl), isNull(artists.tadbId)));

  const unenrichedAlbums = Number(albCount?.n ?? 0);
  const unenrichedArtists = Number(artCount?.n ?? 0);
  const unenrichedImages = Number(imgCount?.n ?? 0);

  if (unenrichedAlbums === 0 && unenrichedArtists === 0 && unenrichedImages === 0) {
    slog.info({}, "catalog fully enriched, no action");
    return { unenrichedAlbums, unenrichedArtists, unenrichedImages, enqueued: false };
  }

  const existing = await enrichCatalogQueue.getJob("enrich-catalog-global");
  if (existing) {
    const state = await existing.getState();
    if (state === "failed") {
      slog.info({ state }, "removing stale failed job");
      await existing.remove();
    } else {
      slog.info({ state }, "enrich already pending — no re-enqueue");
      return { unenrichedAlbums, unenrichedArtists, unenrichedImages, enqueued: false };
    }
  }

  await enrichCatalogQueue.add(
    "enrich-catalog",
    {},
    { jobId: "enrich-catalog-global" },
  );
  slog.info(
    { unenrichedAlbums, unenrichedArtists, unenrichedImages },
    "self-heal enqueued enrich-catalog",
  );
  return { unenrichedAlbums, unenrichedArtists, unenrichedImages, enqueued: true };
}

/**
 * Main enrich job. Sweeps unenriched albums then artists, calls MBz once per
 * entity (1 req/sec), persists progressively. On any error, BullMQ retries
 * the job — but already-persisted rows survive.
 */
export async function enrichCatalog(): Promise<EnrichCatalogResult> {
  const wlog = log.child({ job: "enrich-catalog" });

  // Albums : need the album row + its primary artist's name for MBz query.
  const unenrichedAlbums = await db
    .select({
      albumId: albums.id,
      albumName: albums.name,
      artistName: artists.name,
    })
    .from(albums)
    .innerJoin(albumArtists, eq(albumArtists.albumId, albums.id))
    .innerJoin(artists, eq(artists.id, albumArtists.artistId))
    .where(isNull(albums.mbid));

  wlog.info({ albums: unenrichedAlbums.length }, "album sweep starting");

  let albumsEnriched = 0;
  for (let i = 0; i < unenrichedAlbums.length; i++) {
    if (i > 0) await sleep(RATE_DELAY_MS);
    const row = unenrichedAlbums[i];
    try {
      await withMbzRetry(
        () =>
          enrichAlbumByNames({
            albumId: row.albumId,
            artistName: row.artistName,
            albumName: row.albumName,
          }),
        wlog,
      );
      albumsEnriched++;
      if (albumsEnriched % CHUNK_SIZE === 0) {
        wlog.info(
          { albumsEnriched, total: unenrichedAlbums.length },
          "chunk persisted",
        );
      }
    } catch (err) {
      wlog.error(
        { err, msg: (err as Error)?.message, albumId: row.albumId },
        "enrich album failed",
      );
      throw err;
    }
  }

  // Artists : separate sweep.
  const unenrichedArtists = await db
    .select({ artistId: artists.id, name: artists.name })
    .from(artists)
    .where(isNull(artists.mbid));

  wlog.info({ artists: unenrichedArtists.length }, "artist sweep starting");

  let artistsEnriched = 0;
  for (let i = 0; i < unenrichedArtists.length; i++) {
    if (i > 0 || unenrichedAlbums.length > 0) await sleep(RATE_DELAY_MS);
    const row = unenrichedArtists[i];
    try {
      await withMbzRetry(
        () => enrichArtistByName({ artistId: row.artistId, name: row.name }),
        wlog,
      );
      artistsEnriched++;
    } catch (err) {
      wlog.error(
        { err, msg: (err as Error)?.message, artistId: row.artistId },
        "enrich artist failed",
      );
      throw err;
    }
  }

  // TheAudioDB image sweep : artists without image_url and not yet tried (tadb_id IS NULL).
  const unenrichedImages = await db
    .select({ artistId: artists.id, name: artists.name, mbid: artists.mbid })
    .from(artists)
    .where(and(isNull(artists.imageUrl), isNull(artists.tadbId)));

  wlog.info({ artists: unenrichedImages.length }, "tadb image sweep starting");

  let imagesEnriched = 0;
  for (let i = 0; i < unenrichedImages.length; i++) {
    if (i > 0 || unenrichedArtists.length > 0 || unenrichedAlbums.length > 0) {
      await sleep(RATE_DELAY_MS);
    }
    const row = unenrichedImages[i];
    const hasRealMbid = row.mbid !== null && row.mbid !== SENTINEL_MBID;
    try {
      if (hasRealMbid) {
        await enrichArtistImageByMbid({ artistId: row.artistId, mbid: row.mbid! });
      } else {
        await enrichArtistImageByName({ artistId: row.artistId, name: row.name });
      }
      imagesEnriched++;
    } catch (err) {
      wlog.error(
        { err, msg: (err as Error)?.message, artistId: row.artistId },
        "enrich artist image failed",
      );
      throw err;
    }
  }

  wlog.info(
    { albumsEnriched, artistsEnriched, imagesEnriched },
    "enrich complete",
  );
  return { albumsEnriched, artistsEnriched, imagesEnriched };
}
