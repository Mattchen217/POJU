/**
 * Unit C/D — temporary cloud personal-content lifecycle for report jobs.
 *
 * Running jobs: absolute max 14 days from bind/create (does not extend on read).
 * Completed, unacked: max 7 days from completion.
 * ACK: immediate cleanup via purgeReportPersonalContent (Unit D).
 */

import { durableKv, kv, KV_TTL } from "@/lib/kv/client";
import { browserTaskCredentialKey } from "./browser-task-credential";
import {
  di2AnalysisKey,
  di2CompletedReportKey,
  di2DispatchKey,
  di2PageKey,
} from "./decision-report-store";
import { DECISION_PAGE_IDS } from "@/lib/llm/pro/delivery/page-feed-matrix";

/** Absolute ceiling for an in-flight / unclaimed report job (seconds). */
export const REPORT_JOB_ABSOLUTE_TTL_SECONDS = 60 * 60 * 24 * 14;

/** Completed report personal content retention until ACK (seconds). */
export const REPORT_COMPLETED_UNACKED_TTL_SECONDS = 60 * 60 * 24 * 7;

export type ReportLifecycleState =
  | "running"
  | "completed_unacked"
  | "acked"
  | "expired"
  | "purged";

export type ReportLifecycleRecord = {
  v: 1;
  job_id: string;
  session_id: string;
  state: ReportLifecycleState;
  created_at: string;
  completed_at: string | null;
  acked_at: string | null;
  absolute_expires_at: string;
  content_expires_at: string | null;
  last_purge_at: string | null;
  pass_charge_ref: string | null;
};

function safe(s: string): string {
  return s.replace(/[^a-zA-Z0-9@_.:-]/g, "_");
}

export function reportLifecycleKey(job_id: string): string {
  return `poju-di2:lifecycle:${safe(job_id)}`;
}

function addSecondsIso(iso: string, seconds: number): string {
  return new Date(Date.parse(iso) + seconds * 1000).toISOString();
}

export async function loadReportLifecycle(job_id: string): Promise<ReportLifecycleRecord | null> {
  const got = await durableKv().get<ReportLifecycleRecord>(reportLifecycleKey(job_id));
  if (!got || got.v !== 1 || got.job_id !== job_id) return null;
  return got;
}

export async function ensureReportLifecycleStarted(input: {
  job_id: string;
  session_id: string;
  now?: string;
  pass_charge_ref?: string | null;
}): Promise<ReportLifecycleRecord> {
  const existing = await loadReportLifecycle(input.job_id);
  if (existing) return existing;
  const now = input.now ?? new Date().toISOString();
  const record: ReportLifecycleRecord = {
    v: 1,
    job_id: input.job_id,
    session_id: input.session_id,
    state: "running",
    created_at: now,
    completed_at: null,
    acked_at: null,
    absolute_expires_at: addSecondsIso(now, REPORT_JOB_ABSOLUTE_TTL_SECONDS),
    content_expires_at: null,
    last_purge_at: null,
    pass_charge_ref: input.pass_charge_ref ?? null,
  };
  await durableKv().set(reportLifecycleKey(input.job_id), record, {
    ex: REPORT_JOB_ABSOLUTE_TTL_SECONDS,
    nx: true,
  });
  return (await loadReportLifecycle(input.job_id)) ?? record;
}

export async function markReportLifecycleCompleted(input: {
  job_id: string;
  now?: string;
}): Promise<ReportLifecycleRecord | null> {
  const cur = await loadReportLifecycle(input.job_id);
  if (!cur) return null;
  if (cur.state === "acked" || cur.state === "purged" || cur.state === "expired") return cur;
  const now = input.now ?? new Date().toISOString();
  const next: ReportLifecycleRecord = {
    ...cur,
    state: "completed_unacked",
    completed_at: cur.completed_at ?? now,
    content_expires_at: addSecondsIso(now, REPORT_COMPLETED_UNACKED_TTL_SECONDS),
  };
  await durableKv().set(reportLifecycleKey(input.job_id), next, {
    ex: REPORT_COMPLETED_UNACKED_TTL_SECONDS,
  });
  return next;
}

