import { Queue } from "bullmq";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error("REDIS_URL is not set");

export const POLL_RECENT_QUEUE_NAME = "poll-recent";
export const POLL_RECENT_FANOUT_SCHEDULER_ID = "poll-recent-fanout";
export const POLL_RECENT_FANOUT_EVERY_MS = 30 * 60 * 1000;

// Cache the connection + queue on globalThis so dev-mode HMR (Next.js / tsx watch)
// doesn't open a new Redis socket and a new BullMQ Queue on every module reload.
const globalCache = globalThis as unknown as {
  __loopstatRedis?: IORedis;
  __loopstatPollRecentQueue?: Queue;
};

// BullMQ requires maxRetriesPerRequest: null on the connection used by Workers.
// Sharing the same connection for the Queue keeps a single ioredis instance.
export const connection =
  globalCache.__loopstatRedis ??
  (globalCache.__loopstatRedis = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  }));

export const pollRecentQueue =
  globalCache.__loopstatPollRecentQueue ??
  (globalCache.__loopstatPollRecentQueue = new Queue(POLL_RECENT_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 24 * 3600 },
    },
  }));
