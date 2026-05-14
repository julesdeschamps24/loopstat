import { Worker, type Job } from "bullmq";
import {
  ENRICH_QUEUE_NAME,
  IMPORT_QUEUE_NAME,
  POLL_RECENT_FANOUT_EVERY_MS,
  POLL_RECENT_FANOUT_SCHEDULER_ID,
  POLL_RECENT_QUEUE_NAME,
  connection,
  enrichQueue,
  importQueue,
  pollRecentQueue,
} from "./queue";
import { pollUserRecentPlays } from "./jobs/pollRecent";
import { fanoutPolls } from "./jobs/fanout";
import { importHistory } from "./jobs/importHistory";
import { enrichMetadata } from "./jobs/enrichMetadata";

interface PollUserJobData {
  userId: string;
}

interface ImportJobData {
  importId: string;
}

interface EnrichJobData {
  userId: string;
}

// poll-recent queue processor. Handles two job kinds, distinguished by
// `job.name`:
//   - "fanout"    — payload {}, fired by the repeatable scheduler. Selects
//                   eligible users and enqueues one "poll-user" per user.
//   - "poll-user" — payload { userId }, per-user Spotify poll.
// The import and enrich queues have their own processors below.
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

// Import queue: one job kind, "import-history", payload { importId }. Parses an
// uploaded Spotify Extended Streaming History dump and batch-inserts streams.
async function processImportJob(job: Job): Promise<unknown> {
  const start = Date.now();
  const { importId } = job.data as ImportJobData;
  if (!importId) throw new Error(`job ${job.id}: missing importId in data`);

  const result = await importHistory(importId);
  const duration = Date.now() - start;
  console.log(
    `[worker] import import=${importId} rowsImported=${result.rowsImported} ms=${duration}`,
  );
  return result;
}

// Enrich queue: one job kind, "enrich-metadata", payload { userId }. Backfills
// full track metadata for tracks importHistory inserted minimal.
async function processEnrichJob(job: Job): Promise<unknown> {
  const start = Date.now();
  const { userId } = job.data as EnrichJobData;
  if (!userId) throw new Error(`job ${job.id}: missing userId in data`);

  const result = await enrichMetadata(userId);
  const duration = Date.now() - start;
  console.log(
    `[worker] enrich user=${userId} enrichedCount=${result.enrichedCount} ms=${duration}`,
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
  console.error(`[worker] poll-recent job ${job?.id ?? "?"} failed:`, err);
});

worker.on("error", (err) => {
  console.error("[worker] worker error:", err);
});

const importWorker = new Worker(IMPORT_QUEUE_NAME, processImportJob, {
  connection,
});

importWorker.on("ready", () => {
  console.log("[worker] import worker ready");
});

importWorker.on("failed", (job, err) => {
  console.error(`[worker] import job ${job?.id ?? "?"} failed:`, err);
});

importWorker.on("error", (err) => {
  console.error("[worker] import worker error:", err);
});

const enrichWorker = new Worker(ENRICH_QUEUE_NAME, processEnrichJob, {
  connection,
});

enrichWorker.on("ready", () => {
  console.log("[worker] enrich worker ready");
});

enrichWorker.on("failed", (job, err) => {
  console.error(`[worker] enrich job ${job?.id ?? "?"} failed:`, err);
});

enrichWorker.on("error", (err) => {
  console.error("[worker] enrich worker error:", err);
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
    console.log("[worker] poll-recent worker closed");
    await importWorker.close();
    console.log("[worker] import worker closed");
    await enrichWorker.close();
    console.log("[worker] enrich worker closed");
    await pollRecentQueue.close();
    console.log("[worker] poll-recent queue closed");
    await importQueue.close();
    console.log("[worker] import queue closed");
    await enrichQueue.close();
    console.log("[worker] enrich queue closed");
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
