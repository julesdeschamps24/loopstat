const CAA_BASE = "https://coverartarchive.org";

/**
 * Fetch the cover URL for a MusicBrainz release-group MBID.
 * - 200 (after following 302): returns the final archive.org URL.
 * - 403 / 404 / 500: returns null (no cover available). CAA emits 404 when
 *   the release-group isn't indexed, 403 when it exists but has no `front`,
 *   and 500 on items with broken metadata. All three are per-item "skip,
 *   no cover" — never recoverable for that specific mbid.
 * - 503: throws so the caller can retry (CAA actually busy).
 *
 * Notes:
 *  - `front-500` returns a 500px-wide cover (good for /album/[id] hero).
 *  - The fetch follows 302 by default; response.url is the resolved URL.
 *  - We don't proxy the image — we store the archive.org URL and the browser
 *    fetches it directly.
 */
export async function fetchCoverUrl(
  releaseGroupMbid: string,
): Promise<string | null> {
  const url = `${CAA_BASE}/release-group/${releaseGroupMbid}/front-500`;
  const res = await fetch(url, { redirect: "follow" });

  if (res.status === 403 || res.status === 404 || res.status === 500) return null;
  if (!res.ok) {
    throw new Error(`Cover Art Archive ${url} failed: ${res.status}`);
  }
  return res.url;
}
