import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

let __redis: Redis | undefined;

export function getRedis(): Redis {
  if (__redis) return __redis;
  __redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  return __redis;
}
