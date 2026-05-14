import { spotifyFetch } from "./client";
import { SpotifyPagingOffset, SpotifyTrack, SpotifyArtist } from "./types";

export type TopPeriod = "4w" | "6m" | "1y";

export const PERIOD_TO_TIME_RANGE: Record<TopPeriod, string> = {
  "4w": "short_term",
  "6m": "medium_term",
  "1y": "long_term",
};

export function isTopPeriod(value: unknown): value is TopPeriod {
  if (typeof value !== "string") return false;
  return value === "4w" || value === "6m" || value === "1y";
}

export async function fetchTopTracks(
  userId: string,
  period: TopPeriod,
  limit = 50,
): Promise<SpotifyTrack[]> {
  const timeRange = PERIOD_TO_TIME_RANGE[period];
  const data = await spotifyFetch<SpotifyPagingOffset<SpotifyTrack>>(
    userId,
    `/me/top/tracks?time_range=${timeRange}&limit=${limit}`,
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
    `/me/top/artists?time_range=${timeRange}&limit=${limit}`,
  );
  return data.items;
}
