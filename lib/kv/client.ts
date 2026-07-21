import { Redis } from "@upstash/redis";

/**
 * Upstash Redis (Vercel KV integration).
 * Reads `UPSTASH_REDIS_REST_*` or `KV_REST_API_URL` / `KV_REST_API_TOKEN`.
 */
export const kv = Redis.fromEnv();

export const KV_TTL = {
  BASE_ANALYSIS_JOB: 60 * 60 * 2,
  /** 分阶段客户端编排：compute+write+finalize 可跨多次请求，需盖住最坏墙钟。 */
  BASE_ANALYSIS_LOCK: 60 * 45,
  POJU_XHIGH_JOB: 60 * 60 * 2,
  POJU_XHIGH_LOCK: 60 * 5,
} as const;
