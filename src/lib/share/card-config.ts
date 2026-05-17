import { z } from "zod";
import {
  STREAM_PERIOD_VALUES,
  type StreamPeriod,
} from "@/lib/stats/period";

export const SHARE_MODES = ["focus", "recap"] as const;
export const SHARE_TYPES = ["tracks", "artists", "albums"] as const;
export { STREAM_PERIOD_VALUES as SHARE_PERIODS, type StreamPeriod as SharePeriod } from "@/lib/stats/period";

const SHARE_PERIODS = STREAM_PERIOD_VALUES;
export const SHARE_FORMATS = ["twitter", "post", "story"] as const;
export const SHARE_BACKGROUNDS = ["mesh", "wall"] as const;

export type ShareMode = (typeof SHARE_MODES)[number];
export type ShareType = (typeof SHARE_TYPES)[number];
export type ShareFormat = (typeof SHARE_FORMATS)[number];
export type ShareBackground = (typeof SHARE_BACKGROUNDS)[number];

export type ShareCardConfig = {
  mode: ShareMode;
  type: ShareType;
  n: number;
  period: StreamPeriod;
  format: ShareFormat;
  bg: ShareBackground;
};

export const SHARE_CARD_DEFAULTS: ShareCardConfig = {
  mode: "focus",
  type: "tracks",
  n: 5,
  period: "4w",
  format: "story",
  bg: "mesh",
};

// Matrice formats × N. Doit rester aligné avec la Section 2 du spec.
export const FORMAT_N_OPTIONS: Record<ShareFormat, readonly number[]> = {
  twitter: [3, 5],
  post: [3, 5, 7],
  story: [3, 5, 7, 10],
};

// Mode recap : N fixé par format (le contrôle utilisateur N est ignoré).
export const RECAP_N_BY_FORMAT: Record<ShareFormat, number> = {
  twitter: 3,
  post: 3,
  story: 5,
};

export type ShareContext = "dashboard" | "tracks" | "artists" | "albums";

export const CONTEXT_PRESETS: Record<ShareContext, Partial<ShareCardConfig>> = {
  dashboard: { mode: "recap", format: "story" },
  tracks: { mode: "focus", type: "tracks", format: "story" },
  artists: { mode: "focus", type: "artists", format: "story" },
  albums: { mode: "focus", type: "albums", format: "story" },
};

export function validForFormat(format: ShareFormat, n: number): boolean {
  return FORMAT_N_OPTIONS[format].includes(n);
}

export function clampNForFormat(format: ShareFormat, n: number): number {
  const options = FORMAT_N_OPTIONS[format];
  if (options.includes(n)) return n;
  if (n < options[0]) return options[0];
  return options[options.length - 1];
}

// Schema tolérant : applique les defaults sur chaque champ invalide
// plutôt que de throw. La page /share et la route API n'ont jamais à
// gérer d'exception ici — l'URL est toujours acceptée.
const fieldSchema = z.object({
  mode: z.enum(SHARE_MODES).catch(SHARE_CARD_DEFAULTS.mode),
  type: z.enum(SHARE_TYPES).catch(SHARE_CARD_DEFAULTS.type),
  n: z.coerce.number().int().positive().catch(SHARE_CARD_DEFAULTS.n),
  period: z.enum(SHARE_PERIODS).catch(SHARE_CARD_DEFAULTS.period),
  format: z.enum(SHARE_FORMATS).catch(SHARE_CARD_DEFAULTS.format),
  bg: z.enum(SHARE_BACKGROUNDS).catch(SHARE_CARD_DEFAULTS.bg),
});

type RawInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

function get(input: RawInput, key: string): string | undefined {
  if (input instanceof URLSearchParams) return input.get(key) ?? undefined;
  const v = input[key];
  if (Array.isArray(v)) return v[0];
  return v ?? undefined;
}

export function parseShareCardParams(input: RawInput): ShareCardConfig {
  const parsed = fieldSchema.parse({
    mode: get(input, "mode"),
    type: get(input, "type"),
    n: get(input, "n"),
    period: get(input, "period"),
    format: get(input, "format"),
    bg: get(input, "bg"),
  });
  return { ...parsed, n: clampNForFormat(parsed.format, parsed.n) };
}

export function buildShareCardUrl(
  cfg: ShareCardConfig,
  username: string,
): string {
  const sp = new URLSearchParams({
    username,
    mode: cfg.mode,
    type: cfg.type,
    n: String(cfg.n),
    period: cfg.period,
    format: cfg.format,
    bg: cfg.bg,
  });
  return `/api/share-card?${sp.toString()}`;
}
