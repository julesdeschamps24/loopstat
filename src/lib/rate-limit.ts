/**
 * In-memory rate limiter.
 *
 * Single-process only. For multi-process / serverless, swap impl for
 * `@upstash/ratelimit` or `@vercel/kv`.
 */

type Bucket = { count: number; windowStart: number };

interface CheckResult {
  ok: boolean;
  retryAfterMs: number;
}

// Share the buckets Map across HMR reloads in dev - same pattern as the
// BullMQ queue / Redis connection caching in worker/queue.ts.
const BUCKETS_KEY = Symbol.for("loopstat.rate-limit");
type GlobalWithBuckets = typeof globalThis & {
  [BUCKETS_KEY]?: Map<string, Bucket>;
};
const g = globalThis as GlobalWithBuckets;
const buckets: Map<string, Bucket> = (g[BUCKETS_KEY] ??= new Map<
  string,
  Bucket
>());

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): CheckResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { ok: true, retryAfterMs: 0 };
  }

  bucket.count += 1;
  if (bucket.count <= limit) {
    return { ok: true, retryAfterMs: 0 };
  }
  return { ok: false, retryAfterMs: windowMs - (now - bucket.windowStart) };
}

/**
 * Client IP from proxy headers (Caddy sets X-Forwarded-For with the real
 * client IP). Falls back to "unknown" - the rate limit then agrège tous les
 * clients sans IP dans un seul bucket, ce qui reste protecteur.
 */
export function clientIpFromHeaders(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip") ?? "unknown";
}

export function rateLimitResponse(retryAfterMs: number): Response {
  return Response.json(
    { error: "rate_limited" },
    {
      status: 429,
      headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() },
    },
  );
}
