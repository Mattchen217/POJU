/**
 * M3 — server-side KV for the Decision Intake 2.0 report chain.
 *
 * The session itself lives only on the device (Never Stored). Report inputs come only
 * from the M4 authority records (server-sealed Freeze, server-recomputed profile);
 * every stage re-reads and re-verifies them — nothing from a request body is trusted.
 *  - Personal Analysis records keyed by the idempotency key.
 *  - Page records keyed by job_id (an execution generation never writes another's pages).
 *  - Completed report record per job (retention window; status fallback).
 * In-flight artifacts use the xhigh execution TTL; completed ones the product retention.
 */

import { sha256 } from "@noble/hashes/sha2.js";

import { durableKv, kv, KV_TTL } from "@/lib/kv/client";
import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import { DECISION_PAGE_IDS } from "@/lib/llm/pro/delivery/page-feed-matrix";
import { loadVerifiedFreezeRecord } from "@/lib/poju/decision-authority/server/freeze-authority";
import { DcAuthorityError } from "@/lib/poju/decision-authority/server/ledger-store";
import { loadVerifiedProfileRecord } from "@/lib/poju/decision-authority/server/profile-authority";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type {
  DecisionReportJobResult,
  DecisionReportPageRecord,
  PersonalAnalysisRecord,
} from "./decision-report-types";
import type { Di2PageStructured } from "./decision-report-render";
import { deepFreezeValue } from "./freeze-bound-report";
import type { ProfileProjection, RegisteredProfile } from "./personal-analysis";
import type { DecisionBlueprint } from "./types";

/** In-flight execution artifacts: the xhigh job window. */
const TTL = KV_TTL.POJU_XHIGH_JOB;
/** Finished analysis / pages / report: product retention, not the execution TTL. */
const RETENTION = KV_TTL.DECISION_AUTHORITY_RETENTION;
const textEncoder = new TextEncoder();

function shortHash(s: string): string {
  let out = "";
  for (const b of sha256(textEncoder.encode(s)).slice(0, 16)) out += b.toString(16).padStart(2, "0");
  return out;
}

function safe(s: string): string {
  return s.replace(/[^a-zA-Z0-9@_.:-]/g, "_");
}

export class DecisionReportStoreError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "DecisionReportStoreError";
    this.code = code;
  }
}

// ─── Freeze (server authority record) ──────────────────────────────────────

export type RegisteredFreeze = {
  session_id: string;
  freeze_id: string;
  context_hash: string;
  decision_context: DecisionContext;
  blueprint: DecisionBlueprint | null;
  blueprint_hash: string | null;
  frozen_at: string;
  receipt_id: string;
};

function authorityFailure(e: unknown): never {
  if (e instanceof DcAuthorityError) throw new DecisionReportStoreError(e.code, e.message);
  throw e;
}

/**
 * Re-verify on every read: server Freeze record (signature, integrity, ledger anchor)
 * + the exact binding and receipt the job was created for. There is no client path in.
 */
export async function loadRegisteredFreeze(input: {
  session_id: string;
  freeze_id: string;
  context_hash: string;
  receipt_id?: string;
}): Promise<RegisteredFreeze> {
  const rec = await loadVerifiedFreezeRecord(input.session_id, input.freeze_id).catch(authorityFailure);
  if (rec.context_hash !== input.context_hash) {
    throw new DecisionReportStoreError("FREEZE_CONFLICT", "Freeze record hash differs from job binding");
  }
  if (input.receipt_id && rec.receipt.receipt_id !== input.receipt_id) {
    throw new DecisionReportStoreError("FREEZE_CONFLICT", "Freeze receipt differs from job binding");
  }
  const blueprint = rec.blueprint ?? null;
  if (blueprint && (blueprint.context_id !== rec.context_id || blueprint.session_id !== rec.session_id)) {
    throw new DecisionReportStoreError("BLUEPRINT_MISMATCH", "Blueprint does not belong to this session / Decision Context");
  }
  return deepFreezeValue({
    session_id: rec.session_id,
    freeze_id: rec.freeze_id,
    context_hash: rec.context_hash,
    decision_context: rec.frozen_dc,
    blueprint,
    blueprint_hash: rec.blueprint_hash,
    frozen_at: rec.frozen_at,
    receipt_id: rec.receipt.receipt_id,
  });
}

// ─── Profile (server-recomputed record) ────────────────────────────────────

