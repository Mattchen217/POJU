import { Redis } from "@upstash/redis";

/**
 * Upstash Redis (Vercel KV integration).
 * Reads `UPSTASH_REDIS_REST_*` or `KV_REST_API_URL` / `KV_REST_API_TOKEN`.
 */
export const kv = Redis.fromEnv();

export const KV_TTL = {
  BASE_ANALYSIS_JOB: 60 * 60 * 2,
  /** 覆盖 v2 单轮(~160s 拆后)并留余量，防锁中途过期被第二请求穿透重跑。 */
  BASE_ANALYSIS_LOCK: 60 * 10,
  POJU_XHIGH_JOB: 60 * 60 * 2,
  POJU_XHIGH_LOCK: 60 * 5,
} as const;
