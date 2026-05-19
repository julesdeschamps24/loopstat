export class TheAudioDBError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly bodyText: string,
  ) {
    super(`TheAudioDB ${path} failed: ${status}`);
    this.name = "TheAudioDBError";
  }
}

/**
 * Fetch a JSON resource from the TheAudioDB API v1.
 *
 * Reads `TADB_API_KEY` from env (defaults to "2", their public dev key — fine
 * in dev, rate-limited in prod, request a free key for production).
 *
 * Throws TheAudioDBError on non-2xx. No retry-after parsing — TheAudioDB doesn't
 * surface rate-limit headers; the caller paces via sleep().
 */
export async function tadbFetch<T>(path: string): Promise<T> {
  const apiKey = process.env.TADB_API_KEY || "2";
  const url = `https://www.theaudiodb.com/api/v1/json/${apiKey}${path}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new TheAudioDBError(res.status, path, bodyText);
  }

  return (await res.json()) as T;
}
