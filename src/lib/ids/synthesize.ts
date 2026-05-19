import { createHash } from "node:crypto";

function sha1Hex16(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 16);
}

/**
 * Synthesize a stable artist id from artist name.
 * Format: `art_<sha1[:16]>` over the lowercased trimmed name. Idempotent
 * across imports.
 *
 * Caveat: homonymous artists (e.g. "John Williams" classical vs jazz) collide
 * — accepted, since the Spotify JSON export doesn't distinguish them.
 */
export function synthesizeArtistId(name: string): string {
  return `art_${sha1Hex16(name.trim().toLowerCase())}`;
}

/**
 * Synthesize a stable album id from (artist, album) names.
 * Format: `alb_<sha1[:16]>` over "<artist>|<album>" (both lowercased + trimmed).
 * The artist is included so two unrelated albums called "Greatest Hits" don't
 * collide across different artists.
 */
export function synthesizeAlbumId(artistName: string, albumName: string): string {
  const key = `${artistName.trim().toLowerCase()}|${albumName.trim().toLowerCase()}`;
  return `alb_${sha1Hex16(key)}`;
}
