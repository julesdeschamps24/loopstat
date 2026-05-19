const CAA_BASE = "https://coverartarchive.org";

/**
 * Fetch the cover URL for a MusicBrainz release-group MBID.
 * - 200 (after following 302): returns the final archive.org URL.
 * - 404: returns null (the release-group exists in MBz but has no cover on CAA).
 * - other non-2xx (503, network, etc.): throws so caller can retry/backoff.
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

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Cover Art Archive ${url} failed: ${res.status}`);
  }
  return res.url;
}
