export type LandingRow = { rank: number; src: string; title: string; artist: string };

export type Floater = {
  src: string;
  round?: boolean;
  size: number;
  left: string;
  top: string;
  tilt: string;
  amp: string;
  dur: string;
  delay: string;
  hideMobile?: boolean;
};

// Mini-dashboard "Top titres" rows (demo top-3) - covers baked in public/landing/.
export const LANDING_ROWS: LandingRow[] = [
  { rank: 1, src: "/landing/cover-espresso.jpg", title: "Espresso", artist: "Sabrina Carpenter" },
  { rank: 2, src: "/landing/cover-birds.jpg", title: "BIRDS OF A FEATHER", artist: "Billie Eilish" },
  { rank: 3, src: "/landing/cover-beautiful.jpg", title: "Beautiful Things", artist: "Benson Boone" },
];

// Album covers + the artist avatar that float around the cluster. Positions are
// percentages within the cluster box; spread to fill the right half of the hero.
export const LANDING_FLOATERS: Floater[] = [
  { src: "/landing/artist-dualipa.jpg", round: true, size: 66, left: "8%", top: "12%", tilt: "0deg", amp: "-10px", dur: "6s", delay: "0.8s" },
  { src: "/landing/cover-fortnight.jpg", size: 68, left: "24%", top: "64%", tilt: "8deg", amp: "-9px", dur: "5.4s", delay: "0.5s" },
  { src: "/landing/cover-texas.jpg", size: 58, left: "52%", top: "30%", tilt: "6deg", amp: "-8px", dur: "5.8s", delay: "0.2s", hideMobile: true },
  { src: "/landing/cover-houdini.jpg", size: 62, left: "66%", top: "70%", tilt: "-9deg", amp: "-9px", dur: "6.2s", delay: "1s", hideMobile: true },
];
