import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { albums, albumArtists, artists } from "@/db/schema";
import { log } from "@/lib/log";
import { MusicBrainzError } from "@/lib/musicbrainz/client";
import {
  enrichAlbumByNames,
  enrichArtistByName,
} from "@/lib/musicbrainz/catalog";
import { enrichArtistImageWithFallback } from "./enrichArtistImage";

const RATE_DELAY_MS = 1100;
const MAX_TRANSIENT_RETRIES = 5;
const RETRY_BUFFER_MS = 1000;
const DEFAULT_RETRY_WAIT_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isTransientMbzError(err: unknown): boolean {
  if (err instanceof MusicBrainzError && err.status === 503) return true;
  if (err instanceof TypeError && /fetch failed/i.test(err.message)) return true;
  return false;
}

async function withMbzRetry<T>(
  fn: () => Promise<T>,
  wlog: ReturnType<typeof log.child>,
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (isTransientMbzError(err) && attempt < MAX_TRANSIENT_RETRIES) {
        const hinted = err instanceof MusicBrainzError ? err.retryAfterMs : undefined;
        const wait = (hinted ?? DEFAULT_RETRY_WAIT_MS) + RETRY_BUFFER_MS;
        attempt += 1;
        wlog.warn({ attempt, waitMs: wait }, "transient MBz, backing off");
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
}

export interface EnrichCatalogPriorityResult {
  albumsEnriched: number;
  artistsEnriched: number;
  imagesEnriched: number;
}

/**
 * Priority enrich pass for a specific user's top items. Unlike the global
 * sweep, this job operates on explicit album + artist IDs (typically the
 * user's top 100 albums + top 50 artists). Runs in ~3 min total at 1.1s/call,
 * so the user sees real covers on their dashboard within minutes of import.
 *
 * Cross-user dedup is automatic : if user A's hot job has already set
 * mbid on an album, this job's filter (`isNull(mbid)`) skips it.
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
  let imagesEnriched = 0;

  // Albums : filter to ones not yet enriched.
  const unenrichedAlbums =
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
          .where(and(inArray(albums.id, albumIds), isNull(albums.mbid)));

  wlog.info({ albums: unenrichedAlbums.length }, "priority album sweep");

  for (let i = 0; i < unenrichedAlbums.length; i++) {
    if (i > 0) await sleep(RATE_DELAY_MS);
    const row = unenrichedAlbums[i];
    try {
      await withMbzRetry(
        () => enrichAlbumByNames({
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
      // Don't throw — partial progress is fine for the priority pass.
    }
  }

  // Artists : same pattern.
  const unenrichedArtists =
    artistIds.length === 0
      ? []
      : await db
          .select({ artistId: artists.id, name: artists.name })
          .from(artists)
          .where(and(inArray(artists.id, artistIds), isNull(artists.mbid)));

  wlog.info({ artists: unenrichedArtists.length }, "priority artist mbz sweep");

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
        "priority artist mbz failed",
      );
    }
  }

  // Deezer images for the same artists.
  const artistsForImages =
    artistIds.length === 0
      ? []
      : await db
          .select({ artistId: artists.id, name: artists.name })
          .from(artists)
          .where(
            and(
              inArray(artists.id, artistIds),
              isNull(artists.imageUrl),
              isNull(artists.deezerId),
            ),
          );

  wlog.info({ artists: artistsForImages.length }, "priority image sweep (Deezer)");

  for (let i = 0; i < artistsForImages.length; i++) {
    await sleep(RATE_DELAY_MS);
    const row = artistsForImages[i];
    try {
      await enrichArtistImageWithFallback({
        artistId: row.artistId,
        name: row.name,
      });
      imagesEnriched++;
    } catch (err) {
      wlog.error(
        { err, msg: (err as Error)?.message, artistId: row.artistId },
        "priority deezer image failed",
      );
    }
  }

  wlog.info(
    { albumsEnriched, artistsEnriched, imagesEnriched },
    "priority enrich complete",
  );

  return { albumsEnriched, artistsEnriched, imagesEnriched };
}
