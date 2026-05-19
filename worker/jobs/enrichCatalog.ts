import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { albums, albumArtists, artists } from "@/db/schema";
import { log } from "@/lib/log";
import {
  enrichAlbumByNames,
  enrichArtistByName,
} from "@/lib/musicbrainz/catalog";
import { enrichCatalogQueue } from "../queue";

const RATE_DELAY_MS = 1100;
const CHUNK_SIZE = 25;

export interface EnrichCatalogResult {
  albumsEnriched: number;
  artistsEnriched: number;
}

export interface SelfHealResult {
  unenrichedAlbums: number;
  unenrichedArtists: number;
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

  const unenrichedAlbums = Number(albCount?.n ?? 0);
  const unenrichedArtists = Number(artCount?.n ?? 0);

  if (unenrichedAlbums === 0 && unenrichedArtists === 0) {
    slog.info("catalog fully enriched, no action");
    return { unenrichedAlbums, unenrichedArtists, enqueued: false };
  }

  const existing = await enrichCatalogQueue.getJob("enrich-catalog-global");
  if (existing) {
    const state = await existing.getState();
    if (state === "failed") {
      slog.info({ state }, "removing stale failed job");
      await existing.remove();
    } else {
      slog.info({ state }, "enrich already pending — no re-enqueue");
      return { unenrichedAlbums, unenrichedArtists, enqueued: false };
    }
  }

  await enrichCatalogQueue.add(
    "enrich-catalog",
    {},
    { jobId: "enrich-catalog-global" },
  );
  slog.info(
    { unenrichedAlbums, unenrichedArtists },
    "self-heal enqueued enrich-catalog",
  );
  return { unenrichedAlbums, unenrichedArtists, enqueued: true };
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
    .where(and(isNull(albums.mbid), eq(albumArtists.position, 0)));

  wlog.info({ albums: unenrichedAlbums.length }, "album sweep starting");

  let albumsEnriched = 0;
  for (let i = 0; i < unenrichedAlbums.length; i++) {
    if (i > 0) await sleep(RATE_DELAY_MS);
    const row = unenrichedAlbums[i];
    try {
      await enrichAlbumByNames({
        albumId: row.albumId,
        artistName: row.artistName,
        albumName: row.albumName,
      });
      albumsEnriched++;
      if (albumsEnriched % CHUNK_SIZE === 0) {
        wlog.info(
          { albumsEnriched, total: unenrichedAlbums.length },
          "chunk persisted",
        );
      }
    } catch (err) {
      wlog.error({ err, albumId: row.albumId }, "enrich album failed");
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
      await enrichArtistByName({ artistId: row.artistId, name: row.name });
      artistsEnriched++;
    } catch (err) {
      wlog.error({ err, artistId: row.artistId }, "enrich artist failed");
      throw err;
    }
  }

  wlog.info({ albumsEnriched, artistsEnriched }, "enrich complete");
  return { albumsEnriched, artistsEnriched };
}
