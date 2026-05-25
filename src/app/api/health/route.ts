import { sql } from "drizzle-orm";
import { Redis } from "ioredis";

import { db } from "@/db/client";

// Healthcheck used by Docker HEALTHCHECK + external uptime monitors.
// Pings Postgres + Redis. Returns 200 only if BOTH respond.
//
// SECURITY: read-only, no auth required, no sensitive data leaked.
export const dynamic = "force-dynamic";

const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

export async function GET(): Promise<Response> {
  const checks: Record<string, "ok" | string> = {};

  // Postgres : SELECT 1
  try {
    await db.execute(sql`SELECT 1`);
    checks.postgres = "ok";
  } catch (err) {
    checks.postgres = (err as Error)?.message ?? "fail";
  }

  // Redis : ephemeral client + PING (BullMQ shares it but we don't want
  // to depend on a worker module being imported by the web process).
  let redis: Redis | null = null;
  try {
    redis = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
    await redis.connect();
    const pong = await redis.ping();
    checks.redis = pong === "PONG" ? "ok" : `unexpected:${pong}`;
  } catch (err) {
    checks.redis = (err as Error)?.message ?? "fail";
  } finally {
    redis?.disconnect();
  }

  const allOk = Object.values(checks).every((v) => v === "ok");
  return Response.json(
    { status: allOk ? "ok" : "degraded", checks, ts: Date.now() },
    { status: allOk ? 200 : 503 },
  );
}
