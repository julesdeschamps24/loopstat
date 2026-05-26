import { auth } from "@/auth";
import { getRedis } from "@/lib/redis";
import { enrichCatalogSingleQueue } from "../../../../worker/queue";

export const dynamic = "force-dynamic";

const THROTTLE_TTL_SECONDS = 600;
const VALID_TYPES = new Set(["album", "artist"]);

interface Body {
  type?: string;
  id?: string;
}

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const { type, id } = body;
  if (!type || !id || typeof type !== "string" || typeof id !== "string") {
    return Response.json({ error: "missing_fields" }, { status: 400 });
  }
  if (!VALID_TYPES.has(type)) {
    return Response.json({ error: "invalid_type" }, { status: 400 });
  }

  // Redis NX guard : if the same (type, id) was enqueued within the TTL,
  // skip. Prevents a thundering-herd of enqueue requests when 50 users open
  // the same album page simultaneously.
  const redis = getRedis();
  const guardKey = `enrich:${type}:${id}`;
  const guard = await redis.set(guardKey, "1", "EX", THROTTLE_TTL_SECONDS, "NX");
  if (guard !== "OK") {
    return Response.json({ ok: true, skipped: true, reason: "throttled" });
  }

  await enrichCatalogSingleQueue.add(
    "enrich-single",
    { type, id },
    { jobId: `enrich-single:${type}:${id}` },
  );

  return Response.json({ ok: true });
}
