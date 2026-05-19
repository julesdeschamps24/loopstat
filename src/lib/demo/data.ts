/**
 * Fixtures démo affichées aux users qui n'ont pas encore importé leur
 * historique Spotify. Top tracks/artists/albums basés sur les hits mondiaux
 * Spotify 2024. Les IDs sont préfixés "demo:" — ne sont pas des Spotify
 * IDs valides ; les pages détail (/track/[id], etc.) ne sont pas atteintes
 * en mode démo (composants <RankedRow> rendent sans href donc non cliquables).
 */

export const DEMO_TOP_TRACKS: {
  trackId: string;
  name: string;
  artistNames: string[];
  albumImageUrl: string | null;
  plays: number;
}[] = [
  { trackId: "demo:espresso", name: "Espresso", artistNames: ["Sabrina Carpenter"], albumImageUrl: null, plays: 1247 },
  { trackId: "demo:birds-of-a-feather", name: "BIRDS OF A FEATHER", artistNames: ["Billie Eilish"], albumImageUrl: null, plays: 1180 },
  { trackId: "demo:beautiful-things", name: "Beautiful Things", artistNames: ["Benson Boone"], albumImageUrl: null, plays: 1102 },
  { trackId: "demo:lose-control", name: "Lose Control", artistNames: ["Teddy Swims"], albumImageUrl: null, plays: 1043 },
  { trackId: "demo:bar-song-tipsy", name: "A Bar Song (Tipsy)", artistNames: ["Shaboozey"], albumImageUrl: null, plays: 987 },
  { trackId: "demo:fortnight", name: "Fortnight", artistNames: ["Taylor Swift", "Post Malone"], albumImageUrl: null, plays: 936 },
  { trackId: "demo:houdini", name: "Houdini", artistNames: ["Eminem"], albumImageUrl: null, plays: 892 },
  { trackId: "demo:cruel-summer", name: "Cruel Summer", artistNames: ["Taylor Swift"], albumImageUrl: null, plays: 854 },
  { trackId: "demo:please-please-please", name: "Please Please Please", artistNames: ["Sabrina Carpenter"], albumImageUrl: null, plays: 821 },
  { trackId: "demo:texas-hold-em", name: "Texas Hold 'Em", artistNames: ["Beyoncé"], albumImageUrl: null, plays: 789 },
  { trackId: "demo:i-had-some-help", name: "I Had Some Help", artistNames: ["Post Malone", "Morgan Wallen"], albumImageUrl: null, plays: 754 },
  { trackId: "demo:stick-season", name: "Stick Season", artistNames: ["Noah Kahan"], albumImageUrl: null, plays: 723 },
  { trackId: "demo:million-dollar-baby", name: "Million Dollar Baby", artistNames: ["Tommy Richman"], albumImageUrl: null, plays: 691 },
  { trackId: "demo:end-of-beginning", name: "End of Beginning", artistNames: ["Djo"], albumImageUrl: null, plays: 658 },
  { trackId: "demo:taste", name: "Taste", artistNames: ["Sabrina Carpenter"], albumImageUrl: null, plays: 627 },
  { trackId: "demo:di-mi-nombre", name: "Di Mi Nombre", artistNames: ["Rosalía"], albumImageUrl: null, plays: 595 },
  { trackId: "demo:not-like-us", name: "Not Like Us", artistNames: ["Kendrick Lamar"], albumImageUrl: null, plays: 568 },
  { trackId: "demo:greedy", name: "Greedy", artistNames: ["Tate McRae"], albumImageUrl: null, plays: 539 },
  { trackId: "demo:we-cant-be-friends", name: "We Can't Be Friends (Wait for Your Love)", artistNames: ["Ariana Grande"], albumImageUrl: null, plays: 512 },
  { trackId: "demo:lovin-on-me", name: "Lovin On Me", artistNames: ["Jack Harlow"], albumImageUrl: null, plays: 487 },
  { trackId: "demo:good-luck-babe", name: "Good Luck, Babe!", artistNames: ["Chappell Roan"], albumImageUrl: null, plays: 459 },
  { trackId: "demo:training-season", name: "Training Season", artistNames: ["Dua Lipa"], albumImageUrl: null, plays: 432 },
  { trackId: "demo:water", name: "Water", artistNames: ["Tyla"], albumImageUrl: null, plays: 408 },
  { trackId: "demo:gata-only", name: "GATA ONLY", artistNames: ["FloyyMenor", "Cris MJ"], albumImageUrl: null, plays: 386 },
  { trackId: "demo:flowers", name: "Flowers", artistNames: ["Miley Cyrus"], albumImageUrl: null, plays: 362 },
  { trackId: "demo:agora-hills", name: "agora hills", artistNames: ["Doja Cat"], albumImageUrl: null, plays: 338 },
  { trackId: "demo:paint-the-town-red", name: "Paint The Town Red", artistNames: ["Doja Cat"], albumImageUrl: null, plays: 312 },
  { trackId: "demo:vampire", name: "vampire", artistNames: ["Olivia Rodrigo"], albumImageUrl: null, plays: 287 },
  { trackId: "demo:what-was-i-made-for", name: "What Was I Made For?", artistNames: ["Billie Eilish"], albumImageUrl: null, plays: 251 },
  { trackId: "demo:si-no-estas", name: "Si No Estás", artistNames: ["Iñigo Quintero"], albumImageUrl: null, plays: 214 },
];

