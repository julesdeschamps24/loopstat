import { Queue } from "bullmq";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error("REDIS_URL is not set");

export const POLL_RECENT_QUEUE_NAME = "poll-recent";
export const POLL_RECENT_FANOUT_SCHEDULER_ID = "poll-recent-fanout";
export const POLL_RECENT_FANOUT_EVERY_MS = 30 * 60 * 1000;

// BullMQ requires maxRetriesPerRequest: null on the connection used by Workers.
// Sharing the same connection for the Queue keeps a single ioredis instance.
export const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

export const pollRecentQueue = new Queue(POLL_RECENT_QUEUE_NAME, {
  connection,
});
