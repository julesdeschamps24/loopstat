import { Worker, type Job } from "bullmq";
import {
  POLL_RECENT_QUEUE_NAME,
  connection,
  pollRecentQueue,
} from "./queue";

// Placeholder processor — real job logic comes in Phase 3 Task 2.
async function processPollRecent(job: Job): Promise<void> {
  console.log(`[worker] job received: ${job.name}`, job.data);
}

const worker = new Worker(POLL_RECENT_QUEUE_NAME, processPollRecent, {
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
