import { spotifyFetch } from "./client";
import { SpotifyPagingOffset, SpotifyTrack, SpotifyArtist } from "./types";

export type TopPeriod = "4w" | "6m" | "1y";

export const PERIOD_TO_TIME_RANGE: Record<
  TopPeriod,
  "short_term" | "medium_term" | "long_term"
> = {
  "4w": "short_term",
  "6m": "medium_term",
  "1y": "long_term",
};

export function isTopPeriod(value: unknown): value is TopPeriod {
  if (typeof value !== "string") return false;
  return value === "4w" || value === "6m" || value === "1y";
}

// Spotify's /me/top/{type} accepts limit 1-50; clamp to fail fast on bad input.
function clampLimit(limit: number): number {
  return Math.max(1, Math.min(Math.trunc(limit), 50));
}

export async function fetchTopTracks(
  userId: string,
  period: TopPeriod,
  limit = 50,
): Promise<SpotifyTrack[]> {
  const timeRange = PERIOD_TO_TIME_RANGE[period];
  const data = await spotifyFetch<SpotifyPagingOffset<SpotifyTrack>>(
    userId,
    `/me/top/tracks?time_range=${timeRange}&limit=${clampLimit(limit)}`,
  );
  return data.items;
}

export async function fetchTopArtists(
  userId: string,
  period: TopPeriod,
  limit = 50,
): Promise<SpotifyArtist[]> {
  const timeRange = PERIOD_TO_TIME_RANGE[period];
  const data = await spotifyFetch<SpotifyPagingOffset<SpotifyArtist>>(
    userId,
    `/me/top/artists?time_range=${timeRange}&limit=${clampLimit(limit)}`,
  );
  return data.items;
}
