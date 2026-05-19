import { tadbFetch } from "./client";

interface RawArtist {
  idArtist?: string;
  strArtistThumb?: string;
}

interface ArtistSearchResponse {
  artists: RawArtist[] | null;
}

export interface TadbArtistMatch {
  tadbId: number;
  thumbUrl: string | null;
}

function parseTopArtist(data: ArtistSearchResponse): TadbArtistMatch | null {
  const top = data.artists?.[0];
  if (!top || !top.idArtist) return null;
  return {
    tadbId: parseInt(top.idArtist, 10),
    thumbUrl: top.strArtistThumb && top.strArtistThumb.length > 0 ? top.strArtistThumb : null,
  };
}

/**
 * Lookup TheAudioDB artist by MusicBrainz MBID. Most precise match — no name
 * ambiguity.
 */
export async function lookupArtistByMbid({ mbid }: { mbid: string }): Promise<TadbArtistMatch | null> {
  const data = await tadbFetch<ArtistSearchResponse>(`/artist-mb.php?i=${mbid}`);
  return parseTopArtist(data);
}

/**
 * Search TheAudioDB artist by name. Used as fallback when no MBz mbid is
 * available. TheAudioDB ranks by popularity ; we take the first result.
 */
export async function searchArtistByName({ name }: { name: string }): Promise<TadbArtistMatch | null> {
  const data = await tadbFetch<ArtistSearchResponse>(`/search.php?s=${encodeURIComponent(name)}`);
  return parseTopArtist(data);
}
