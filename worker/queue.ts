import { Queue } from "bullmq";
import IORedis from "ioredis";

// During `next build`, Next 16 imports each route module to collect metadata
// (and some routes import this file via `importQueue`). Env vars aren't set
// then, and ioredis would otherwise try to connect at module-load. Use a
// placeholder URL + lazyConnect so the connection is deferred until the
// first real command - at runtime, docker-compose always provides REDIS_URL.
const redisUrl = process.env.REDIS_URL ?? "redis://placeholder:6379";

// Cache the connection + queue on globalThis so dev-mode HMR (Next.js / tsx watch)
// doesn't open a new Redis socket and a new BullMQ Queue on every module reload.
export const IMPORT_QUEUE_NAME = "import";
export const ENRICH_CATALOG_QUEUE_NAME = "enrich-catalog";

// Self-heal: every hour, re-enqueue enrich job if albums still lack covers.
export const ENRICH_CATALOG_SELF_HEAL_SCHEDULER_ID = "enrich-catalog-self-heal";
export const ENRICH_CATALOG_SELF_HEAL_EVERY_MS = 60 * 60 * 1000;

const globalCache = globalThis as unknown as {
  __loopstatRedis?: IORedis;
  __loopstatImportQueue?: Queue;
  __loopstatEnrichCatalogQueue?: Queue;
  __loopstatEnrichCatalogHotQueue?: Queue;
  __loopstatEnrichCatalogSingleQueue?: Queue;
};

// BullMQ requires maxRetriesPerRequest: null on the connection used by Workers.
// Sharing the same connection for the Queue keeps a single ioredis instance.
export const connection =
  globalCache.__loopstatRedis ??
  (globalCache.__loopstatRedis = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  }));

export const importQueue =
  globalCache.__loopstatImportQueue ??
  (globalCache.__loopstatImportQueue = new Queue(IMPORT_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      // Imports are not safely retryable: a partial run already wrote streams
      // (idempotent thanks to the unique index) but a blind retry re-reads the
      // temp dir which the previous attempt may have deleted. One attempt.
      attempts: 1,
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  }));

export const enrichCatalogQueue =
  globalCache.__loopstatEnrichCatalogQueue ??
  (globalCache.__loopstatEnrichCatalogQueue = new Queue(ENRICH_CATALOG_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      // Enrichment is idempotent (enriched rows have deezer_id set - including
      // the sentinel 0 on a miss - so a retry won't re-select them) - safe to
      // retry transient Deezer failures.
      // attempts=3 with exp backoff; hourly self-heal re-enqueues if still needed.
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 24 * 3600, count: 100 },
      removeOnFail: { age: 24 * 3600 },
    },
  }));

export const ENRICH_CATALOG_HOT_QUEUE_NAME = "enrich-catalog-hot";

export const enrichCatalogHotQueue: Queue =
  globalCache.__loopstatEnrichCatalogHotQueue ??
  (globalCache.__loopstatEnrichCatalogHotQueue = new Queue(ENRICH_CATALOG_HOT_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 86400, count: 100 },
      removeOnFail: { age: 86400 },
    },
  }));

export const ENRICH_CATALOG_SINGLE_QUEUE_NAME = "enrich-catalog-single";

export const enrichCatalogSingleQueue: Queue =
  globalCache.__loopstatEnrichCatalogSingleQueue ??
  (globalCache.__loopstatEnrichCatalogSingleQueue = new Queue(ENRICH_CATALOG_SINGLE_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 3600, count: 50 },
      removeOnFail: { age: 3600 },
    },
  }));
