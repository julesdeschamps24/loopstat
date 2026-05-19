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
  { trackId: "demo:greedy-old", name: "What Was I Made For?", artistNames: ["Billie Eilish"], albumImageUrl: null, plays: 251 },
  { trackId: "demo:lovesick", name: "Si No Estás", artistNames: ["Iñigo Quintero"], albumImageUrl: null, plays: 214 },
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
