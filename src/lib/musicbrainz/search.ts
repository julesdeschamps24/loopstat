import { mbFetch } from "./client";
import type {
  MbArtistSearchResponse,
  MbReleaseGroupSearchResponse,
} from "./types";

const MIN_SCORE = 90;

function escapeLucene(s: string): string {
  // Escape backslash + double quotes (Lucene query syntax used by MBz).
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export interface ReleaseGroupMatch {
  mbid: string;
  score: number;
  primaryType?: string;
  firstReleaseDate?: string;
  totalTracks?: number;
}

/**
 * Search MBz release-group by (artist, album) names. Returns the top match if
 * its score is ≥ MIN_SCORE (90), otherwise null. Caller decides whether to
 * persist the null result as a sentinel mbid to avoid re-attempts.
 */
export async function searchReleaseGroup({
  artist,
  album,
}: {
  artist: string;
  album: string;
}): Promise<ReleaseGroupMatch | null> {
  const query = `release:"${escapeLucene(album)}" AND artist:"${escapeLucene(artist)}"`;
  const encodedQuery = encodeURIComponent(query).replace(/%3A/gi, ":");
  const path = `/release-group/?query=${encodedQuery}&fmt=json&limit=5`;

  const data = await mbFetch<MbReleaseGroupSearchResponse>(path);
  const top = data["release-groups"]?.[0];
  if (!top || top.score < MIN_SCORE) return null;

  const totalTracks = top.releases?.[0]?.media?.reduce(
    (sum, m) => sum + (m["track-count"] ?? 0),
    0,
  );

  return {
    mbid: top.id,
    score: top.score,
    primaryType: top["primary-type"],
    firstReleaseDate: top["first-release-date"],
    totalTracks: totalTracks && totalTracks > 0 ? totalTracks : undefined,
  };
}

export interface ArtistMatch {
  mbid: string;
  score: number;
}

/**
 * Search MBz artist by name. Returns the top match if score ≥ MIN_SCORE.
 */
export async function searchArtist(name: string): Promise<ArtistMatch | null> {
  const query = `artist:"${escapeLucene(name)}"`;
  const encodedQuery = encodeURIComponent(query).replace(/%3A/gi, ":");
  const path = `/artist/?query=${encodedQuery}&fmt=json&limit=5`;

  const data = await mbFetch<MbArtistSearchResponse>(path);
  const top = data.artists?.[0];
  if (!top || top.score < MIN_SCORE) return null;

  return { mbid: top.id, score: top.score };
}