export async function markReportLifecycleAcked(input: {
  job_id: string;
  now?: string;
}): Promise<ReportLifecycleRecord | null> {
  const cur = await loadReportLifecycle(input.job_id);
  if (!cur) return null;
  const now = input.now ?? new Date().toISOString();
  const next: ReportLifecycleRecord = {
    ...cur,
    state: "acked",
    acked_at: cur.acked_at ?? now,
  };
  await durableKv().set(reportLifecycleKey(input.job_id), next, {
    ex: REPORT_JOB_ABSOLUTE_TTL_SECONDS,
  });
  return next;
}

export function isReportLifecycleContentExpired(
  record: ReportLifecycleRecord,
  nowMs = Date.now(),
): boolean {
  if (record.state === "acked" || record.state === "purged" || record.state === "expired") return true;
  if (Date.parse(record.absolute_expires_at) <= nowMs) return true;
  if (record.content_expires_at && Date.parse(record.content_expires_at) <= nowMs) return true;
  return false;
}

/**
 * Delete personal content keys for a job. Idempotent.
 * Keeps the minimal lifecycle tombstone (state + pass_charge_ref).
 */
export async function purgeReportPersonalContent(input: {
  job_id: string;
  session_id: string;
  analysis_idempotency_key?: string | null;
  reason: "ack" | "ttl" | "absolute";
  now?: string;
}): Promise<{ purged_keys: string[]; lifecycle: ReportLifecycleRecord | null }> {
  const keys: string[] = [
    di2CompletedReportKey(input.session_id, input.job_id),
    browserTaskCredentialKey(input.job_id),
    di2DispatchKey(input.job_id),
  ];
  for (const page_id of DECISION_PAGE_IDS) {
    keys.push(di2PageKey(input.job_id, page_id));
  }
  if (input.analysis_idempotency_key) {
    keys.push(di2AnalysisKey(input.analysis_idempotency_key));
  }

  const store = durableKv();
  const purged_keys: string[] = [];
  for (const key of keys) {
    try {
      await store.del(key);
      await kv.del(key).catch(() => undefined);
      purged_keys.push(key);
    } catch {
      // best-effort; caller may retry
    }
  }

  const now = input.now ?? new Date().toISOString();
  const cur = await loadReportLifecycle(input.job_id);
  const tombstone: ReportLifecycleRecord = {
    v: 1,
    job_id: input.job_id,
    session_id: input.session_id,
    state: input.reason === "ack" ? "acked" : input.reason === "absolute" ? "expired" : "expired",
    created_at: cur?.created_at ?? now,
    completed_at: cur?.completed_at ?? null,
    acked_at: input.reason === "ack" ? (cur?.acked_at ?? now) : cur?.acked_at ?? null,
    absolute_expires_at: cur?.absolute_expires_at ?? addSecondsIso(now, REPORT_JOB_ABSOLUTE_TTL_SECONDS),
    content_expires_at: cur?.content_expires_at ?? null,
    last_purge_at: now,
    pass_charge_ref: cur?.pass_charge_ref ?? null,
  };
  // After purge, keep a short non-content tombstone (not the old 60d body retention).
  await durableKv().set(reportLifecycleKey(input.job_id), { ...tombstone, state: "purged" }, {
    ex: REPORT_JOB_ABSOLUTE_TTL_SECONDS,
  });

  return { purged_keys, lifecycle: { ...tombstone, state: "purged" } };
}

/** Retention used by CompletedReport / durable DI2 personal blobs (Unit C). */
export function reportCompletedContentTtlSeconds(): number {
  return REPORT_COMPLETED_UNACKED_TTL_SECONDS;
}

/** Absolute job ceiling (also used for credential verifier retention). */
export function reportAbsoluteTtlSeconds(): number {
  return REPORT_JOB_ABSOLUTE_TTL_SECONDS;
}

/** Document platform limits that cannot be fully enforced in-app. */
export const REPORT_LIFECYCLE_PLATFORM_LIMITS = {
  inngest_step_output_retention: "Managed by Inngest platform; payloads carry ids only, not DC bodies.",
  batch2_execution_ttl_seconds: KV_TTL.REPORT_BATCH2_JOB,
  xhigh_execution_ttl_seconds: KV_TTL.POJU_XHIGH_JOB,
  note:
    "Execution KV (2h) covers in-flight page workers. Durable personal content uses 7d unacked / 14d absolute. Inngest event payloads must stay identity-only.",
} as const;
