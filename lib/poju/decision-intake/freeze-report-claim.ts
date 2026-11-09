/**
 * M2.2-R2 — Cross-process atomic claim for Freeze-bound report generation.
 * Server-only: uses project KV SET NX (Upstash Redis / MemoryKv).
 * Release is token-checked compare-and-delete (stale owner cannot drop a newer claim).
 * Client bundles must not import this module; inject claimOps or use
 * requestFreezeBoundEightPageReportServer from freeze-bound-report-server.ts.
 */

import "server-only";

import { kv, KV_TTL } from "@/lib/kv/client";

/** Cover worst-case eight-page / final-delivery wall clock; crash unlocks after TTL. */
export const M22_REPORT_CLAIM_TTL_SEC = KV_TTL.POJU_XHIGH_LOCK;

export type FreezeReportClaimRecord = {
  token: string;
  acquired_at: number;
  expires_at: number;
  job_id?: string | null;
};

export type FreezeReportClaimKv = {
  get: <T = unknown>(key: string) => Promise<T | null>;
  set: (
    key: string,
    value: unknown,
    opts?: { ex?: number; nx?: boolean },
  ) => Promise<"OK" | null>;
  del: (...keys: string[]) => Promise<number>;
  /** Atomic token-checked delete when available (MemoryKv / wrappers). */
  compareAndDelete?: (key: string, expectedToken: string) => Promise<boolean>;
  /** Upstash Redis Lua eval (optional). */
  eval?: (
    script: string,
    keys: string[],
    args: string[],
  ) => Promise<unknown>;
};

export type FreezeReportClaimOps = {
  tryAcquire: (
    key: string,
    token: string,
    ttlSec: number,
    meta?: { job_id?: string | null },
  ) => Promise<boolean>;
  /** Token-checked compare-and-delete. Returns true only when this token owned the key. */
  release: (key: string, token: string) => Promise<boolean>;
  forceRelease: (key: string) => Promise<void>;
  load: (key: string) => Promise<FreezeReportClaimRecord | null>;
  /** Attach xhigh / M2.2 job id onto an owned claim (best-effort; ownership re-checked). */
  bindJobId: (key: string, token: string, jobId: string) => Promise<boolean>;
};

const CAS_DELETE_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
if type(raw) ~= 'string' then
  raw = tostring(raw)
end
if raw == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
local ok, obj = pcall(cjson.decode, raw)
if ok and type(obj) == 'table' and tostring(obj['token']) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

export function freezeReportClaimKey(input: {
  sessionId: string;
  freezeId: string;
  reportSchemaVersion: string;
}): string {
  return [
    "poju-m22:freeze-report-claim",
    input.sessionId,
    input.freezeId,
    input.reportSchemaVersion,
  ].join(":");
}

export async function compareAndDeleteClaim(
  store: FreezeReportClaimKv,
  key: string,
  token: string,
): Promise<boolean> {
  if (typeof store.compareAndDelete === "function") {
    return store.compareAndDelete(key, token);
  }
  if (typeof store.eval === "function") {
    try {
      const result = await store.eval(CAS_DELETE_LUA, [key], [token]);
      return result === 1 || result === true;
    } catch {
      /* fall through to get+check+del */
    }
  }
  // Single-threaded fallback (tests / MemoryKv duck type without method).
  const existing = await store.get<FreezeReportClaimRecord>(key);
  if (!existing || existing.token !== token) return false;
  await store.del(key);
  return true;
}

export function createFreezeReportClaimOps(
  store: FreezeReportClaimKv = kv as unknown as FreezeReportClaimKv,
): FreezeReportClaimOps {
  return {
    async load(key) {
      const raw = await store.get<FreezeReportClaimRecord>(key);
      if (!raw || typeof raw !== "object") return null;
      if (typeof raw.expires_at !== "number" || raw.expires_at <= Date.now()) {
        return null;
      }
      if (typeof raw.token !== "string" || !raw.token) return null;
      return raw;
    },
    async tryAcquire(key, token, ttlSec, meta) {
      const existing = await store.get<FreezeReportClaimRecord>(key);
      const now = Date.now();
      if (
        existing &&
        typeof existing.expires_at === "number" &&
        existing.expires_at > now &&
        typeof existing.token === "string"
      ) {
        return false;
      }
      if (existing) {
        // Expired residue — only delete if still the same expired record token
        // (avoid wiping a racing new owner). Prefer NX set after conditional del.
        if (
          typeof existing.token === "string" &&
          typeof existing.expires_at === "number" &&
          existing.expires_at <= now
        ) {
          await compareAndDeleteClaim(store, key, existing.token);
        }
      }
      const lease: FreezeReportClaimRecord = {
        token,
        acquired_at: now,
        expires_at: now + ttlSec * 1000,
        job_id: meta?.job_id ?? null,
      };
      const setResult = await store.set(key, lease, {
        nx: true,
        ex: ttlSec,
      });
      return setResult === "OK";
    },
    async release(key, token) {
      return compareAndDeleteClaim(store, key, token);
    },
    async forceRelease(key) {
      await store.del(key);
    },
    async bindJobId(key, token, jobId) {
      const existing = await store.get<FreezeReportClaimRecord>(key);
      if (!existing || existing.token !== token) return false;
      if (typeof existing.expires_at === "number" && existing.expires_at <= Date.now()) {
        return false;
      }
      const ttlSec = Math.max(
        1,
        Math.ceil((existing.expires_at - Date.now()) / 1000),
      );
      const next: FreezeReportClaimRecord = {
        ...existing,
        job_id: jobId,
      };
      // Re-check ownership immediately before write.
      const again = await store.get<FreezeReportClaimRecord>(key);
      if (!again || again.token !== token) return false;
      await store.set(key, next, { ex: ttlSec });
      return true;
    },
  };
}

/** Default production ops against shared Upstash / MemoryKv. */
export const defaultFreezeReportClaimOps: FreezeReportClaimOps =
  createFreezeReportClaimOps();

export function newFreezeReportClaimToken(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
