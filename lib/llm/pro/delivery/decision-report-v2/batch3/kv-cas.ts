/**
 * Shared CAS / list helpers for Batch3 durableKv writes.
 */

import { durableKv, KV_TTL } from "@/lib/kv/client";
import {
  isRemoteKvConfigured,
  type MemoryKv,
  type MemoryKvAtomicOps,
} from "@/lib/kv/memory-kv";
import type { Batch3Result } from "./types";

const CAS_SET_LUA = `
local cur = redis.call("GET", KEYS[1])
local expected = ARGV[1]
if expected == "__ABSENT__" then
  if cur ~= false and cur ~= nil then return 0 end
else
  if cur == false or cur == nil then return 0 end
  if cur ~= expected then return 0 end
end
redis.call("SET", KEYS[1], ARGV[2], "EX", tonumber(ARGV[3]))
return 1
`;

/** Multi-key SET+RPUSH for outbox intent (atomic on Redis via Lua). */
const ENQUEUE_INTENT_LUA = `
redis.call("SET", KEYS[1], ARGV[1], "EX", tonumber(ARGV[3]))
redis.call("RPUSH", KEYS[2], ARGV[2])
redis.call("EXPIRE", KEYS[2], tonumber(ARGV[3]))
return 1
`;

type KvCasStore = {
  get: <T>(key: string) => Promise<T | null>;
  set: (key: string, value: unknown, opts?: { ex?: number }) => Promise<unknown>;
  compareAndSetExact?: (
    key: string,
    expectedJson: string | null,
    next: unknown,
    opts?: { ex?: number },
  ) => Promise<boolean>;
  eval?: (script: string, keys: string[], args: string[]) => Promise<unknown>;
  rpush?: (key: string, ...values: unknown[]) => Promise<number>;
  lrange?: <T>(key: string, start: number, stop: number) => Promise<T[]>;
  expire?: (key: string, seconds: number) => Promise<number>;
  del: (...keys: string[]) => Promise<number>;
  runAtomic?: <T>(fn: (ops: MemoryKvAtomicOps) => T) => T;
};

const tracked = new Set<string>();

export function isBatch3SharedStoreAvailable(): boolean {
  if (isRemoteKvConfigured()) return true;
  if (process.env.REPORT_BATCH2_ALLOW_MEMORY_STORE === "1") return true;
  return false;
}

export function trackBatch3Key(key: string): void {
  tracked.add(key);
}

export async function resetBatch3KeysForTests(): Promise<void> {
  const keys = [...tracked];
  tracked.clear();
  const store = durableKv() as unknown as KvCasStore;
  await Promise.all(keys.map((k) => store.del(k).catch(() => undefined)));
}

function store(): KvCasStore {
  return durableKv() as unknown as KvCasStore;
}

function ttl(): number {
  return KV_TTL.REPORT_BATCH2_JOB;
}

export function ttlSeconds(): number {
  return ttl();
}

export function kvUnavailable<T = never>(): Batch3Result<T> {
  return {
    ok: false,
    code: "kv_unavailable",
    detail: "Batch3 requires shared durable KV (or REPORT_BATCH2_ALLOW_MEMORY_STORE=1 for tests)",
  };
}

