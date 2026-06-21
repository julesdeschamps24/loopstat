export type LandingCover = { src: string; tilt: string; dur: string; delay: string };
export type LandingRow = { rank: number; src: string; title: string; artist: string };

// Mini-dashboard "Top titres" rows (demo top-3) — covers baked in public/landing/.
export const LANDING_ROWS: LandingRow[] = [
  { rank: 1, src: "/landing/cover-espresso.jpg", title: "Espresso", artist: "Sabrina Carpenter" },
  { rank: 2, src: "/landing/cover-birds.jpg", title: "BIRDS OF A FEATHER", artist: "Billie Eilish" },
  { rank: 3, src: "/landing/cover-beautiful.jpg", title: "Beautiful Things", artist: "Benson Boone" },
];

// Loose album covers that float around the dashboard card.
export const LANDING_FLOATING_COVERS: LandingCover[] = [
  { src: "/landing/cover-fortnight.jpg", tilt: "8deg", dur: "6.6s", delay: "0.5s" },
  { src: "/landing/cover-houdini.jpg", tilt: "-9deg", dur: "7.6s", delay: "1s" },
  { src: "/landing/cover-texas.jpg", tilt: "5deg", dur: "8.2s", delay: "0.2s" },
];
