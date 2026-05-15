import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, type NewStream } from "@/db/schema";
import { insertStreams } from "@/db/queries/streams";
import { spotifyFetch } from "@/lib/spotify/client";
import { upsertCatalogFromTracks } from "@/lib/spotify/catalog";
import type {
  SpotifyPagingCursor,
  SpotifyPlayHistoryItem,
} from "@/lib/spotify/types";

export interface PollRecentResult {
  inserted: number;
}

export async function pollUserRecentPlays(
  userId: string,
): Promise<PollRecentResult> {
  // Read the user's last sync cursor. We pass it as `after` (unix ms) to Spotify
  // so we only get plays newer than that timestamp.
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, lastSyncedAt: true },
  });
  if (!user) throw new Error(`No user ${userId}`);

  const afterMs = user.lastSyncedAt ? user.lastSyncedAt.getTime() : null;

  // /me/player/recently-played: limit max 50, `after` is unix ms (not seconds).
  // On first sync (no cursor), omit `after` and just fetch the latest 50.
  const qs = new URLSearchParams({ limit: "50" });
  if (afterMs !== null) qs.set("after", String(afterMs));

  const data = await spotifyFetch<SpotifyPagingCursor<SpotifyPlayHistoryItem>>(
    userId,
    `/me/player/recently-played?${qs.toString()}`,
  );

  const items = data.items ?? [];

  // Build stream rows up front. The unique index (user_id, played_at, track_id)
  // plus insertStreams' onConflictDoNothing guarantees idempotency.
  // Note: msPlayed is null here — Spotify's /me/player/recently-played does
  // not expose actual listening duration per stream. Leaving it null is
  // honest; downstream stats should treat null as "unknown".
  const tracks = items.map((it) => it.track);
  const rows: NewStream[] = items.map((it) => ({
    userId,
    trackId: it.track.id,
    playedAt: new Date(it.played_at),
    msPlayed: null,
    source: "api",
  }));

  // Wrap the three writes (catalog upsert, streams insert, users.lastSyncedAt
  // update) in a single transaction so a mid-flight failure rolls back cleanly
  // instead of leaving a partially-synced state.
  //
  // lastSyncedAt policy: we always bump to `now()` regardless of whether items
  // were returned. Two reasons:
  //   1. Advance on empty responses — if Spotify returns 0 items (user idle),
  //      we still need the cursor to move forward; otherwise future polls
  //      keep using a stale `after` value.
  //   2. Robustness against clock skew between this server and the timestamps
  //      Spotify attaches to plays.
  const inserted = await db.transaction(async (tx) => {
    await upsertCatalogFromTracks(tracks, tx);
    const insertedCount = await insertStreams(rows, tx);
    await tx
      .update(users)
      .set({ lastSyncedAt: new Date() })
      .where(eq(users.id, userId));
    return insertedCount;
  });

  return { inserted };
}