export const DEMO_TOP_ARTISTS: {
  artistId: string;
  name: string;
  imageUrl: string | null;
  plays: number;
}[] = [
  { artistId: "demo:sabrina-carpenter", name: "Sabrina Carpenter", imageUrl: null, plays: 2695 },
  { artistId: "demo:taylor-swift", name: "Taylor Swift", imageUrl: null, plays: 1790 },
  { artistId: "demo:billie-eilish", name: "Billie Eilish", imageUrl: null, plays: 1431 },
  { artistId: "demo:doja-cat", name: "Doja Cat", imageUrl: null, plays: 650 },
  { artistId: "demo:benson-boone", name: "Benson Boone", imageUrl: null, plays: 1102 },
  { artistId: "demo:teddy-swims", name: "Teddy Swims", imageUrl: null, plays: 1043 },
  { artistId: "demo:shaboozey", name: "Shaboozey", imageUrl: null, plays: 987 },
  { artistId: "demo:post-malone", name: "Post Malone", imageUrl: null, plays: 1690 },
  { artistId: "demo:eminem", name: "Eminem", imageUrl: null, plays: 892 },
  { artistId: "demo:noah-kahan", name: "Noah Kahan", imageUrl: null, plays: 723 },
  { artistId: "demo:beyonce", name: "Beyoncé", imageUrl: null, plays: 789 },
  { artistId: "demo:ariana-grande", name: "Ariana Grande", imageUrl: null, plays: 512 },
  { artistId: "demo:chappell-roan", name: "Chappell Roan", imageUrl: null, plays: 459 },
  { artistId: "demo:dua-lipa", name: "Dua Lipa", imageUrl: null, plays: 432 },
  { artistId: "demo:kendrick-lamar", name: "Kendrick Lamar", imageUrl: null, plays: 568 },
];

// Pré-trier par plays décroissants (les valeurs ci-dessus ne le sont pas
// strictement). Drizzle/queries renvoient triés ; ici on fait pareil.
DEMO_TOP_ARTISTS.sort((a, b) => b.plays - a.plays);

