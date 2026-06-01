import { STREAM_PERIOD_VALUES, type StreamPeriod } from "./period";

/**
 * Freemium tier-access policy. Pure functions only (no DB, no React) so they
 * are trivially testable and usable from any server component. Callers fetch
 * `isPremium(userId)` (src/db/queries/billing.ts) and pass the boolean here.
 *
 * Product rule (locked 2026-06-01): monetise depth/breadth, never basic access
 * to one's own data. Free keeps the impressive lifetime view (the viral hook);
 * Premium unlocks the shorter granularities + full lists.
 */

/** Periods a free (non-premium) user can access. Premium unlocks the rest. */
export const FREE_PERIODS = ["1y", "all"] as const satisfies readonly StreamPeriod[];

export const FREE_TOP_LIMIT = 10;
export const PREMIUM_TOP_LIMIT = 100;

export function isPeriodAllowed(period: StreamPeriod, premium: boolean): boolean {
  return premium || (FREE_PERIODS as readonly StreamPeriod[]).includes(period);
}

/**
 * Default period when the URL specifies none. Premium defaults to the most
 * recent window (1w); free defaults to lifetime ("all") — both the only
 * sensible default for free AND the most shareable view.
 */
export function defaultPeriod(premium: boolean): StreamPeriod {
  return premium ? "1w" : "all";
}

/** Clamp a requested period to one the user may access. Disallowed -> "all". */
export function resolvePeriod(requested: StreamPeriod, premium: boolean): StreamPeriod {
  return isPeriodAllowed(requested, premium) ? requested : "all";
}

/** Periods that exist but are locked for this user (premium -> none). */
export function lockedPeriods(premium: boolean): StreamPeriod[] {
  if (premium) return [];
  return STREAM_PERIOD_VALUES.filter((p) => !isPeriodAllowed(p, false));
}

/** How many rows a top list shows for this tier. */
export function topLimit(premium: boolean): number {
  return premium ? PREMIUM_TOP_LIMIT : FREE_TOP_LIMIT;
}
