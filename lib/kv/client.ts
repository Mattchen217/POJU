import { Redis } from "@upstash/redis";

import { isRemoteKvConfigured, MemoryKv } from "@/lib/kv/memory-kv";

/**
 * Upstash Redis (Vercel KV) when `UPSTASH_REDIS_REST_*` / `KV_REST_API_*` are set.
 * Local `pnpm dev` without those env vars falls back to process-memory KV so
 * base-analysis locks/jobs do not crash with `Failed to parse URL from /pipeline`.
 */
function createKv(): Redis | MemoryKv {
  if (isRemoteKvConfigured()) {
    return Redis.fromEnv();
  }
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "[kv] UPSTASH/KV env missing — using in-memory KV for local dev. " +
        "Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_*) to match Vercel.",
    );
    return new MemoryKv();
  }
  /* Production misconfig: still construct fromEnv so the failure is explicit. */
  return Redis.fromEnv();
}

export const kv = createKv() as Redis;

export const KV_TTL = {
  BASE_ANALYSIS_JOB: 60 * 60 * 2,
  /** 分阶段客户端编排：compute+write+finalize 可跨多次请求，需盖住最坏墙钟。 */
  BASE_ANALYSIS_LOCK: 60 * 45,
  POJU_XHIGH_JOB: 60 * 60 * 2,
  /** Cover full Phase-4 wall (status MAX_JOB_AGE ≈ 90m); was 5m and allowed double-create. */
  POJU_XHIGH_LOCK: 60 * 90,
} as const;
