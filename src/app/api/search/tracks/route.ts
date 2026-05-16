import { auth } from "@/auth";
import { searchTracks } from "@/db/queries/stats";
import { log } from "@/lib/log";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

// User-scoped DB lookup, never cacheable.
export const dynamic = "force-dynamic";

const MIN_QUERY_LEN = 2;
const MAX_QUERY_LEN = 50;
const RESULT_LIMIT = 10;

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const wlog = log.child({ route: "api/search/tracks", userId });

  // 30 requêtes/min : un user qui tape vite en debounce 300 ms n'atteindra
  // jamais ce seuil ; coupe les scripts/abus.
  const rl = checkRateLimit(`search:${userId}`, 30, 60_000);
  if (!rl.ok) {
    wlog.warn({ retryAfterMs: rl.retryAfterMs }, "rate-limited");
    return rateLimitResponse(rl.retryAfterMs);
  }

  const url = new URL(request.url);
  const raw = url.searchParams.get("q") ?? "";
  const query = raw.trim();

  if (query.length < MIN_QUERY_LEN) {
    return Response.json({ results: [] }, { status: 200 });
  }
  if (query.length > MAX_QUERY_LEN) {
    return Response.json({ error: "query_too_long" }, { status: 400 });
  }

  const results = await searchTracks(userId, query, RESULT_LIMIT);
  return Response.json({ results }, { status: 200 });
}
