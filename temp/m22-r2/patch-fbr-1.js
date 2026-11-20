const fs = require("fs");
const path = "lib/poju/decision-intake/freeze-bound-report.ts";
let s = fs.readFileSync(path, "utf8");

// 1) Update FreezeReportClaimOps release return type
s = s.replace(
  `export type FreezeReportClaimOps = {
  tryAcquire: (
    key: string,
    token: string,
    ttlSec: number,
    meta?: { job_id?: string | null },
  ) => Promise<boolean>;
  release: (key: string, token: string) => Promise<void>;
  forceRelease: (key: string) => Promise<void>;
  load?: (key: string) => Promise<{ token: string; expires_at: number } | null>;
};`,
  `export type FreezeReportClaimOps = {
  tryAcquire: (
    key: string,
    token: string,
    ttlSec: number,
    meta?: { job_id?: string | null },
  ) => Promise<boolean>;
  /** Token-checked compare-and-delete. True only when this token owned the key. */
  release: (key: string, token: string) => Promise<boolean | void>;
  forceRelease: (key: string) => Promise<void>;
  load?: (key: string) => Promise<{ token: string; expires_at: number } | null>;
  bindJobId?: (key: string, token: string, jobId: string) => Promise<boolean>;
};`,
);

// 2) Process-local claim ops: CAS release returns boolean
s = s.replace(
  `/** Process-local NX claim with TTL — safe for client bundles; tests/servers inject KV ops. */
export function createProcessLocalClaimOps(
  store: Map<string, ProcessLocalClaim> = new Map(),
): FreezeReportClaimOps {
  return {
    async tryAcquire(key, token, ttlSec) {
      const now = Date.now();
      const existing = store.get(key);
      if (existing && existing.expires_at > now) return false;
      store.set(key, { token, expires_at: now + ttlSec * 1000 });
      return true;
    },
    async release(key, token) {
      const existing = store.get(key);
      if (!existing || existing.token !== token) return;
      store.delete(key);
    },
    async forceRelease(key) {
      store.delete(key);
    },
    async load(key) {
      const existing = store.get(key);
      if (!existing || existing.expires_at <= Date.now()) return null;
      return existing;
    },
  };
}`,
  `/** Process-local NX claim with TTL — safe for client bundles; tests/servers inject KV ops. */
export function createProcessLocalClaimOps(
  store: Map<string, ProcessLocalClaim> = new Map(),
): FreezeReportClaimOps {
  return {
    async tryAcquire(key, token, ttlSec) {
      const now = Date.now();
      const existing = store.get(key);
      if (existing && existing.expires_at > now) return false;
      // Expired residue can be overwritten only when still the same token or absent.
      store.set(key, { token, expires_at: now + ttlSec * 1000 });
      return true;
    },
    async release(key, token) {
      const existing = store.get(key);
      if (!existing || existing.token !== token) return false;
      store.delete(key);
      return true;
    },
    async forceRelease(key) {
      store.delete(key);
    },
    async load(key) {
      const existing = store.get(key);
      if (!existing || existing.expires_at <= Date.now()) return null;
      return existing;
    },
    async bindJobId() {
      return true;
    },
  };
}`,
);

if (!s.includes("Token-checked compare-and-delete. True only when this token owned")) {
  throw new Error("failed to patch FreezeReportClaimOps type");
}
if (!s.includes("async release(key, token) {\n      const existing = store.get(key);\n      if (!existing || existing.token !== token) return false;")) {
  throw new Error("failed to patch process-local release");
}

fs.writeFileSync(path, s);
console.log("freeze-bound-report: claim ops types patched");
