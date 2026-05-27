import { eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { albums, albumArtists, artists } from "@/db/schema";
import { log } from "@/lib/log";
import { enrichAlbumImageByDeezer, enrichArtistImageByDeezer } from "@/lib/deezer/catalog";
import { enrichCatalogQueue } from "../queue";

const CHUNK_SIZE = 100;
const DEEZER_DELAY_MS = 50;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface EnrichCatalogResult {
  albumsEnriched: number;
  artistsEnriched: number;
}

export interface SelfHealResult {
  unenrichedAlbums: number;
  unenrichedArtists: number;
  enqueued: boolean;
}

export async function selfHealEnrichCatalog(): Promise<SelfHealResult> {
  const slog = log.child({ job: "enrich-catalog-self-heal" });

  const [albCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(albums)
    .where(isNull(albums.deezerId));
  const [artCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(artists)
    .where(isNull(artists.deezerId));

  const unenrichedAlbums = Number(albCount?.n ?? 0);
  const unenrichedArtists = Number(artCount?.n ?? 0);

  if (unenrichedAlbums === 0 && unenrichedArtists === 0) {
    slog.info({}, "catalog fully enriched, no action");
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

  await enrichCatalogQueue.add("enrich-catalog", {}, { jobId: "enrich-catalog-global" });
  slog.info({ unenrichedAlbums, unenrichedArtists }, "self-heal enqueued enrich-catalog");
  return { unenrichedAlbums, unenrichedArtists, enqueued: true };
}

export async function enrichCatalog(): Promise<EnrichCatalogResult> {
  const wlog = log.child({ job: "enrich-catalog" });

  const unenrichedAlbums = await db
    .select({
      albumId: albums.id,
      albumName: albums.name,
      artistName: artists.name,
    })
    .from(albums)
    .innerJoin(albumArtists, eq(albumArtists.albumId, albums.id))
    .innerJoin(artists, eq(artists.id, albumArtists.artistId))
    .where(isNull(albums.deezerId));

  wlog.info({ albums: unenrichedAlbums.length }, "album sweep starting");

  let albumsEnriched = 0;
  for (let i = 0; i < unenrichedAlbums.length; i++) {
    if (i > 0) await sleep(DEEZER_DELAY_MS);
    const row = unenrichedAlbums[i];
    try {
      await enrichAlbumImageByDeezer({
        albumId: row.albumId,
        artistName: row.artistName,
        albumName: row.albumName,
      });
      albumsEnriched++;
      if (albumsEnriched % CHUNK_SIZE === 0) {
        wlog.info({ albumsEnriched, total: unenrichedAlbums.length }, "chunk persisted");
      }
    } catch (err) {
      wlog.error({ err, msg: (err as Error)?.message, albumId: row.albumId }, "enrich album failed");
      throw err;
    }
  }

  const unenrichedArtists = await db
    .select({ artistId: artists.id, name: artists.name })
    .from(artists)
    .where(isNull(artists.deezerId));

  wlog.info({ artists: unenrichedArtists.length }, "artist sweep starting");

  let artistsEnriched = 0;
  for (let i = 0; i < unenrichedArtists.length; i++) {
    if (i > 0 || unenrichedAlbums.length > 0) await sleep(DEEZER_DELAY_MS);
    const row = unenrichedArtists[i];
    try {
      await enrichArtistImageByDeezer({ artistId: row.artistId, name: row.name });
      artistsEnriched++;
      if (artistsEnriched % CHUNK_SIZE === 0) {
        wlog.info({ artistsEnriched, total: unenrichedArtists.length }, "chunk persisted");
      }
    } catch (err) {
      wlog.error({ err, msg: (err as Error)?.message, artistId: row.artistId }, "enrich artist failed");
      throw err;
    }
  }

  wlog.info({ albumsEnriched, artistsEnriched }, "enrich complete");
  return { albumsEnriched, artistsEnriched };
}
