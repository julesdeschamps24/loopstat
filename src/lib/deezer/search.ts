import { deezerFetch } from "./client";

interface RawArtist {
  id?: number;
  picture_medium?: string;
}

interface ArtistSearchResponse {
  data: RawArtist[] | null;
}

interface RawAlbum {
  id?: number;
  cover_medium?: string;
}

interface AlbumSearchResponse {
  data: RawAlbum[] | null;
}

export interface DeezerAlbumMatch {
  deezerAlbumId: number;
  coverUrl: string | null;
}

export interface DeezerArtistMatch {
  deezerId: number;
  pictureUrl: string | null;
}

/**
 * Search Deezer artist by name. Returns the top result (Deezer ranks by
 * popularity). Falls back to null if no match or response shape unexpected.
 * Deezer's `picture_medium` is 250×250 px - fine for our list/hero usage.
 *
 * Note : Deezer's open API returns a generic /artist/<id>/image placeholder
 * even for artists without a real photo. We treat picture_medium present as
 * "has photo" - Deezer's heuristic is that real photos use a different CDN
 * subdomain (`cdn-images.dzcdn.net`) vs the placeholder (`e-cdns-images...`).
 * We accept both - false positives are visually acceptable, the URL still
 * resolves to *something*.
 */
export async function searchArtistByName({
  name,
}: {
  name: string;
}): Promise<DeezerArtistMatch | null> {
  const data = await deezerFetch<ArtistSearchResponse>(
    `/search/artist?q=${encodeURIComponent(name)}&limit=1`,
  );
  const top = data.data?.[0];
  if (!top || typeof top.id !== "number") return null;
  return {
    deezerId: top.id,
    pictureUrl: top.picture_medium && top.picture_medium.length > 0
      ? top.picture_medium
      : null,
  };
}

/**
 * Search Deezer for an album by (artist + title). Used by the ultra-priority
 * tier to fetch covers in parallel - bypasses the MBz → CAA sequential chain.
 * Returns the top result (Deezer ranks by popularity).
 */
export async function searchAlbumByName({
  artistName,
  albumName,
}: {
  artistName: string;
  albumName: string;
}): Promise<DeezerAlbumMatch | null> {
  // Combine artist + album in the query for a stronger match.
  const q = `${artistName} ${albumName}`;
  const data = await deezerFetch<AlbumSearchResponse>(
    `/search/album?q=${encodeURIComponent(q)}&limit=1`,
  );
  const top = data.data?.[0];
  if (!top || typeof top.id !== "number") return null;
  return {
    deezerAlbumId: top.id,
    coverUrl: top.cover_medium && top.cover_medium.length > 0 ? top.cover_medium : null,
  };
}
