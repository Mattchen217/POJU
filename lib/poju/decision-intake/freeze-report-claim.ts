/**
 * M2.2-R2 — Cross-process atomic claim for Freeze-bound report generation.
 * Server-only: uses project KV SET NX (Upstash Redis / MemoryKv).
 * Release is token-checked compare-and-delete (stale owner cannot drop a newer claim).
 * Client bundles must not import this module; inject claimOps or use
 * requestFreezeBoundEightPageReportServer from freeze-bound-report-server.ts.
 */

import "server-only";

import { kv, KV_TTL } from "@/lib/kv/client";
import {
  ClaimCasUnavailableError,
  compareAndDeleteClaim,
} from "@/lib/poju/decision-intake/freeze-report-claim-cas";

export { ClaimCasUnavailableError, compareAndDeleteClaim };


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


/**
 * M2.2-R3 Regenerate claim release: only the original owner's token may CAS-delete.
 * Never force-delete another execution context's claim.
 * If ownership cannot be proven while a claim is held → fail closed.
 */
export type RegenerateClaimReleaseResult =
  | { ok: true; released: boolean }
  | { ok: false; code: "CLAIM_OWNED_BY_OTHER"; error: string };

export async function tryReleaseClaimForRegenerate(input: {
  claimOps: FreezeReportClaimOps;
  claimKey: string;
  /** Original owner's token from the prior Final Delivery job input, if known. */
  ownerToken: string | null | undefined;
}): Promise<RegenerateClaimReleaseResult> {
  const held = input.claimOps.load
    ? await input.claimOps.load(input.claimKey)
    : null;
  if (!held) {
    return { ok: true, released: false };
  }
  if (!input.ownerToken) {
    return {
      ok: false,
      code: "CLAIM_OWNED_BY_OTHER",
      error:
        "Regenerate cannot prove claim ownership; fail closed until lease expiry",
    };
  }
  const released = await input.claimOps.release(
    input.claimKey,
    input.ownerToken,
  );
  if (!released) {
    return {
      ok: false,
      code: "CLAIM_OWNED_BY_OTHER",
      error:
        "Regenerate token does not own the active claim; fail closed (will not steal)",
    };
  }
  return { ok: true, released: true };
}

export function newFreezeReportClaimToken(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
