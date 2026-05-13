import { Worker, type Job } from "bullmq";
import {
  POLL_RECENT_FANOUT_EVERY_MS,
  POLL_RECENT_FANOUT_SCHEDULER_ID,
  POLL_RECENT_QUEUE_NAME,
  connection,
  pollRecentQueue,
} from "./queue";
import { pollUserRecentPlays } from "./jobs/pollRecent";
import { fanoutPolls } from "./jobs/fanout";

interface PollUserJobData {
  userId: string;
}

// The queue carries two job kinds, distinguished by `job.name`:
//   - "fanout"    — payload {}, fired by the repeatable scheduler. Selects
//                   eligible users and enqueues one "poll-user" per user.
//   - "poll-user" — payload { userId }, per-user Spotify poll.
async function processJob(job: Job): Promise<unknown> {
  const start = Date.now();

  if (job.name === "fanout") {
    const result = await fanoutPolls();
    const duration = Date.now() - start;
    console.log(
      `[worker] fanout enqueued=${result.enqueued} ms=${duration}`,
    );
    return result;
  }

  // Default: per-user poll. Tolerates the historical job name (anything that
  // isn't "fanout") so jobs queued before this dispatch was introduced still
  // work.
  const { userId } = job.data as PollUserJobData;
  if (!userId) throw new Error(`job ${job.id}: missing userId in data`);

  const result = await pollUserRecentPlays(userId);
  const duration = Date.now() - start;
  console.log(
    `[worker] poll-recent user=${userId} inserted=${result.inserted} ms=${duration}`,
  );
  return result;
}

const worker = new Worker(POLL_RECENT_QUEUE_NAME, processJob, {
  connection,
});

worker.on("ready", () => {
  console.log("[worker] poll-recent worker ready");
});

worker.on("failed", (job, err) => {
  console.error(`[worker] job ${job?.id ?? "?"} failed:`, err);
});

worker.on("error", (err) => {
  console.error("[worker] worker error:", err);
});

// Register the repeatable fanout scheduler. `upsertJobScheduler` is idempotent
// across restarts: same id + same opts is a no-op, so it's safe to call on
// every boot.
async function bootstrap(): Promise<void> {
  await pollRecentQueue.upsertJobScheduler(
    POLL_RECENT_FANOUT_SCHEDULER_ID,
    { every: POLL_RECENT_FANOUT_EVERY_MS },
    { name: "fanout", data: {} },
  );
  console.log(
    `[worker] scheduler registered: ${POLL_RECENT_FANOUT_SCHEDULER_ID} every ${POLL_RECENT_FANOUT_EVERY_MS / 60000}m`,
  );
}

void bootstrap().catch((err) => {
  console.error("[worker] bootstrap failed:", err);
  process.exit(1);
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[worker] received ${signal}, shutting down...`);
  try {
    await worker.close();
    console.log("[worker] worker closed");
    await pollRecentQueue.close();
    console.log("[worker] queue closed");
    await connection.quit();
    console.log("[worker] redis connection closed");
    process.exit(0);
  } catch (err) {
    console.error("[worker] error during shutdown:", err);
    process.exit(1);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
