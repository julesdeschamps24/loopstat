import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { albums, albumArtists, artists } from "@/db/schema";
import { log } from "@/lib/log";
import { enrichAlbumImageByDeezer, enrichArtistImageByDeezer } from "@/lib/deezer/catalog";
import { DEEZER_DELAY_MS, sleep, withQuotaRetry } from "./deezerPacing";

const ULTRA_PRIORITY_LIMIT = 20;

export interface EnrichCatalogPriorityResult {
  albumsEnriched: number;
  artistsEnriched: number;
}

/**
 * Priority enrich pass for a specific user's top items. Two phases :
 *
 * 1. Ultra-priority (parallel) : first 20 albums + 20 artists hit Deezer
 *    concurrently via Promise.allSettled — typically completes in <2s for 40
 *    items. The user sees real covers on their dashboard almost immediately.
 *
 * 2. Window-ordered sweep : the rest of `albumIds` and `artistIds` processed
 *    sequentially with a 50ms soft delay (Deezer tolerates ~50 req/s).
 *    `Map` lookup over the original ID order preserves the window priority
 *    (1w → 4w → 6m → 1y) that the SELECT itself can't preserve.
 *
 * Cross-user dedup is automatic : filter `isNull(deezerId)` skips items
 * already enriched by another user's hot job.
 */
export async function enrichCatalogPriority({
  userId,
  albumIds,
  artistIds,
}: {
  userId: string;
  albumIds: string[];
  artistIds: string[];
}): Promise<EnrichCatalogPriorityResult> {
  const wlog = log.child({ job: "enrich-priority", userId });
  let albumsEnriched = 0;
  let artistsEnriched = 0;

  // Ultra-priority : parallel Deezer for first 20 of each.
  const ultraAlbumIds = albumIds.slice(0, ULTRA_PRIORITY_LIMIT);
  const ultraArtistIds = artistIds.slice(0, ULTRA_PRIORITY_LIMIT);

  const [ultraAlbumRows, ultraArtistRows] = await Promise.all([
    ultraAlbumIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            albumId: albums.id,
            albumName: albums.name,
            artistName: artists.name,
          })
          .from(albums)
          .innerJoin(albumArtists, eq(albumArtists.albumId, albums.id))
          .innerJoin(artists, eq(artists.id, albumArtists.artistId))
          .where(and(inArray(albums.id, ultraAlbumIds), isNull(albums.deezerId))),
    ultraArtistIds.length === 0
      ? Promise.resolve([])
      : db
          .select({ artistId: artists.id, name: artists.name })
          .from(artists)
          .where(and(inArray(artists.id, ultraArtistIds), isNull(artists.deezerId))),
  ]);

  wlog.info(
    { albums: ultraAlbumRows.length, artists: ultraArtistRows.length },
    "ultra-priority sweep (Deezer, parallel)",
  );

  const ultraStart = Date.now();
  const ultraResults = await Promise.allSettled([
    ...ultraAlbumRows.map((row) =>
      withQuotaRetry(
        () =>
          enrichAlbumImageByDeezer({
            albumId: row.albumId,
            artistName: row.artistName,
            albumName: row.albumName,
          }),
        wlog,
      ),
    ),
    ...ultraArtistRows.map((row) =>
      withQuotaRetry(
        () => enrichArtistImageByDeezer({ artistId: row.artistId, name: row.name }),
        wlog,
      ),
    ),
  ]);
  const ultraSuccess = ultraResults.filter((r) => r.status === "fulfilled").length;
  wlog.info(
    { success: ultraSuccess, total: ultraResults.length, durationMs: Date.now() - ultraStart },
    "ultra-priority complete",
  );

  // Window-ordered album sweep.
  const unenrichedAlbumRows =
    albumIds.length === 0
      ? []
      : await db
          .select({
            albumId: albums.id,
            albumName: albums.name,
            artistName: artists.name,
          })
          .from(albums)
          .innerJoin(albumArtists, eq(albumArtists.albumId, albums.id))
          .innerJoin(artists, eq(artists.id, albumArtists.artistId))
          .where(and(inArray(albums.id, albumIds), isNull(albums.deezerId)));

  const albumMap = new Map(unenrichedAlbumRows.map((a) => [a.albumId, a]));

  wlog.info(
    { albums: albumMap.size, total: albumIds.length },
    "priority album sweep (window-ordered)",
  );

  let albumsProcessed = 0;
  for (const id of albumIds) {
    const row = albumMap.get(id);
    if (!row) continue;
    if (albumsProcessed > 0) await sleep(DEEZER_DELAY_MS);
    try {
      await withQuotaRetry(
        () =>
          enrichAlbumImageByDeezer({
            albumId: row.albumId,
            artistName: row.artistName,
            albumName: row.albumName,
          }),
        wlog,
      );
      albumsEnriched++;
    } catch (err) {
      wlog.error(
        { err, msg: (err as Error)?.message, albumId: row.albumId },
        "priority album enrich failed",
      );
    }
    albumsProcessed++;
  }

  // Window-ordered artist sweep.
  const unenrichedArtistRows =
    artistIds.length === 0
      ? []
      : await db
          .select({ artistId: artists.id, name: artists.name })
          .from(artists)
          .where(and(inArray(artists.id, artistIds), isNull(artists.deezerId)));

  const artistMap = new Map(unenrichedArtistRows.map((a) => [a.artistId, a]));

  wlog.info(
    { artists: artistMap.size, total: artistIds.length },
    "priority artist sweep (window-ordered)",
  );

  let artistsProcessed = 0;
  for (const id of artistIds) {
    const row = artistMap.get(id);
    if (!row) continue;
    if (artistsProcessed > 0 || albumMap.size > 0) await sleep(DEEZER_DELAY_MS);
    try {
      await withQuotaRetry(
        () => enrichArtistImageByDeezer({ artistId: row.artistId, name: row.name }),
        wlog,
      );
      artistsEnriched++;
    } catch (err) {
      wlog.error(
        { err, msg: (err as Error)?.message, artistId: row.artistId },
        "priority artist enrich failed",
      );
    }
    artistsProcessed++;
  }

  wlog.info({ albumsEnriched, artistsEnriched }, "priority enrich complete");
  return { albumsEnriched, artistsEnriched };
}