export const DEMO_TOP_ALBUMS: {
  albumId: string;
  name: string;
  imageUrl: string | null;
  artistNames: string[];
  plays: number;
}[] = [
  { albumId: "demo:short-n-sweet", name: "Short n' Sweet", artistNames: ["Sabrina Carpenter"], imageUrl: null, plays: 2068 },
  { albumId: "demo:tortured-poets", name: "The Tortured Poets Department", artistNames: ["Taylor Swift"], imageUrl: null, plays: 1790 },
  { albumId: "demo:hit-me-hard", name: "Hit Me Hard and Soft", artistNames: ["Billie Eilish"], imageUrl: null, plays: 1180 },
  { albumId: "demo:fireworks", name: "Fireworks & Rollerblades", artistNames: ["Benson Boone"], imageUrl: null, plays: 1102 },
  { albumId: "demo:i-tried-everything", name: "I've Tried Everything But Therapy", artistNames: ["Teddy Swims"], imageUrl: null, plays: 1043 },
  { albumId: "demo:where-i-been", name: "Where I've Been, Isn't Where I'm Going", artistNames: ["Shaboozey"], imageUrl: null, plays: 987 },
  { albumId: "demo:f1-trillion", name: "F-1 Trillion", artistNames: ["Post Malone"], imageUrl: null, plays: 754 },
  { albumId: "demo:the-death-trick", name: "The Death of Slim Shady", artistNames: ["Eminem"], imageUrl: null, plays: 892 },
  { albumId: "demo:stick-season-album", name: "Stick Season", artistNames: ["Noah Kahan"], imageUrl: null, plays: 723 },
  { albumId: "demo:cowboy-carter", name: "Cowboy Carter", artistNames: ["Beyoncé"], imageUrl: null, plays: 789 },
  { albumId: "demo:eternal-sunshine", name: "eternal sunshine", artistNames: ["Ariana Grande"], imageUrl: null, plays: 512 },
  { albumId: "demo:rise-fall-rosie", name: "The Rise and Fall of a Midwest Princess", artistNames: ["Chappell Roan"], imageUrl: null, plays: 459 },
  { albumId: "demo:radical-optimism", name: "Radical Optimism", artistNames: ["Dua Lipa"], imageUrl: null, plays: 432 },
  { albumId: "demo:gnx", name: "GNX", artistNames: ["Kendrick Lamar"], imageUrl: null, plays: 568 },
  { albumId: "demo:scarlet-2", name: "Scarlet 2", artistNames: ["Doja Cat"], imageUrl: null, plays: 650 },
];

DEMO_TOP_ALBUMS.sort((a, b) => b.plays - a.plays);

/**
 * Distribution plausible des écoutes par heure (24 entries, hour 0..23).
 * Pattern : creux nuit profonde (3-6h), build-up matin, peak soir (18-22h),
 * descente nuit. Total ~3000 plays (cohérent avec DEMO_TOTAL_PLAYS).
 */
export const DEMO_LISTENING_HOURS: { hour: number; count: number }[] = [
  { hour: 0, count: 48 },
  { hour: 1, count: 22 },
  { hour: 2, count: 10 },
  { hour: 3, count: 5 },
  { hour: 4, count: 3 },
  { hour: 5, count: 8 },
  { hour: 6, count: 35 },
  { hour: 7, count: 92 },
  { hour: 8, count: 145 },
  { hour: 9, count: 178 },
  { hour: 10, count: 165 },
  { hour: 11, count: 142 },
  { hour: 12, count: 138 },
  { hour: 13, count: 152 },
  { hour: 14, count: 168 },
  { hour: 15, count: 182 },
  { hour: 16, count: 198 },
  { hour: 17, count: 215 },
  { hour: 18, count: 248 },
  { hour: 19, count: 275 },
  { hour: 20, count: 268 },
  { hour: 21, count: 232 },
  { hour: 22, count: 168 },
  { hour: 23, count: 98 },
];

export const DEMO_TOTAL_PLAYS = 12_847;
export const DEMO_TOTAL_HOURS_LISTENED = 423;

// =================================================================
// Detail-level helpers : synthesize per-entity stats from base fixtures
// for the demo mode on /track/[id], /artist/[id], /album/[id] pages.
// All synthesis is deterministic (seeded by entity ID) so the same demo
// entity always shows the same stats across renders.
// =================================================================

