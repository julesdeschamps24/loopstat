import { and, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { pollRecentQueue } from "../queue";

export interface FanoutResult {
  enqueued: number;
}

// Users are eligible for a poll when:
//   - they are not soft-deleted (deleted_at IS NULL), AND
//   - they have never been synced (last_synced_at IS NULL),
//     OR their last sync is older than 25 minutes.
// The 25-minute threshold (vs the 30-minute schedule period) leaves a small
// margin so that a user who was just barely missed last tick still gets
// picked up on the next one.
export async function fanoutPolls(): Promise<FanoutResult> {
  const twentyFiveMinAgo = new Date(Date.now() - 25 * 60 * 1000);

  const eligible = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        isNull(users.deletedAt),
        or(
          isNull(users.lastSyncedAt),
          lt(users.lastSyncedAt, twentyFiveMinAgo),
        ),
      ),
    );

  if (eligible.length === 0) return { enqueued: 0 };

  await pollRecentQueue.addBulk(
    eligible.map((u) => ({
      name: "poll-user",
      data: { userId: u.id },
    })),
  );

  return { enqueued: eligible.length };
}
