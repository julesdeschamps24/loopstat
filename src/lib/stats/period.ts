/**
 * Time windows for local-DB stream aggregation. Decoupled from Spotify's
 * `time_range` (short/medium/long) because we now compute top tracks from
 * our own streams table — no 50-track limit, "all" is trivial.
 */
export const STREAM_PERIOD_VALUES = ["1w", "4w", "6m", "1y", "all"] as const;
export type StreamPeriod = (typeof STREAM_PERIOD_VALUES)[number];

export const STREAM_PERIODS: { value: StreamPeriod; label: string }[] = [
  { value: "1w", label: "1 semaine" },
  { value: "4w", label: "4 semaines" },
  { value: "6m", label: "6 mois" },
  { value: "1y", label: "1 an" },
  { value: "all", label: "Tout" },
];

const DAY_MS = 86_400_000;

export function periodSince(p: StreamPeriod, ref: Date = new Date()): Date | null {
  const refMs = ref.getTime();
  switch (p) {
    case "1w":
      return new Date(refMs - 7 * DAY_MS);
    case "4w":
      return new Date(refMs - 28 * DAY_MS);
    case "6m":
      return new Date(refMs - 182 * DAY_MS);
    case "1y":
      return new Date(refMs - 365 * DAY_MS);
    case "all":
      return null;
  }
}

export function isStreamPeriod(v: unknown): v is StreamPeriod {
  return v === "1w" || v === "4w" || v === "6m" || v === "1y" || v === "all";
}