/**
 * Returns true if the given ID starts with "demo:" — used by detail pages
 * to detect when to render demo data instead of querying the real DB.
 */
export function isDemoId(id: string): boolean {
  return id.startsWith("demo:");
}

function seedFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function synthesizeFirstLastDates(seed: number): {
  firstPlayedAt: Date;
  lastPlayedAt: Date;
} {
  const now = new Date();
  // First play between 6 and 24 months ago (deterministic from seed)
  const firstMonthsAgo = 6 + (seed % 18);
  const firstPlayedAt = new Date(
    now.getFullYear(),
    now.getMonth() - firstMonthsAgo,
    1 + (seed % 28),
  );
  // Last play within the last 14 days (deterministic from seed)
  const lastDaysAgo = (seed % 14) + 1;
  const lastPlayedAt = new Date(
    now.getTime() - lastDaysAgo * 24 * 60 * 60 * 1000,
  );
  return { firstPlayedAt, lastPlayedAt };
}

function synthesizePeriodBreakdown(
  totalPlays: number,
): Record<"4w" | "6m" | "1y" | "all", number> {
  return {
    "4w": Math.round(totalPlays * 0.08),
    "6m": Math.round(totalPlays * 0.3),
    "1y": Math.round(totalPlays * 0.75),
    all: totalPlays,
  };
}

function synthesizeMonthlyPlays(
  totalPlays: number,
): { month: Date; plays: number }[] {
  // 18 months ago to now, with a bell-shaped distribution centered on month 12
  // (= 6 months ago). Plays sum approximately to totalPlays.
  const result: { month: Date; plays: number }[] = [];
  const now = new Date();
  const months = 18;
  const weights: number[] = [];
  for (let i = 0; i < months; i++) {
    const x = (i - 12) / 4;
    weights.push(Math.exp((-x * x) / 2));
  }
  const weightSum = weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < months; i++) {
    const month = new Date(
      now.getFullYear(),
      now.getMonth() - (months - 1 - i),
      1,
    );
    const plays = Math.max(1, Math.round((weights[i] / weightSum) * totalPlays));
    result.push({ month, plays });
  }
  return result;
}

function synthesizeHours(
  totalPlays: number,
): { hour: number; count: number }[] {
  // Scale DEMO_LISTENING_HOURS so it sums approximately to totalPlays
  const baseSum = DEMO_LISTENING_HOURS.reduce((a, b) => a + b.count, 0);
  const scale = totalPlays / baseSum;
  return DEMO_LISTENING_HOURS.map((h) => ({
    hour: h.hour,
    count: Math.max(0, Math.round(h.count * scale)),
  }));
}

function synthesizeQuality(seed: number): {
  avgMs: number;
  skipRate: number;
} {
  // avgMs : 180s to 220s (plausible track listen duration)
  const avgMs = 180_000 + ((seed * 7) % 40_000);
  // skipRate : 3% to 18% (plausible)
  const skipRate = 0.03 + ((seed % 15) / 100);
  return { avgMs, skipRate };
}

/**
 * Demo track detail : returns null if id isn't a known demo track,
 * otherwise the full shape needed by /track/[id] in demo mode.
 */
export function getDemoTrack(id: string): {
  track: (typeof DEMO_TOP_TRACKS)[number];
  stats: { count: number; firstPlayedAt: Date; lastPlayedAt: Date };
  breakdown: Record<"4w" | "6m" | "1y" | "all", number>;
  monthly: { month: Date; plays: number }[];
  hours: { hour: number; count: number }[];
  quality: { avgMs: number; skipRate: number };
} | null {
  if (!isDemoId(id)) return null;
  const track = DEMO_TOP_TRACKS.find((t) => t.trackId === id);
  if (!track) return null;
  const seed = seedFromString(id);
  return {
    track,
    stats: {
      count: track.plays,
      ...synthesizeFirstLastDates(seed),
    },
    breakdown: synthesizePeriodBreakdown(track.plays),
    monthly: synthesizeMonthlyPlays(track.plays),
    hours: synthesizeHours(track.plays),
    quality: synthesizeQuality(seed),
  };
}

