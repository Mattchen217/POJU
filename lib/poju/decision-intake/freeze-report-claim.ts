/**
 * M2.2-R1 — Cross-process atomic claim for Freeze-bound report generation.
 * Server-only: uses project KV SET NX (Upstash Redis / MemoryKv).
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
};

export type FreezeReportClaimOps = {
  tryAcquire: (
    key: string,
    token: string,
    ttlSec: number,
    meta?: { job_id?: string | null },
  ) => Promise<boolean>;
  release: (key: string, token: string) => Promise<void>;
  forceRelease: (key: string) => Promise<void>;
  load: (key: string) => Promise<FreezeReportClaimRecord | null>;
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
        await store.del(key);
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
      const existing = await store.get<FreezeReportClaimRecord>(key);
      if (!existing || existing.token !== token) return;
      await store.del(key);
    },
    async forceRelease(key) {
      await store.del(key);
    },
  };
}

/** Default production ops against shared Upstash / MemoryKv. */
export const defaultFreezeReportClaimOps: FreezeReportClaimOps =
  createFreezeReportClaimOps();

export function newFreezeReportClaimToken(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
