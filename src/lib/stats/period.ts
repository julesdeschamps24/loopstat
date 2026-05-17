/**
 * Time windows for local-DB stream aggregation. Decoupled from Spotify's
 * `time_range` (short/medium/long) because we now compute top tracks from
 * our own streams table — no 50-track limit, "all" is trivial.
 */
export const STREAM_PERIOD_VALUES = ["4w", "6m", "1y", "all"] as const;
export type StreamPeriod = (typeof STREAM_PERIOD_VALUES)[number];

export const STREAM_PERIODS: { value: StreamPeriod; label: string }[] = [
  { value: "4w", label: "4 semaines" },
  { value: "6m", label: "6 mois" },
  { value: "1y", label: "1 an" },
  { value: "all", label: "Tout" },
];

const DAY_MS = 86_400_000;

export function periodSince(p: StreamPeriod): Date | null {
  const now = Date.now();
  switch (p) {
    case "4w":
      return new Date(now - 28 * DAY_MS);
    case "6m":
      return new Date(now - 182 * DAY_MS);
    case "1y":
      return new Date(now - 365 * DAY_MS);
    case "all":
      return null;
  }
}

export function isStreamPeriod(v: unknown): v is StreamPeriod {
  return v === "4w" || v === "6m" || v === "1y" || v === "all";
}