/**
 * Demo artist detail : returns null if id isn't a known demo artist,
 * otherwise the artist + top tracks of that artist (filtered from
 * DEMO_TOP_TRACKS by name match).
 */
export function getDemoArtist(id: string): {
  artist: (typeof DEMO_TOP_ARTISTS)[number];
  stats: { count: number };
  topTracks: { trackId: string; trackName: string; playCount: number }[];
} | null {
  if (!isDemoId(id)) return null;
  const artist = DEMO_TOP_ARTISTS.find((a) => a.artistId === id);
  if (!artist) return null;
  const topTracks = DEMO_TOP_TRACKS.filter((t) =>
    t.artistNames.includes(artist.name),
  )
    .slice(0, 10)
    .map((t) => ({
      trackId: t.trackId,
      trackName: t.name,
      playCount: t.plays,
    }));
  return {
    artist,
    stats: { count: artist.plays },
    topTracks,
  };
}

/**
 * Demo album detail : returns null if id isn't a known demo album,
 * otherwise the full shape needed by /album/[id] in demo mode.
 * Tracks of the album = demo tracks by the same primary artist. If less
 * than 5, padded with synthetic entries.
 */
export function getDemoAlbum(id: string): {
  album: (typeof DEMO_TOP_ALBUMS)[number];
  stats: {
    count: number;
    firstPlayedAt: Date;
    lastPlayedAt: Date;
    totalMsPlayed: number;
  };
  tracks: {
    trackId: string;
    name: string;
    trackNumber: number;
    plays: number;
  }[];
  breakdown: Record<"4w" | "6m" | "1y" | "all", number>;
  monthly: { month: Date; plays: number }[];
  hours: { hour: number; count: number }[];
  quality: { avgMs: number; skipRate: number };
  otherAlbums: (typeof DEMO_TOP_ALBUMS)[number][];
} | null {
  if (!isDemoId(id)) return null;
  const album = DEMO_TOP_ALBUMS.find((a) => a.albumId === id);
  if (!album) return null;
  const seed = seedFromString(id);
  const albumArtist = album.artistNames[0];

  // Tracks of this album : DEMO_TOP_TRACKS by same primary artist
  const sourceTracks = DEMO_TOP_TRACKS.filter(
    (t) => t.artistNames[0] === albumArtist,
  ).slice(0, 12);

  const tracks: {
    trackId: string;
    name: string;
    trackNumber: number;
    plays: number;
  }[] = sourceTracks.map((t, i) => ({
    trackId: t.trackId,
    name: t.name,
    trackNumber: i + 1,
    plays: t.plays,
  }));

  // Pad to at least 5 entries with synthetic ones (deterministic from seed)
  while (tracks.length < 5) {
    const i = tracks.length;
    tracks.push({
      trackId: `${id}-track-${i}`,
      name: `Interlude ${i + 1}`,
      trackNumber: i + 1,
      plays: Math.max(1, Math.round(album.plays / 20)),
    });
  }

  const otherAlbums = DEMO_TOP_ALBUMS.filter(
    (a) => a.artistNames[0] === albumArtist && a.albumId !== id,
  ).slice(0, 6);

  return {
    album,
    stats: {
      count: album.plays,
      ...synthesizeFirstLastDates(seed),
      totalMsPlayed: album.plays * 200_000,
    },
    tracks,
    breakdown: synthesizePeriodBreakdown(album.plays),
    monthly: synthesizeMonthlyPlays(album.plays),
    hours: synthesizeHours(album.plays),
    quality: synthesizeQuality(seed),
    otherAlbums,
  };
}
