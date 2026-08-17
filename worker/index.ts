import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { Worker, type Job } from "bullmq";
import { and, eq, lt, or } from "drizzle-orm";
import { validateWorkerEnv } from "@/lib/env";

// Fail fast : crash au boot si DATABASE_URL/REDIS_URL manquent ou sont
// invalides, plutôt qu'une erreur cryptique au premier job.
validateWorkerEnv();

import { db } from "@/db/client";
import { imports } from "@/db/schema";
import { log } from "@/lib/log";
import {
  ENRICH_CATALOG_HOT_QUEUE_NAME,
  ENRICH_CATALOG_QUEUE_NAME,
  ENRICH_CATALOG_SELF_HEAL_EVERY_MS,
  ENRICH_CATALOG_SELF_HEAL_SCHEDULER_ID,
  ENRICH_CATALOG_SINGLE_QUEUE_NAME,
  IMPORT_QUEUE_NAME,
  connection,
  enrichCatalogQueue,
  importQueue,
} from "./queue";
import { importHistory } from "./jobs/importHistory";
import { enrichCatalog, selfHealEnrichCatalog } from "./jobs/enrichCatalog";
import { enrichCatalogPriority } from "./jobs/enrichCatalogPriority";
import { enrichCatalogSingle } from "./jobs/enrichCatalogSingle";
import { ImportJobData } from "./schemas";

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
  log.error({ worker: "import", msg: (err as Error)?.message, code: (err as { code?: string })?.code }, "worker error");
});

const enrichCatalogWorker = new Worker(
  ENRICH_CATALOG_QUEUE_NAME,
  async (job) => {
    if (job.name === "enrich-catalog-self-heal-tick") {
      return selfHealEnrichCatalog();
    }
    return enrichCatalog();
  },
  { connection, concurrency: 1 },
);

enrichCatalogWorker.on("ready", () => {
  log.info({ worker: "enrich-catalog" }, "worker ready");
});

enrichCatalogWorker.on("failed", (job, err) => {
  log.error(
    { worker: "enrich-catalog", jobId: job?.id ?? "?", err },
    "job failed",
  );
});

enrichCatalogWorker.on("error", (err) => {
  log.error({ worker: "enrich-catalog", msg: (err as Error)?.message, code: (err as { code?: string })?.code }, "worker error");
});

const enrichCatalogHotWorker = new Worker(
  ENRICH_CATALOG_HOT_QUEUE_NAME,
  async (job) => {
    return enrichCatalogPriority(job.data);
  },
  { connection, concurrency: 2 },
);

enrichCatalogHotWorker.on("ready", () => {
  log.info({ worker: ENRICH_CATALOG_HOT_QUEUE_NAME }, "worker ready");
});

enrichCatalogHotWorker.on("failed", (job, err) => {
  log.error(
    { worker: ENRICH_CATALOG_HOT_QUEUE_NAME, jobId: job?.id ?? "?", err },
    "job failed",
  );
});

enrichCatalogHotWorker.on("error", (err) => {
  log.error({ worker: ENRICH_CATALOG_HOT_QUEUE_NAME, msg: (err as Error)?.message, code: (err as { code?: string })?.code }, "worker error");
});

const enrichCatalogSingleWorker = new Worker(
  ENRICH_CATALOG_SINGLE_QUEUE_NAME,
  async (job) => {
    return enrichCatalogSingle(job.data);
  },
  { connection, concurrency: 1 },
);

enrichCatalogSingleWorker.on("ready", () => {
  log.info({ worker: ENRICH_CATALOG_SINGLE_QUEUE_NAME }, "worker ready");
});

enrichCatalogSingleWorker.on("failed", (job, err) => {
  log.error(
    { worker: ENRICH_CATALOG_SINGLE_QUEUE_NAME, jobId: job?.id ?? "?", err },
    "job failed",
  );
});

enrichCatalogSingleWorker.on("error", (err) => {
  log.error({ worker: ENRICH_CATALOG_SINGLE_QUEUE_NAME, msg: (err as Error)?.message, code: (err as { code?: string })?.code }, "worker error");
});

// Register the repeatable self-heal scheduler. `upsertJobScheduler` is
// idempotent across restarts: same id + same opts is a no-op, so it's safe
// to call on every boot.
async function bootstrap(): Promise<void> {
  await sweepStaleImports();

  await enrichCatalogQueue.upsertJobScheduler(
    ENRICH_CATALOG_SELF_HEAL_SCHEDULER_ID,
    { every: ENRICH_CATALOG_SELF_HEAL_EVERY_MS },
    {
      name: "enrich-catalog-self-heal-tick",
      data: {},
    },
  );
  log.info(
    {
      scheduler: ENRICH_CATALOG_SELF_HEAL_SCHEDULER_ID,
      intervalMinutes: ENRICH_CATALOG_SELF_HEAL_EVERY_MS / 60000,
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
    await importWorker.close();
    log.info({}, "import worker closed");
    await enrichCatalogWorker.close();
    log.info({}, "enrich-catalog worker closed");
    await importQueue.close();
    log.info({}, "import queue closed");
    await enrichCatalogQueue.close();
    log.info({}, "enrich-catalog queue closed");
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
