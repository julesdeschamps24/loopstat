const API_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = "loopstat/1.0 (https://loopstat.tech)";

export class MusicBrainzError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly bodyText: string,
    public readonly retryAfterMs?: number,
  ) {
    super(`MusicBrainz ${path} failed: ${status}`);
    this.name = "MusicBrainzError";
  }
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = parseInt(header, 10);
  if (isNaN(seconds) || seconds <= 0) return undefined;
  return seconds * 1000;
}

/**
 * Fetch a JSON resource from the MusicBrainz Web Service v2.
 * - Sends the mandatory User-Agent header (sans User-Agent, MBz ban l'IP).
 * - On 503/429, throws MusicBrainzError carrying retryAfterMs so the caller
 *   can decide to retry vs propagate.
 * - On any non-2xx, throws MusicBrainzError.
 */
export async function mbFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    const retryAfterMs = parseRetryAfter(res.headers.get("Retry-After"));
    throw new MusicBrainzError(res.status, path, bodyText, retryAfterMs);
  }

  return (await res.json()) as T;
}
