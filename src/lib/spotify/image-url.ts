/**
 * Spotify CDN album cover URL size hints. The 16-char hex prefix after
 * /image/ encodes a 4-byte type id + a 4-byte size code. For album
 * artwork (type `ab67616d`), the documented sizes are:
 *
 *   large  → 0000b273  (~640×640)   default Spotify returns
 *   medium → 00001e02  (~300×300)
 *   small  → 00004851  (~64×64)
 *
 * We render covers at most ~144px (RankRow scale ~2x retina) and the
 * wall tiles at 180-200px, so the 640 originals are 4-20× bigger than
 * needed. Downsizing dramatically cuts Satori's per-render fetch
 * latency and PNG encode time.
 */

const LARGE = "0000b273";
const MEDIUM = "00001e02";
const SMALL = "00004851";

type SizeKey = "medium" | "small";

const TARGET: Record<SizeKey, string> = {
  medium: MEDIUM,
  small: SMALL,
};

export function shrinkAlbumCoverUrl(
  url: string | null | undefined,
  size: SizeKey,
): string | null {
  if (!url) return null;
  if (!url.includes(LARGE)) return url;
  return url.replace(LARGE, TARGET[size]);
}
