import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { spotifyTokens } from "@/db/schema";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { log } from "@/lib/log";

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
// Cap à 1 h : Spotify peut renvoyer un Retry-After de plusieurs dizaines de
// minutes lors d'un ban prolongé. L'ancien cap à 10 s nous faisait taper
// Spotify dès la fin de leur fenêtre courte, ce qui prolongeait le ban
// indéfiniment (chaque hit pendant le ban réinitialise leur compteur).
// 1 h couvre tous les bans observés en pratique.
const MAX_RETRY_AFTER_MS = 3_600_000;
const DEFAULT_RETRY_AFTER_MS = 1_000;

/**
 * Parse Retry-After header as integer seconds, capped at 1 h, default 1 s.
 */
function parseRetryAfter(header: string | null): number {
  if (!header) return DEFAULT_RETRY_AFTER_MS;
  const seconds = parseInt(header, 10);
  if (isNaN(seconds) || seconds <= 0) return DEFAULT_RETRY_AFTER_MS;
  return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
}

/**
 * Sleep for a given duration in milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  const doTokenRequest = async () =>
    fetch(TOKEN_URL, {
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

  let res = await doTokenRequest();

  if (res.status === 429) {
    const retryAfterMs = parseRetryAfter(res.headers.get("Retry-After"));
    log.warn({ path: "/api/token", retryAfterMs }, "Spotify 429, retrying once");
    await sleep(retryAfterMs);
    res = await doTokenRequest();

    if (res.status === 429) {
      const bodyText = await res.text();
      throw new SpotifyError(res.status, "/api/token", bodyText, retryAfterMs);
    }
  }

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

  if (res.status === 429) {
    const retryAfterMs = parseRetryAfter(res.headers.get("Retry-After"));
    log.warn({ path, retryAfterMs }, "Spotify 429, retrying once");
    await sleep(retryAfterMs);
    res = await doFetch(token);

    if (res.status === 429) {
      const bodyText = await res.text();
      throw new SpotifyError(res.status, path, bodyText, retryAfterMs);
    }
  }

  if (!res.ok) {
    const bodyText = await res.text();
    throw new SpotifyError(res.status, path, bodyText);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
