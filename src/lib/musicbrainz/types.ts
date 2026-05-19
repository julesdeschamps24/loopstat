/**
 * Minimal subset of MusicBrainz Web Service v2 response types.
 * Only the fields we actually consume are typed — MBz returns a lot more.
 */

export interface MbReleaseGroup {
  id: string;
  score: number;
  title: string;
  "primary-type"?: string;
  "first-release-date"?: string;
  "artist-credit"?: { name: string }[];
  releases?: { id: string; media?: { "track-count"?: number }[] }[];
}

export interface MbReleaseGroupSearchResponse {
  "release-groups": MbReleaseGroup[];
}

export interface MbArtist {
  id: string;
  score: number;
  name: string;
}

export interface MbArtistSearchResponse {
  artists: MbArtist[];
}
