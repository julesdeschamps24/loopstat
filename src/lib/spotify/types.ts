export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SpotifyArtistSimple {
  id: string;
  name: string;
}

export interface SpotifyArtist extends SpotifyArtistSimple {
  images?: SpotifyImage[];
  genres?: string[];
  popularity?: number;
  followers?: { total: number };
}

export interface SpotifyAlbumSimple {
  id: string;
  name: string;
  release_date?: string;
  release_date_precision?: "day" | "month" | "year";
  images?: SpotifyImage[];
  total_tracks?: number;
  album_type?: string;
  artists?: SpotifyArtistSimple[];
}

export interface SpotifyTrack {
  id: string;
  name: string;
  duration_ms: number;
  popularity?: number;
  explicit?: boolean;
  preview_url?: string | null;
  external_ids?: { isrc?: string };
  album?: SpotifyAlbumSimple;
  artists: SpotifyArtistSimple[];
}

export interface SpotifyPagingCursor<T> {
  items: T[];
  next: string | null;
  cursors: { after?: string; before?: string };
  limit: number;
  href: string;
}

export interface SpotifyPlayHistoryItem {
  track: SpotifyTrack;
  played_at: string;
  context: unknown;
}

export interface SpotifyCurrentlyPlaying {
  is_playing: boolean;
  progress_ms: number | null;
  item: SpotifyTrack | null;
  timestamp: number;
}
