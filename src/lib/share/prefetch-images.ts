/**
 * Pre-fetches a set of image URLs in parallel and returns a Map of
 * `url → data:image/...;base64,...` data URLs. Used to bypass
 * Satori's internal image fetcher, which fetches serially - passing
 * data URLs lets Satori decode locally with no network round trip.
 *
 * Process-global cache with a 30-min TTL: across requests, the same
 * Spotify CDN cover is fetched once.
 */

type CacheEntry = { dataUrl: string; expiresAt: number };

const IMAGE_CACHE = new Map<string, CacheEntry>();
const TTL_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 1500;

async function fetchAsDataUrl(url: string): Promise<string | null> {
  const cached = IMAGE_CACHE.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.dataUrl;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const dataUrl = `data:${contentType};base64,${Buffer.from(buf).toString("base64")}`;
    IMAGE_CACHE.set(url, { dataUrl, expiresAt: Date.now() + TTL_MS });
    return dataUrl;
  } catch {
    // Network error, timeout, abort - caller treats as missing.
    return null;
  }
}

/**
 * Returns a Map keyed by the input URL. URLs that failed to fetch
 * (timeout, non-2xx, network error) are simply absent from the Map.
 */
export async function prefetchImages(
  urls: readonly string[],
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(urls.filter((u) => u && u.length > 0)));
  const entries = await Promise.all(
    unique.map(async (url) => [url, await fetchAsDataUrl(url)] as const),
  );
  const map = new Map<string, string>();
  for (const [url, dataUrl] of entries) {
    if (dataUrl !== null) map.set(url, dataUrl);
  }
  return map;
}
