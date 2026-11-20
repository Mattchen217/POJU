const fs = require("fs");
const path = "lib/poju/decision-intake/freeze-bound-report.ts";
let s = fs.readFileSync(path, "utf8");

// Patch __createClaimOpsForTests for CAS release returning boolean
const oldTestOps = `/** Test helper — build claim ops over an injectable KV-like store (shared across isolates). */
export function __createClaimOpsForTests(store: {
  get: <T = unknown>(key: string) => Promise<T | null>;
  set: (
    key: string,
    value: unknown,
    opts?: { ex?: number; nx?: boolean },
  ) => Promise<"OK" | null>;
  del: (...keys: string[]) => Promise<number>;
}): FreezeReportClaimOps {
  return {
    async tryAcquire(key, token, ttlSec, meta) {
      const existing = await store.get<{ token?: string; expires_at?: number }>(key);
      const now = Date.now();
      if (
        existing &&
        typeof existing.expires_at === "number" &&
        existing.expires_at > now &&
        typeof existing.token === "string"
      ) {
        return false;
      }
      if (existing) await store.del(key);
      const setResult = await store.set(
        key,
        {
          token,
          acquired_at: now,
          expires_at: now + ttlSec * 1000,
          job_id: meta?.job_id ?? null,
        },
        { nx: true, ex: ttlSec },
      );
      return setResult === "OK";
    },
    async release(key, token) {
      const existing = await store.get<{ token?: string }>(key);
      if (!existing || existing.token !== token) return;
      await store.del(key);
    },
    async forceRelease(key) {
      await store.del(key);
    },
    async load(key) {
      const existing = await store.get<{ token: string; expires_at: number }>(key);
      if (!existing || existing.expires_at <= Date.now()) return null;
      return existing;
    },
  };
}`;

const newTestOps = `/** Test helper — build claim ops over an injectable KV-like store (shared across isolates). */
export function __createClaimOpsForTests(store: {
  get: <T = unknown>(key: string) => Promise<T | null>;
  set: (
    key: string,
    value: unknown,
    opts?: { ex?: number; nx?: boolean },
  ) => Promise<"OK" | null>;
  del: (...keys: string[]) => Promise<number>;
  compareAndDelete?: (key: string, expectedToken: string) => Promise<boolean>;
}): FreezeReportClaimOps {
  return {
    async tryAcquire(key, token, ttlSec, meta) {
      const existing = await store.get<{ token?: string; expires_at?: number }>(key);
      const now = Date.now();
      if (
        existing &&
        typeof existing.expires_at === "number" &&
        existing.expires_at > now &&
        typeof existing.token === "string"
      ) {
        return false;
      }
      if (existing && typeof existing.token === "string") {
        // Expired only: token-checked delete so we never wipe a racing new owner.
        if (
          typeof existing.expires_at === "number" &&
          existing.expires_at <= now
        ) {
          if (typeof store.compareAndDelete === "function") {
            await store.compareAndDelete(key, existing.token);
          } else {
            const again = await store.get<{ token?: string }>(key);
            if (again && again.token === existing.token) await store.del(key);
          }
        }
      }
      const setResult = await store.set(
        key,
        {
          token,
          acquired_at: now,
          expires_at: now + ttlSec * 1000,
          job_id: meta?.job_id ?? null,
        },
        { nx: true, ex: ttlSec },
      );
      return setResult === "OK";
    },
    async release(key, token) {
      if (typeof store.compareAndDelete === "function") {
        return store.compareAndDelete(key, token);
      }
      const existing = await store.get<{ token?: string }>(key);
      if (!existing || existing.token !== token) return false;
      await store.del(key);
      return true;
    },
    async forceRelease(key) {
      await store.del(key);
    },
    async load(key) {
      const existing = await store.get<{ token: string; expires_at: number }>(key);
      if (!existing || existing.expires_at <= Date.now()) return null;
      return existing;
    },
    async bindJobId(key, token, jobId) {
      const existing = await store.get<{
        token?: string;
        expires_at?: number;
        acquired_at?: number;
        job_id?: string | null;
      }>(key);
      if (!existing || existing.token !== token) return false;
      if (typeof existing.expires_at === "number" && existing.expires_at <= Date.now()) {
        return false;
      }
      const ttlSec = Math.max(
        1,
        Math.ceil(((existing.expires_at ?? Date.now()) - Date.now()) / 1000),
      );
      const again = await store.get<{ token?: string }>(key);
      if (!again || again.token !== token) return false;
      await store.set(
        key,
        { ...existing, token, job_id: jobId },
        { ex: ttlSec },
      );
      return true;
    },
  };
}`;

if (!s.includes(oldTestOps)) {
  throw new Error("__createClaimOpsForTests block not found");
}
s = s.replace(oldTestOps, newTestOps);
fs.writeFileSync(path, s);
console.log("test claim ops patched");
