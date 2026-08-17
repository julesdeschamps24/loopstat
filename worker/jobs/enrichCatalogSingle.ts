import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { albums, albumArtists, artists } from "@/db/schema";
import { log } from "@/lib/log";
import { enrichAlbumImageByDeezer } from "@/lib/deezer/catalog";
import { enrichArtistImage } from "./enrichArtistImage";

export interface EnrichCatalogSingleArgs {
  type: "album" | "artist";
  id: string;
}

/**
 * Enrich a single album or artist. Called from the on-demand `/api/enrich-
 * single` endpoint when a page handler detects a NULL image_url. Best-effort
 * - errors are logged, not rethrown (the queue's job retry handles transient
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
        imageUrl: albums.imageUrl,
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
    if (row.imageUrl !== null) {
      wlog.info({}, "album already has image");
      return;
    }

    // Click-triggered enrich via Deezer (fast, parallel-safe, ~150ms). Fills
    // image_url + release_date in one shot; the background sweep uses the same
    // Deezer path.
    await enrichAlbumImageByDeezer({
      albumId: row.albumId,
      albumName: row.albumName,
      artistName: row.artistName,
    });
    wlog.info({}, "album image enriched (Deezer)");
    return;
  }

  // type === "artist"
  const [row] = await db
    .select({
      artistId: artists.id,
      name: artists.name,
      imageUrl: artists.imageUrl,
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
  if (row.deezerId !== null) {
    wlog.info({ deezerId: row.deezerId }, "deezer already attempted");
    return;
  }

  await enrichArtistImage({
    artistId: row.artistId,
    name: row.name,
  });
  wlog.info({}, "artist image enriched");
}
