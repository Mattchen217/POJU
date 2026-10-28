import { AsyncLocalStorage } from "node:async_hooks";

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

type EphemeralFrame = {
  kv: MemoryKv;
  /** Absolute timestamp. Delivery hops must stop before the request is killed. */
  deadlineAt: number | null;
};

const ephemeralAls = new AsyncLocalStorage<EphemeralFrame>();
const remoteKv = createKv();

/**
 * Request-scoped memory KV. Upstash plan-limit fallbacks run a job here and
 * return it on the same response — another isolate cannot see this store.
 * `deadlineMs` is the budget from now; delivery in-process hops read it.
 */
export function runWithEphemeralKv<T>(
  fn: () => Promise<T>,
  opts?: { deadlineMs?: number },
): Promise<T> {
  return ephemeralAls.run(
    {
      kv: new MemoryKv(),
      deadlineAt:
        opts?.deadlineMs != null && opts.deadlineMs > 0 ? Date.now() + opts.deadlineMs : null,
    },
    fn,
  );
}

export function isEphemeralKvActive(): boolean {
  return ephemeralAls.getStore() != null;
}

/** Milliseconds left in the ephemeral request budget, or null when not ephemeral. */
export function ephemeralRemainingMs(): number | null {
  const frame = ephemeralAls.getStore();
  if (!frame?.deadlineAt) return null;
  return frame.deadlineAt - Date.now();
}

function currentKv(): Redis | MemoryKv {
  return ephemeralAls.getStore()?.kv ?? remoteKv;
}

/**
 * Delegates to the ephemeral frame when one is active so delivery checkpoints,
 * task leases, and xhigh jobs share one request-scoped store.
 */
export const kv = new Proxy(remoteKv as Redis, {
  get(target, prop, receiver) {
    const src = currentKv();
    const value = Reflect.get(src, prop, src === target ? receiver : src);
    if (typeof value === "function") return (value as (...args: unknown[]) => unknown).bind(src);
    return value;
  },
});

export const KV_TTL = {
  BASE_ANALYSIS_JOB: 60 * 60 * 2,
  /** 分阶段客户端编排：compute+write+finalize 可跨多次请求，需盖住最坏墙钟。 */
  BASE_ANALYSIS_LOCK: 60 * 45,
  POJU_XHIGH_JOB: 60 * 60 * 2,
  /** Cover full Phase-4 wall (status MAX_JOB_AGE ≈ 90m); was 5m and allowed double-create. */
  POJU_XHIGH_LOCK: 60 * 90,
} as const;
