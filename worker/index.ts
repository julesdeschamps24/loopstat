import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { Worker, type Job } from "bullmq";
import { and, eq, lt, or } from "drizzle-orm";
import { db } from "@/db/client";
import { imports } from "@/db/schema";
import { log } from "@/lib/log";
import {
  ENRICH_QUEUE_NAME,
  ENRICH_SELF_HEAL_EVERY_MS,
  ENRICH_SELF_HEAL_SCHEDULER_ID,
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
import { enrichMetadata, selfHealEnrich } from "./jobs/enrichMetadata";
import {
  PollUserJobData,
  ImportJobData,
  EnrichJobData,
} from "./schemas";

// Same layout as worker/jobs/importHistory.ts: <projectRoot>/.import-tmp/<importId>/.
const IMPORT_TMP_DIR = path.join(process.cwd(), ".import-tmp");

// Seuils différenciés par statut :
// - pending : BullMQ devrait pick-up en < 5 s. 1 h sans pickup = queue
//   cassée ou row créé pendant que le worker était down. Failed.
// - processing : un import de 150 k rows prend < 1 min. 6 h en
//   processing = worker crashé en cours. Failed.
const PENDING_TTL_MS = 60 * 60 * 1000;
const PROCESSING_TTL_MS = 6 * 60 * 60 * 1000;

// One-shot sweep run at worker boot to recover from a previous worker process
// that died mid-job. Two passes :
//   1) Mark stale `imports` rows as failed (TTLs above) so the UI stops
//      spinning on "Traitement en cours…" forever.
//   2) Remove leftover `.import-tmp/<id>/` directories whose `<id>` is not
//      currently associated with an active (pending/processing) import.
//      Covers both orphans (no row at all) and dirs left over by a previous
//      failed cleanup.
async function sweepStaleImports(): Promise<void> {
  const slog = log.child({ worker: "startup-sweep" });
  const now = Date.now();

  let markedFailedPending = 0;
  let markedFailedProcessing = 0;
  let tmpDirsRemoved = 0;

  try {
    const pendingCutoff = new Date(now - PENDING_TTL_MS);
    const processingCutoff = new Date(now - PROCESSING_TTL_MS);

    const stalePending = await db
      .update(imports)
      .set({
        status: "failed",
        errorMessage: "Stale import (no worker pickup within 1h)",
        completedAt: new Date(),
      })
      .where(
        and(
          eq(imports.status, "pending"),
          lt(imports.startedAt, pendingCutoff),
        ),
      )
      .returning({ id: imports.id });
    markedFailedPending = stalePending.length;

    const staleProcessing = await db
      .update(imports)
      .set({
        status: "failed",
        errorMessage: "Stale import (worker crashed mid-processing)",
        completedAt: new Date(),
      })
      .where(
        and(
          eq(imports.status, "processing"),
          lt(imports.startedAt, processingCutoff),
        ),
      )
      .returning({ id: imports.id });
    markedFailedProcessing = staleProcessing.length;
  } catch (err) {
    slog.warn({ err }, "DB cleanup failed (non-fatal)");
  }

  try {
    // readdir throws ENOENT si .import-tmp/ n'existe pas — état normal
    // si aucun import n'a tourné depuis le boot précédent.
    const dirs = await readdir(IMPORT_TMP_DIR).catch(() => [] as string[]);
    if (dirs.length > 0) {
      const active = await db
        .select({ id: imports.id })
        .from(imports)
        .where(
          or(
            eq(imports.status, "pending"),
            eq(imports.status, "processing"),
          ),
        );
      const activeIds = new Set(active.map((r) => r.id));

      for (const dir of dirs) {
        if (activeIds.has(dir)) continue;
        try {
          await rm(path.join(IMPORT_TMP_DIR, dir), {
            recursive: true,
            force: true,
          });
          tmpDirsRemoved += 1;
        } catch (err) {
          slog.warn({ dir, err }, "failed to remove stale tmp dir");
        }
      }
    }
  } catch (err) {
    slog.warn({ err }, "tmp dir cleanup failed (non-fatal)");
  }

  if (
    markedFailedPending > 0 ||
    markedFailedProcessing > 0 ||
    tmpDirsRemoved > 0
  ) {
    slog.info(
      { markedFailedPending, markedFailedProcessing, tmpDirsRemoved },
      "stale imports swept",
    );
  }
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
  const { userId } = PollUserJobData.parse(job.data);
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
  const { importId } = ImportJobData.parse(job.data);
  if (!importId) throw new Error(`job ${job.id}: missing importId in data`);

  const result = await importHistory(importId);
  const duration = Date.now() - start;
  wlog.info(
    { import: importId, rowsImported: result.rowsImported, ms: duration },
    "import complete",
  );
  return result;
}

// Enrich queue: two job kinds, distinguished by `job.name`:
//   - "enrich-metadata"   — payload { userId }. Backfills full track metadata
//                           for every track importHistory inserted minimal.
//   - "enrich-self-heal"  — payload {}, fired by the hourly scheduler. Checks
//                           if any un-enriched tracks remain and (if so)
//                           re-enqueues "enrich-metadata" with any user's
//                           Spotify creds, even if a previous attempt failed
//                           terminally. Guards against permanent catalog
//                           coverage loss.
async function processEnrichJob(job: Job): Promise<unknown> {
  const start = Date.now();
  const wlog = log.child({ worker: "enrich", jobId: job.id });

  if (job.name === "enrich-self-heal") {
    const result = await selfHealEnrich();
    const duration = Date.now() - start;
    wlog.info(
      { unenriched: result.unenrichedCount, enqueued: result.enqueued, ms: duration },
      "self-heal complete",
    );
    return result;
  }

  const { userId } = EnrichJobData.parse(job.data);
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
  await sweepStaleImports();
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

  await enrichQueue.upsertJobScheduler(
    ENRICH_SELF_HEAL_SCHEDULER_ID,
    { every: ENRICH_SELF_HEAL_EVERY_MS },
    { name: "enrich-self-heal", data: {} },
  );
  log.info(
    {
      scheduler: ENRICH_SELF_HEAL_SCHEDULER_ID,
      intervalMinutes: ENRICH_SELF_HEAL_EVERY_MS / 60000,
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
