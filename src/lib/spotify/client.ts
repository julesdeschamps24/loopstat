import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { spotifyTokens } from "@/db/schema";
import { decryptToken, encryptToken } from "@/lib/crypto";

export class SpotifyError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly bodyText: string,
    public readonly retryAfterMs?: number,
  ) {
    super(`Spotify ${path} failed: ${status}`);
    this.name = "SpotifyError";
  }
}

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";
const REFRESH_THRESHOLD_MS = 60_000;

interface RefreshResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  refresh_token?: string;
}

async function refreshAccessToken(userId: string): Promise<string> {
  const row = await db.query.spotifyTokens.findFirst({
    where: eq(spotifyTokens.userId, userId),
  });
  if (!row) throw new Error(`No tokens for user ${userId}`);

  const refreshToken = decryptToken(row.refreshToken);

  const basic = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
  ).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const bodyText = await res.text();
    throw new SpotifyError(res.status, "/api/token", bodyText);
  }

  const data = (await res.json()) as RefreshResponse;
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await db
    .update(spotifyTokens)
    .set({
      accessToken: encryptToken(data.access_token),
      refreshToken: data.refresh_token
        ? encryptToken(data.refresh_token)
        : row.refreshToken,
      expiresAt,
      scope: data.scope ?? row.scope,
    })
    .where(eq(spotifyTokens.userId, userId));

  return data.access_token;
}

export async function getValidAccessToken(userId: string): Promise<string> {
  const row = await db.query.spotifyTokens.findFirst({
    where: eq(spotifyTokens.userId, userId),
  });
  if (!row) throw new Error(`No tokens for user ${userId}`);

  if (row.expiresAt.getTime() - Date.now() > REFRESH_THRESHOLD_MS) {
    return decryptToken(row.accessToken);
  }
  return refreshAccessToken(userId);
}

export async function spotifyFetch<T>(
  userId: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const doFetch = async (token: string) =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${token}`,
      },
    });

  let token = await getValidAccessToken(userId);
  let res = await doFetch(token);

  if (res.status === 401) {
    token = await refreshAccessToken(userId);
    res = await doFetch(token);
  }

  if (!res.ok) {
    const bodyText = await res.text();
    throw new SpotifyError(res.status, path, bodyText);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