export async function loadRegisteredProfile(input: {
  session_id: string;
  freeze_id: string;
  frozen_at: string;
  profile_hash: string;
  receipt_id?: string;
}): Promise<RegisteredProfile> {
  const rec = await loadVerifiedProfileRecord({
    session_id: input.session_id,
    freeze_id: input.freeze_id,
    frozen_at: input.frozen_at,
    profile_hash: input.profile_hash,
  }).catch(authorityFailure);
  if (input.receipt_id && rec.receipt.receipt_id !== input.receipt_id) {
    throw new DecisionReportStoreError("PROFILE_HASH_MISMATCH", "Profile receipt differs from job binding");
  }
  return {
    profile_id: rec.profile_id,
    profile_hash: rec.profile_hash,
    structured: rec.chart_structure,
    ziwei_closed_set: rec.ziwei_closed_set,
    registered_at: rec.registered_at,
    calculation_schema_version: rec.calculation_schema_version,
    calculation_timestamp: rec.calculation_timestamp,
  };
}

// ─── Personal Analysis records ─────────────────────────────────────────────

export type StoredAnalysis = {
  record: PersonalAnalysisRecord;
  /** Chart lines the analysis was computed against (pages reuse the same lines). */
  projection: ProfileProjection | null;
};

export function di2AnalysisKey(idempotency_key: string): string {
  return `poju-di2:analysis:${shortHash(idempotency_key)}`;
}

export async function loadAnalysis(idempotency_key: string): Promise<StoredAnalysis | null> {
  const got = await kv.get<StoredAnalysis>(di2AnalysisKey(idempotency_key));
  if (!got || got.record.idempotency_key !== idempotency_key) return null;
  return got;
}

/**
 * Write an analysis record. A completed record is final for its key: later writes
 * (stale workers, failure stamps) never overwrite it.
 */
export async function saveAnalysis(next: StoredAnalysis): Promise<StoredAnalysis> {
  const key = di2AnalysisKey(next.record.idempotency_key);
  const cur = await kv.get<StoredAnalysis>(key);
  if (cur && cur.record.idempotency_key === next.record.idempotency_key && cur.record.status === "completed") {
    return cur;
  }
  await kv.set(key, next, { ex: next.record.status === "completed" ? RETENTION : TTL });
  return next;
}

// ─── Page records ──────────────────────────────────────────────────────────

export type StoredPage = {
  record: DecisionReportPageRecord;
  structured: Di2PageStructured | null;
};

export function di2PageKey(job_id: string, page_id: DecisionPageId): string {
  return `poju-di2:page:${safe(job_id)}:${page_id}`;
}

export async function loadPage(job_id: string, page_id: DecisionPageId): Promise<StoredPage | null> {
  const got = await kv.get<StoredPage>(di2PageKey(job_id, page_id));
  if (!got || got.record.job_id !== job_id || got.record.page_id !== page_id) return null;
  return got;
}

/** Completed pages are checkpoints: a retry of another page never touches them. */
export async function savePage(next: StoredPage): Promise<StoredPage> {
  const key = di2PageKey(next.record.job_id, next.record.page_id);
  const cur = await kv.get<StoredPage>(key);
  if (cur && cur.record.status === "completed" && cur.record.job_id === next.record.job_id) {
    return cur;
  }
  await kv.set(key, next, { ex: next.record.status === "completed" ? RETENTION : TTL });
  return next;
}

export async function loadAllPages(job_id: string): Promise<StoredPage[]> {
  const out: StoredPage[] = [];
  for (const id of DECISION_PAGE_IDS) {
    const p = await loadPage(job_id, id);
    if (p) out.push(p);
  }
  return out;
}

// ─── Completed report (retention record) ───────────────────────────────────

/**
 * The finished book outlives the 2h xhigh job: status falls back to this record once
 * the job itself has expired. Only the minimum the device needs to re-hydrate.
 */
export type CompletedReportRecord = {
  job_id: string;
  session_id: string;
  execution_generation: number;
  freeze_id: string;
  context_hash: string;
  profile_hash: string;
  freeze_receipt_id: string;
  profile_receipt_id: string;
  report_job_id: string;
  result: DecisionReportJobResult;
  analysis: PersonalAnalysisRecord;
  pages: DecisionReportPageRecord[];
};

export function di2CompletedReportKey(session_id: string, job_id: string): string {
  return `poju-di2:report:${safe(session_id)}:${safe(job_id)}`;
}

export async function saveCompletedReport(rec: CompletedReportRecord): Promise<void> {
  await durableKv().set(di2CompletedReportKey(rec.session_id, rec.job_id), rec, { ex: RETENTION });
}

export async function loadCompletedReport(session_id: string, job_id: string): Promise<CompletedReportRecord | null> {
  const got = await durableKv().get<CompletedReportRecord>(di2CompletedReportKey(session_id, job_id));
  if (!got || got.session_id !== session_id || got.job_id !== job_id) return null;
  return got;
}
