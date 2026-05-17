export const BACKGROUNDS = ["mesh", "wall", "noir", "mauve"] as const;
export const ACCENTS = [
  "violet",
  "blue",
  "rose",
  "green",
  "orange",
  "mono",
] as const;

export type Background = (typeof BACKGROUNDS)[number];
export type Accent = (typeof ACCENTS)[number];

export const ACCENT_HEX: Record<Accent, string> = {
  violet: "#7c3aed",
  blue: "#3b82f6",
  rose: "#ec4899",
  green: "#10b981",
  orange: "#f59e0b",
  mono: "#fafafa",
};

export const BACKGROUND_LABELS: Record<Background, string> = {
  mesh: "Nébuleuse (default)",
  wall: "Mur de pochettes",
  noir: "Noir profond",
  mauve: "Mauve sombre",
};

export function isBackground(v: unknown): v is Background {
  return typeof v === "string" && (BACKGROUNDS as readonly string[]).includes(v);
}

export function isAccent(v: unknown): v is Accent {
  return typeof v === "string" && (ACCENTS as readonly string[]).includes(v);
}