export async function kvGet<T>(key: string): Promise<Batch3Result<T | null>> {
  if (!isBatch3SharedStoreAvailable()) return kvUnavailable();
  try {
    const value = await store().get<T>(key);
    return { ok: true, value };
  } catch (err) {
    return {
      ok: false,
      code: "kv_read_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function casSet(
  key: string,
  expectedJson: string | null,
  next: unknown,
): Promise<Batch3Result<void>> {
  if (!isBatch3SharedStoreAvailable()) return kvUnavailable();
  trackBatch3Key(key);
  try {
    const s = store();
    const ex = ttl();
    if (typeof s.compareAndSetExact === "function") {
      const ok = await s.compareAndSetExact(key, expectedJson, next, { ex });
      if (!ok) {
        return { ok: false, code: "conflict", detail: `CAS conflict on ${key}` };
      }
      return { ok: true, value: undefined };
    }
    if (typeof s.eval === "function") {
      const expectedArg = expectedJson === null ? "__ABSENT__" : expectedJson;
      const r = await s.eval(CAS_SET_LUA, [key], [
        expectedArg,
        JSON.stringify(next),
        String(ex),
      ]);
      if (!(r === 1 || r === true)) {
        return { ok: false, code: "conflict", detail: `CAS eval conflict on ${key}` };
      }
      return { ok: true, value: undefined };
    }
    return {
      ok: false,
      code: "kv_write_failed",
      detail: "Batch3 KV CAS unavailable (need compareAndSetExact or eval)",
    };
  } catch (err) {
    return {
      ok: false,
      code: "kv_write_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function listPush(key: string, value: unknown): Promise<Batch3Result<void>> {
  if (!isBatch3SharedStoreAvailable()) return kvUnavailable();
  trackBatch3Key(key);
  try {
    const s = store();
    if (typeof s.rpush === "function") {
      await s.rpush(key, value);
    } else {
      return { ok: false, code: "kv_write_failed", detail: "rpush unavailable" };
    }
    if (typeof s.expire === "function") {
      await s.expire(key, ttl()).catch(() => undefined);
    }
    return { ok: true, value: undefined };
  } catch (err) {
    return {
      ok: false,
      code: "kv_write_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function listRange<T>(key: string): Promise<Batch3Result<T[]>> {
  if (!isBatch3SharedStoreAvailable()) return kvUnavailable();
  try {
    const s = store();
    if (typeof s.lrange !== "function") {
      return { ok: true, value: [] };
    }
    const rows = await s.lrange<T>(key, 0, -1);
    return { ok: true, value: rows };
  } catch (err) {
    return {
      ok: false,
      code: "kv_read_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Run a synchronous multi-key transaction against MemoryKv.
 * Redis production path must use dedicated Lua helpers (evalTxn / enqueueIntentAtomic).
 */
export function runMemoryAtomic<T>(
  fn: (ops: MemoryKvAtomicOps) => T,
): Batch3Result<T> {
  if (!isBatch3SharedStoreAvailable()) return kvUnavailable();
  const s = store();
  if (typeof s.runAtomic !== "function") {
    return {
      ok: false,
      code: "kv_write_failed",
      detail: "MemoryKv runAtomic unavailable — use Redis Lua path",
    };
  }
  try {
    return { ok: true, value: s.runAtomic(fn) };
  } catch (err) {
    return {
      ok: false,
      code: "kv_write_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export function isMemoryAtomicAvailable(): boolean {
  const s = store();
  return typeof s.runAtomic === "function";
}

export function isRedisEvalAvailable(): boolean {
  const s = store();
  return typeof s.eval === "function" && !isMemoryAtomicAvailable();
}

/** Atomically SET intent key + RPUSH outbox index. */
export async function enqueueIntentAtomic(input: {
  intentKey: string;
  outboxKey: string;
  intent: unknown;
  intent_id: string;
}): Promise<Batch3Result<void>> {
  if (!isBatch3SharedStoreAvailable()) return kvUnavailable();
  trackBatch3Key(input.intentKey);
  trackBatch3Key(input.outboxKey);
  const ex = ttl();
  const s = store();
  try {
    if (typeof s.runAtomic === "function") {
      s.runAtomic((ops) => {
        ops.setJson(input.intentKey, input.intent, ex);
        ops.rpush(input.outboxKey, input.intent_id);
      });
      return { ok: true, value: undefined };
    }
    if (typeof s.eval === "function") {
      await s.eval(ENQUEUE_INTENT_LUA, [input.intentKey, input.outboxKey], [
        JSON.stringify(input.intent),
        input.intent_id,
        String(ex),
      ]);
      return { ok: true, value: undefined };
    }
    return {
      ok: false,
      code: "kv_write_failed",
      detail: "atomic intent enqueue unavailable",
    };
  } catch (err) {
    return {
      ok: false,
      code: "kv_write_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function evalTxn(
  script: string,
  keys: string[],
  args: string[],
): Promise<Batch3Result<unknown>> {
  if (!isBatch3SharedStoreAvailable()) return kvUnavailable();
  for (const k of keys) trackBatch3Key(k);
  try {
    const s = store();
    if (typeof s.eval !== "function") {
      return {
        ok: false,
        code: "kv_write_failed",
        detail: "Redis eval unavailable",
      };
    }
    const r = await s.eval(script, keys, args);
    return { ok: true, value: r };
  } catch (err) {
    return {
      ok: false,
      code: "kv_write_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export function getDurableStore(): KvCasStore | MemoryKv {
  return durableKv() as unknown as KvCasStore | MemoryKv;
}
