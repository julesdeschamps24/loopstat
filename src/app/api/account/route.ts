import { eq } from "drizzle-orm";

import { auth, signOut } from "@/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { log } from "@/lib/log";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

// Mutates server state (deletes the user + cascades) and depends on the
// session cookie — never cache.
export const dynamic = "force-dynamic";

export async function DELETE(): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const wlog = log.child({ route: "api/account", userId });

  const rl = checkRateLimit(`account:${userId}`, 1, 3_600_000);
  if (!rl.ok) {
    wlog.warn({ retryAfterMs: rl.retryAfterMs }, "rate-limited");
    return rateLimitResponse(rl.retryAfterMs);
  }

  try {
    // All user-scoped FKs (streams, imports, top_cache) have ON DELETE CASCADE
    // on users.id, so a single delete cascades. Catalog tables (tracks,
    // artists, albums, track_artists, album_artists) are shared across users
    // and intentionally preserved.
    await db.transaction(async (tx) => {
      await tx.delete(users).where(eq(users.id, userId));
    });
  } catch (err) {
    wlog.error({ err }, "delete failed");
    return Response.json({ error: "delete_failed" }, { status: 500 });
  }

  try {
    // Invalidate the JWT session cookie server-side. NextAuth v5 supports
    // `redirect: false` inside a route handler; the client will redirect
    // itself after a 200 response.
    await signOut({ redirect: false });
  } catch (err) {
    wlog.error({ err }, "signOut after delete failed");
    // The row is already gone — surface success anyway; the stale cookie
    // will resolve to an unauthenticated session on the next request.
  }

  return Response.json({ ok: true });
}
