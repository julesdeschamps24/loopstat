import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { albums, albumArtists, artists } from "@/db/schema";
import { log } from "@/lib/log";
import { enrichAlbumByNames } from "@/lib/musicbrainz/catalog";
import { enrichArtistImageWithFallback } from "./enrichArtistImage";

export interface EnrichCatalogSingleArgs {
  type: "album" | "artist";
  id: string;
}

/**
 * Enrich a single album or artist. Called from the on-demand `/api/enrich-
 * single` endpoint when a page handler detects a NULL image_url. Best-effort
 * — errors are logged, not rethrown (the queue's job retry handles transient
 * failures, but we don't want one bad item to spin forever).
 */
export async function enrichCatalogSingle({
  type,
  id,
}: EnrichCatalogSingleArgs): Promise<void> {
  const wlog = log.child({ job: "enrich-single", type, id });

  if (type === "album") {
    const [row] = await db
      .select({
        albumId: albums.id,
        albumName: albums.name,
        artistName: artists.name,
        mbid: albums.mbid,
      })
      .from(albums)
      .innerJoin(albumArtists, eq(albumArtists.albumId, albums.id))
      .innerJoin(artists, eq(artists.id, albumArtists.artistId))
      .where(eq(albums.id, id))
      .limit(1);

    if (!row) {
      wlog.warn({}, "album not found");
      return;
    }
    if (row.mbid !== null) {
      wlog.info({ mbid: row.mbid }, "album already attempted");
      return;
    }

    await enrichAlbumByNames({
      albumId: row.albumId,
      albumName: row.albumName,
      artistName: row.artistName,
    });
    wlog.info({}, "album enriched");
    return;
  }

  // type === "artist"
  const [row] = await db
    .select({
      artistId: artists.id,
      name: artists.name,
      mbid: artists.mbid,
      imageUrl: artists.imageUrl,
      tadbId: artists.tadbId,
      deezerId: artists.deezerId,
    })
    .from(artists)
    .where(eq(artists.id, id))
    .limit(1);

  if (!row) {
    wlog.warn({}, "artist not found");
    return;
  }
  if (row.imageUrl !== null) {
    wlog.info({}, "artist already has image");
    return;
  }
  if (row.tadbId !== null && row.deezerId !== null) {
    wlog.info({ tadbId: row.tadbId, deezerId: row.deezerId }, "all sources already attempted");
    return;
  }

  await enrichArtistImageWithFallback({
    artistId: row.artistId,
    name: row.name,
    mbid: row.mbid ?? null,
  });
  wlog.info({}, "artist image enriched");
}
