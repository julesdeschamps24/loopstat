import { log } from "@/lib/log";
import { DeezerError } from "@/lib/deezer/client";

/**
 * Pacing partagé des jobs d'enrichissement Deezer.
 *
 * Un album = jusqu'à 2 appels (search + détails). Quota Deezer : 50 req/5 s.
 * 250 ms entre items ≈ 8 req/s max, marge incluse. (50 ms tenait le quota
 * instantané mais pas la charge soutenue : 403 après quelques centaines
 * d'items — vécu sur le premier import prod.)
 */
export const DEEZER_DELAY_MS = 250;

const QUOTA_PAUSE_MS = 65_000;
const MAX_QUOTA_RETRIES = 5;

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Exécute un appel d'enrichissement ; sur 403/429 Deezer, pause 65 s puis
 * reprend sur place (5 fois max) au lieu de faire échouer le job entier
 * (3 attempts BullMQ = sweep mort au 3e blocage).
 */
export async function withQuotaRetry<T>(
  fn: () => Promise<T>,
  wlog: ReturnType<typeof log.child>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err instanceof DeezerError ? err.status : null;
      if ((status === 403 || status === 429) && attempt < MAX_QUOTA_RETRIES) {
        wlog.warn(
          { status, attempt, pauseMs: QUOTA_PAUSE_MS },
          "quota Deezer atteint — pause puis reprise",
        );
        await sleep(QUOTA_PAUSE_MS);
        continue;
      }
      throw err;
    }
  }
}
