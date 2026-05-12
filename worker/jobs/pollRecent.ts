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
  cursorAfter: number | null;
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

  // Upsert catalog (tracks/artists/albums + junctions). Dedup by track.id is
  // handled inside the helper.
  const tracks = items.map((it) => it.track);
  await upsertCatalogFromTracks(tracks);

  // Build stream rows. The unique index (user_id, played_at, track_id) plus
  // insertStreams' onConflictDoNothing guarantees idempotency.
  const rows: NewStream[] = items.map((it) => ({
    userId,
    trackId: it.track.id,
    playedAt: new Date(it.played_at),
    msPlayed: it.track.duration_ms,
    source: "api",
  }));

  const inserted = await insertStreams(rows);

  // lastSyncedAt policy: we always bump to `now()` regardless of whether items
  // were returned. This reflects "we successfully polled at time X" rather
  // than "we have data up to X". Two reasons:
  //   1. Spotify's `after` filter is exclusive on played_at; bumping to now()
  //      avoids re-fetching items we've already seen on the next poll.
  //   2. On an empty response we still want to advance the cursor so we
  //      don't keep querying with a stale, very old `after` value forever.
  const now = new Date();
  await db
    .update(users)
    .set({ lastSyncedAt: now })
    .where(eq(users.id, userId));

  // cursorAfter: most recent played_at across items (ms epoch), or null.
  let cursorAfter: number | null = null;
  for (const it of items) {
    const t = new Date(it.played_at).getTime();
    if (cursorAfter === null || t > cursorAfter) cursorAfter = t;
  }

  return { inserted, cursorAfter };
}
