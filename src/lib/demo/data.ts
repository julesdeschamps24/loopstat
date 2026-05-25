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
  { trackId: "demo:espresso", name: "Espresso", artistNames: ["Sabrina Carpenter"], albumImageUrl: "https://dn721805.ca.archive.org/0/items/mbid-84190924-8e99-417e-9703-17b7722df4e7/mbid-84190924-8e99-417e-9703-17b7722df4e7-39023726455_thumb500.jpg", plays: 1247 },
  { trackId: "demo:birds-of-a-feather", name: "BIRDS OF A FEATHER", artistNames: ["Billie Eilish"], albumImageUrl: "https://dn721900.ca.archive.org/0/items/mbid-7b6c3a32-a629-49ce-8abf-9cad16e9e417/mbid-7b6c3a32-a629-49ce-8abf-9cad16e9e417-44950417016_thumb500.jpg", plays: 1180 },
  { trackId: "demo:beautiful-things", name: "Beautiful Things", artistNames: ["Benson Boone"], albumImageUrl: "https://dn720703.ca.archive.org/0/items/mbid-ef528afc-c3de-4b4a-8ef2-a0dd43dc9c83/mbid-ef528afc-c3de-4b4a-8ef2-a0dd43dc9c83-38443001081_thumb500.jpg", plays: 1102 },
  { trackId: "demo:lose-control", name: "Lose Control", artistNames: ["Teddy Swims"], albumImageUrl: "https://ia601700.us.archive.org/1/items/mbid-e68b78ac-a203-4e18-a0b3-12a5596886e1/mbid-e68b78ac-a203-4e18-a0b3-12a5596886e1-38138540270_thumb500.jpg", plays: 1043 },
  { trackId: "demo:bar-song-tipsy", name: "A Bar Song (Tipsy)", artistNames: ["Shaboozey"], albumImageUrl: "https://dn721800.ca.archive.org/0/items/mbid-0809d823-911b-4e89-833e-a6aacd817bf5/mbid-0809d823-911b-4e89-833e-a6aacd817bf5-39098226385_thumb500.jpg", plays: 987 },
  { trackId: "demo:fortnight", name: "Fortnight", artistNames: ["Taylor Swift", "Post Malone"], albumImageUrl: "https://dn721906.ca.archive.org/0/items/mbid-4b818e71-82b4-4950-959b-af7f3b6e1c88/mbid-4b818e71-82b4-4950-959b-af7f3b6e1c88-38637951302_thumb500.jpg", plays: 936 },
  { trackId: "demo:houdini", name: "Houdini", artistNames: ["Eminem"], albumImageUrl: "https://dn721600.ca.archive.org/0/items/mbid-7aa8bb8f-4fcb-49c6-9eb8-e882ab4c1afb/mbid-7aa8bb8f-4fcb-49c6-9eb8-e882ab4c1afb-39326923014_thumb500.jpg", plays: 892 },
  { trackId: "demo:cruel-summer", name: "Cruel Summer", artistNames: ["Taylor Swift"], albumImageUrl: "https://dn710707.ca.archive.org/0/items/mbid-6dcf9553-0f40-4244-8ade-032eb606232b/mbid-6dcf9553-0f40-4244-8ade-032eb606232b-24936821733_thumb500.jpg", plays: 854 },
  { trackId: "demo:please-please-please", name: "Please Please Please", artistNames: ["Sabrina Carpenter"], albumImageUrl: "https://dn721805.ca.archive.org/0/items/mbid-84190924-8e99-417e-9703-17b7722df4e7/mbid-84190924-8e99-417e-9703-17b7722df4e7-39023726455_thumb500.jpg", plays: 821 },
  { trackId: "demo:texas-hold-em", name: "Texas Hold 'Em", artistNames: ["Beyoncé"], albumImageUrl: "https://dn721903.ca.archive.org/0/items/mbid-952c9ce2-965b-48fb-89b1-5e0b0c87ddcc/mbid-952c9ce2-965b-48fb-89b1-5e0b0c87ddcc-38339165653_thumb500.jpg", plays: 789 },
  { trackId: "demo:i-had-some-help", name: "I Had Some Help", artistNames: ["Post Malone", "Morgan Wallen"], albumImageUrl: "https://dn721801.ca.archive.org/0/items/mbid-a0240f06-25ba-4638-b2fb-5f22d728a8cb/mbid-a0240f06-25ba-4638-b2fb-5f22d728a8cb-39140314956_thumb500.jpg", plays: 754 },
  { trackId: "demo:stick-season", name: "Stick Season", artistNames: ["Noah Kahan"], albumImageUrl: "https://dn710202.ca.archive.org/0/items/mbid-c1487d04-0b40-47fd-be10-6bd6dbab494a/mbid-c1487d04-0b40-47fd-be10-6bd6dbab494a-33313554305_thumb500.jpg", plays: 723 },
  { trackId: "demo:million-dollar-baby", name: "Million Dollar Baby", artistNames: ["Tommy Richman"], albumImageUrl: "https://dn721805.ca.archive.org/0/items/mbid-48510e76-3985-4c0d-8ee0-4eff139e84d9/mbid-48510e76-3985-4c0d-8ee0-4eff139e84d9-38708167357_thumb500.jpg", plays: 691 },
  { trackId: "demo:end-of-beginning", name: "End of Beginning", artistNames: ["Djo"], albumImageUrl: "https://dn710106.ca.archive.org/0/items/mbid-41bb52a3-7882-49a6-8b6a-1bad5d5f4fb9/mbid-41bb52a3-7882-49a6-8b6a-1bad5d5f4fb9-42379182591_thumb500.jpg", plays: 658 },
  { trackId: "demo:taste", name: "Taste", artistNames: ["Sabrina Carpenter"], albumImageUrl: "https://dn721805.ca.archive.org/0/items/mbid-84190924-8e99-417e-9703-17b7722df4e7/mbid-84190924-8e99-417e-9703-17b7722df4e7-39023726455_thumb500.jpg", plays: 627 },
  { trackId: "demo:di-mi-nombre", name: "Di Mi Nombre", artistNames: ["Rosalía"], albumImageUrl: "https://dn711409.ca.archive.org/0/items/mbid-ce7591dd-625d-4697-90f1-57245b08e206/mbid-ce7591dd-625d-4697-90f1-57245b08e206-21382135350_thumb500.jpg", plays: 595 },
  { trackId: "demo:not-like-us", name: "Not Like Us", artistNames: ["Kendrick Lamar"], albumImageUrl: "https://dn710000.ca.archive.org/0/items/mbid-de74b543-fb5b-4c35-8530-efb277f5cad1/mbid-de74b543-fb5b-4c35-8530-efb277f5cad1-38736205358_thumb500.jpg", plays: 568 },
  { trackId: "demo:greedy", name: "Greedy", artistNames: ["Tate McRae"], albumImageUrl: "https://dn710207.ca.archive.org/0/items/mbid-a25edac1-488f-46db-b91a-128706957dbc/mbid-a25edac1-488f-46db-b91a-128706957dbc-37446905462_thumb500.jpg", plays: 539 },
  { trackId: "demo:we-cant-be-friends", name: "We Can't Be Friends (Wait for Your Love)", artistNames: ["Ariana Grande"], albumImageUrl: "https://dn710004.ca.archive.org/0/items/mbid-b698a00e-bcef-4a1d-a243-c6d7940890b1/mbid-b698a00e-bcef-4a1d-a243-c6d7940890b1-38238639635_thumb500.jpg", plays: 512 },
  { trackId: "demo:lovin-on-me", name: "Lovin On Me", artistNames: ["Jack Harlow"], albumImageUrl: "https://dn721806.ca.archive.org/0/items/mbid-b178a896-d24f-4c47-85be-41c5e9b7af08/mbid-b178a896-d24f-4c47-85be-41c5e9b7af08-35515793531_thumb500.jpg", plays: 487 },
  { trackId: "demo:good-luck-babe", name: "Good Luck, Babe!", artistNames: ["Chappell Roan"], albumImageUrl: "https://ia600500.us.archive.org/34/items/mbid-19febf01-a08f-4504-9930-ab37dab30c73/mbid-19febf01-a08f-4504-9930-ab37dab30c73-36903536316_thumb500.jpg", plays: 459 },
  { trackId: "demo:training-season", name: "Training Season", artistNames: ["Dua Lipa"], albumImageUrl: "https://ia601006.us.archive.org/7/items/mbid-840ed0ea-029a-4ecb-82b3-1b484c71b42b/mbid-840ed0ea-029a-4ecb-82b3-1b484c71b42b-38289613616_thumb500.jpg", plays: 432 },
  { trackId: "demo:water", name: "Water", artistNames: ["Tyla"], albumImageUrl: "https://dn710203.ca.archive.org/0/items/mbid-7c28a833-972c-4e30-b9d6-6f40286c28d8/mbid-7c28a833-972c-4e30-b9d6-6f40286c28d8-39593013157_thumb500.jpg", plays: 408 },
  { trackId: "demo:gata-only", name: "GATA ONLY", artistNames: ["FloyyMenor", "Cris MJ"], albumImageUrl: "https://dn721606.ca.archive.org/0/items/mbid-2b35177f-219b-4d47-ae50-9f0ab8f41215/mbid-2b35177f-219b-4d47-ae50-9f0ab8f41215-38395064256_thumb500.jpg", plays: 386 },
  { trackId: "demo:flowers", name: "Flowers", artistNames: ["Miley Cyrus"], albumImageUrl: "https://dn721601.ca.archive.org/0/items/mbid-9da68dab-0b3b-413a-9793-c11abff79408/mbid-9da68dab-0b3b-413a-9793-c11abff79408-34604231057_thumb500.jpg", plays: 362 },
  { trackId: "demo:agora-hills", name: "agora hills", artistNames: ["Doja Cat"], albumImageUrl: null, plays: 338 },
  { trackId: "demo:paint-the-town-red", name: "Paint The Town Red", artistNames: ["Doja Cat"], albumImageUrl: null, plays: 312 },
  { trackId: "demo:vampire", name: "vampire", artistNames: ["Olivia Rodrigo"], albumImageUrl: "https://dn710209.ca.archive.org/0/items/mbid-6da788ba-402d-41f6-aac4-bdd703817a79/mbid-6da788ba-402d-41f6-aac4-bdd703817a79-36057740540_thumb500.jpg", plays: 287 },
  { trackId: "demo:what-was-i-made-for", name: "What Was I Made For?", artistNames: ["Billie Eilish"], albumImageUrl: null, plays: 251 },
  { trackId: "demo:si-no-estas", name: "Si No Estás", artistNames: ["Iñigo Quintero"], albumImageUrl: "https://dn721603.ca.archive.org/0/items/mbid-6f41b0f6-3a8d-4bac-b802-5947c3971f05/mbid-6f41b0f6-3a8d-4bac-b802-5947c3971f05-36888971036_thumb500.jpg", plays: 214 },
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
  { albumId: "demo:short-n-sweet", name: "Short n' Sweet", artistNames: ["Sabrina Carpenter"], imageUrl: "https://dn721805.ca.archive.org/0/items/mbid-84190924-8e99-417e-9703-17b7722df4e7/mbid-84190924-8e99-417e-9703-17b7722df4e7-39023726455_thumb500.jpg", plays: 2068 },
  { albumId: "demo:tortured-poets", name: "The Tortured Poets Department", artistNames: ["Taylor Swift"], imageUrl: "https://dn721906.ca.archive.org/0/items/mbid-4b818e71-82b4-4950-959b-af7f3b6e1c88/mbid-4b818e71-82b4-4950-959b-af7f3b6e1c88-38637951302_thumb500.jpg", plays: 1790 },
  { albumId: "demo:hit-me-hard", name: "Hit Me Hard and Soft", artistNames: ["Billie Eilish"], imageUrl: "https://dn721900.ca.archive.org/0/items/mbid-7b6c3a32-a629-49ce-8abf-9cad16e9e417/mbid-7b6c3a32-a629-49ce-8abf-9cad16e9e417-44950417016_thumb500.jpg", plays: 1180 },
  { albumId: "demo:fireworks", name: "Fireworks & Rollerblades", artistNames: ["Benson Boone"], imageUrl: "https://dn720703.ca.archive.org/0/items/mbid-ef528afc-c3de-4b4a-8ef2-a0dd43dc9c83/mbid-ef528afc-c3de-4b4a-8ef2-a0dd43dc9c83-38443001081_thumb500.jpg", plays: 1102 },
  { albumId: "demo:i-tried-everything", name: "I've Tried Everything But Therapy", artistNames: ["Teddy Swims"], imageUrl: "https://ia601700.us.archive.org/1/items/mbid-e68b78ac-a203-4e18-a0b3-12a5596886e1/mbid-e68b78ac-a203-4e18-a0b3-12a5596886e1-38138540270_thumb500.jpg", plays: 1043 },
  { albumId: "demo:where-i-been", name: "Where I've Been, Isn't Where I'm Going", artistNames: ["Shaboozey"], imageUrl: "https://dn721800.ca.archive.org/0/items/mbid-0809d823-911b-4e89-833e-a6aacd817bf5/mbid-0809d823-911b-4e89-833e-a6aacd817bf5-39098226385_thumb500.jpg", plays: 987 },
  { albumId: "demo:f1-trillion", name: "F-1 Trillion", artistNames: ["Post Malone"], imageUrl: "https://dn721801.ca.archive.org/0/items/mbid-a0240f06-25ba-4638-b2fb-5f22d728a8cb/mbid-a0240f06-25ba-4638-b2fb-5f22d728a8cb-39140314956_thumb500.jpg", plays: 754 },
  { albumId: "demo:the-death-trick", name: "The Death of Slim Shady", artistNames: ["Eminem"], imageUrl: "https://dn721600.ca.archive.org/0/items/mbid-7aa8bb8f-4fcb-49c6-9eb8-e882ab4c1afb/mbid-7aa8bb8f-4fcb-49c6-9eb8-e882ab4c1afb-39326923014_thumb500.jpg", plays: 892 },
  { albumId: "demo:stick-season-album", name: "Stick Season", artistNames: ["Noah Kahan"], imageUrl: "https://dn710202.ca.archive.org/0/items/mbid-c1487d04-0b40-47fd-be10-6bd6dbab494a/mbid-c1487d04-0b40-47fd-be10-6bd6dbab494a-33313554305_thumb500.jpg", plays: 723 },
  { albumId: "demo:cowboy-carter", name: "Cowboy Carter", artistNames: ["Beyoncé"], imageUrl: "https://dn721903.ca.archive.org/0/items/mbid-952c9ce2-965b-48fb-89b1-5e0b0c87ddcc/mbid-952c9ce2-965b-48fb-89b1-5e0b0c87ddcc-38339165653_thumb500.jpg", plays: 789 },
  { albumId: "demo:eternal-sunshine", name: "eternal sunshine", artistNames: ["Ariana Grande"], imageUrl: "https://dn710004.ca.archive.org/0/items/mbid-b698a00e-bcef-4a1d-a243-c6d7940890b1/mbid-b698a00e-bcef-4a1d-a243-c6d7940890b1-38238639635_thumb500.jpg", plays: 512 },
  { albumId: "demo:rise-fall-rosie", name: "The Rise and Fall of a Midwest Princess", artistNames: ["Chappell Roan"], imageUrl: "https://ia600500.us.archive.org/34/items/mbid-19febf01-a08f-4504-9930-ab37dab30c73/mbid-19febf01-a08f-4504-9930-ab37dab30c73-36903536316_thumb500.jpg", plays: 459 },
  { albumId: "demo:radical-optimism", name: "Radical Optimism", artistNames: ["Dua Lipa"], imageUrl: "https://ia601006.us.archive.org/7/items/mbid-840ed0ea-029a-4ecb-82b3-1b484c71b42b/mbid-840ed0ea-029a-4ecb-82b3-1b484c71b42b-38289613616_thumb500.jpg", plays: 432 },
  { albumId: "demo:gnx", name: "GNX", artistNames: ["Kendrick Lamar"], imageUrl: "https://dn710105.ca.archive.org/0/items/mbid-ab97a501-5505-427a-b9cd-81e3e6c1085c/mbid-ab97a501-5505-427a-b9cd-81e3e6c1085c-40476627968_thumb500.jpg", plays: 568 },
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
  stats: {
    count: number;
    firstPlayedAt: Date;
    lastPlayedAt: Date;
  };
  topTracks: { trackId: string; trackName: string; albumImageUrl: string | null; playCount: number }[];
  topAlbums: { albumId: string; name: string; imageUrl: string | null; playCount: number }[];
  monthly: { month: Date; plays: number }[];
  related: { artistId: string; name: string; imageUrl: string | null; coCount: number }[];
  totalPercent: number;
} | null {
  if (!isDemoId(id)) return null;
  const artist = DEMO_TOP_ARTISTS.find((a) => a.artistId === id);
  if (!artist) return null;
  const seed = seedFromString(id);

  const topTracks = DEMO_TOP_TRACKS.filter((t) =>
    t.artistNames.includes(artist.name),
  )
    .slice(0, 20)
    .map((t) => ({
      trackId: t.trackId,
      trackName: t.name,
      albumImageUrl: t.albumImageUrl,
      playCount: t.plays,
    }));

  const topAlbums = DEMO_TOP_ALBUMS.filter(
    (a) => a.artistNames[0] === artist.name,
  )
    .slice(0, 10)
    .map((a) => ({
      albumId: a.albumId,
      name: a.name,
      imageUrl: a.imageUrl,
      playCount: a.plays,
    }));

  const related = DEMO_TOP_ARTISTS.filter((a) => a.artistId !== id)
    .slice(0, 5)
    .map((a) => ({
      artistId: a.artistId,
      name: a.name,
      imageUrl: a.imageUrl,
      coCount: Math.max(1, Math.round(a.plays / 10)),
    }));

  const dates = synthesizeFirstLastDates(seed);
  const monthly = synthesizeMonthlyPlays(artist.plays);
  const totalPercent = Math.max(1, Math.round((artist.plays / DEMO_TOTAL_PLAYS) * 100));

  return {
    artist,
    stats: {
      count: artist.plays,
      firstPlayedAt: dates.firstPlayedAt,
      lastPlayedAt: dates.lastPlayedAt,
    },
    topTracks,
    topAlbums,
    monthly,
    related,
    totalPercent,
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
