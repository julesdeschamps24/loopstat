import { Worker, type Job } from "bullmq";
import { log } from "@/lib/log";
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
  const wlog = log.child({ worker: "poll-recent", jobId: job.id });

  if (job.name === "fanout") {
    const result = await fanoutPolls();
    const duration = Date.now() - start;
    wlog.info({ enqueued: result.enqueued, ms: duration }, "fanout complete");
    return result;
  }

  // Default: per-user poll. Tolerates the historical job name (anything that
  // isn't "fanout") so jobs queued before this dispatch was introduced still
  // work.
  const { userId } = job.data as PollUserJobData;
  if (!userId) throw new Error(`job ${job.id}: missing userId in data`);

  const result = await pollUserRecentPlays(userId);
  const duration = Date.now() - start;
  wlog.info(
    { user: userId, inserted: result.inserted, ms: duration },
    "poll-recent complete",
  );
  return result;
}

// Import queue: one job kind, "import-history", payload { importId }. Parses an
// uploaded Spotify Extended Streaming History dump and batch-inserts streams.
async function processImportJob(job: Job): Promise<unknown> {
  const start = Date.now();
  const wlog = log.child({ worker: "import", jobId: job.id });
  const { importId } = job.data as ImportJobData;
  if (!importId) throw new Error(`job ${job.id}: missing importId in data`);

  const result = await importHistory(importId);
  const duration = Date.now() - start;
  wlog.info(
    { import: importId, rowsImported: result.rowsImported, ms: duration },
    "import complete",
  );
  return result;
}

// Enrich queue: one job kind, "enrich-metadata", payload { userId }. Backfills
// full track metadata for tracks importHistory inserted minimal.
async function processEnrichJob(job: Job): Promise<unknown> {
  const start = Date.now();
  const wlog = log.child({ worker: "enrich", jobId: job.id });
  const { userId } = job.data as EnrichJobData;
  if (!userId) throw new Error(`job ${job.id}: missing userId in data`);

  const result = await enrichMetadata(userId);
  const duration = Date.now() - start;
  wlog.info(
    { user: userId, enrichedCount: result.enrichedCount, ms: duration },
    "enrich complete",
  );
  return result;
}

const worker = new Worker(POLL_RECENT_QUEUE_NAME, processJob, {
  connection,
});

worker.on("ready", () => {
  log.info({ worker: "poll-recent" }, "worker ready");
});

worker.on("failed", (job, err) => {
  log.error(
    { worker: "poll-recent", jobId: job?.id ?? "?", err },
    "job failed",
  );
});

worker.on("error", (err) => {
  log.error({ worker: "poll-recent", err }, "worker error");
});

const importWorker = new Worker(IMPORT_QUEUE_NAME, processImportJob, {
  connection,
});

importWorker.on("ready", () => {
  log.info({ worker: "import" }, "worker ready");
});

importWorker.on("failed", (job, err) => {
  log.error({ worker: "import", jobId: job?.id ?? "?", err }, "job failed");
});

importWorker.on("error", (err) => {
  log.error({ worker: "import", err }, "worker error");
});

const enrichWorker = new Worker(ENRICH_QUEUE_NAME, processEnrichJob, {
  connection,
});

enrichWorker.on("ready", () => {
  log.info({ worker: "enrich" }, "worker ready");
});

enrichWorker.on("failed", (job, err) => {
  log.error({ worker: "enrich", jobId: job?.id ?? "?", err }, "job failed");
});

enrichWorker.on("error", (err) => {
  log.error({ worker: "enrich", err }, "worker error");
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
  log.info(
    {
      scheduler: POLL_RECENT_FANOUT_SCHEDULER_ID,
      intervalMinutes: POLL_RECENT_FANOUT_EVERY_MS / 60000,
    },
    "scheduler registered",
  );
}

void bootstrap().catch((err) => {
  log.error({ err }, "bootstrap failed");
  process.exit(1);
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info({ signal }, "shutting down");
  try {
    await worker.close();
    log.info({}, "poll-recent worker closed");
    await importWorker.close();
    log.info({}, "import worker closed");
    await enrichWorker.close();
    log.info({}, "enrich worker closed");
    await pollRecentQueue.close();
    log.info({}, "poll-recent queue closed");
    await importQueue.close();
    log.info({}, "import queue closed");
    await enrichQueue.close();
    log.info({}, "enrich queue closed");
    await connection.quit();
    log.info({}, "redis connection closed");
    process.exit(0);
  } catch (err) {
    log.error({ err }, "error during shutdown");
    process.exit(1);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
