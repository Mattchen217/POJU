/**
 * M3 — server-side KV for the Decision Intake 2.0 report chain.
 *
 * The session itself lives only on the device (Never Stored). Report inputs come only
 * from the M4 authority records (server-sealed Freeze, server-recomputed profile);
 * every stage re-reads and re-verifies them — nothing from a request body is trusted.
 *  - Personal Analysis records keyed by the idempotency key.
 *  - Page records keyed by job_id (an execution generation never writes another's pages).
 *  - Completed report record per job: the commit point of a report (written before the
 *    job is marked completed; retention window; status fallback).
 * In-flight artifacts use the xhigh execution TTL; completed ones the product retention.
 */

import { sha256 } from "@noble/hashes/sha2.js";

import { durableKv, kv, KV_TTL } from "@/lib/kv/client";
import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import { DECISION_PAGE_IDS } from "@/lib/llm/pro/delivery/page-feed-matrix";
import { canonicalHash } from "@/lib/poju/decision-authority/hash";
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
  const freeze = await loadVerifiedFreezeRecord(input.session_id, input.freeze_id).catch(authorityFailure);
  if (freeze.frozen_at !== input.frozen_at) {
    throw new DecisionReportStoreError("PROFILE_TIME_MISMATCH", "job Freeze instant differs from the Freeze record");
  }
  const rec = await loadVerifiedProfileRecord({
    session_id: input.session_id,
    freeze,
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

export const DI2_COMPLETED_REPORT_RECORD_VERSION = 1 as const;

/**
 * The finished book. Written once per job (first write wins) before the job is marked
 * completed, so a completed job always has it; it also outlives the 2h xhigh job and
 * status falls back to it. Only what the device needs to re-hydrate the report.
 */
export type CompletedReportRecord = {
  record_version: typeof DI2_COMPLETED_REPORT_RECORD_VERSION;
  job_id: string;
  session_id: string;
  execution_generation: number;
  report_job_id: string;
  freeze_id: string;
  context_id: string;
  context_version: number;
  context_hash: string;
  profile_id: string | null;
  profile_hash: string;
  freeze_receipt_id: string;
  profile_receipt_id: string;
  report_schema_version: string;
  analysis_schema_version: string;
  analysis_id: string;
  result: DecisionReportJobResult;
  analysis: PersonalAnalysisRecord;
  pages: DecisionReportPageRecord[];
  committed_at: string;
  /** canonicalHash of every other field. */
  record_hash: string;
};

export type CompletedReportDraft = Omit<CompletedReportRecord, "record_version" | "record_hash">;

export function di2CompletedReportKey(session_id: string, job_id: string): string {
  return `poju-di2:report:${safe(session_id)}:${safe(job_id)}`;
}

function recordHashOf(rec: Omit<CompletedReportRecord, "record_hash">): string {
  return canonicalHash(rec);
}

function invalid(message: string): never {
  throw new DecisionReportStoreError("REPORT_RECORD_INVALID", message);
}

/**
 * A record is a report only if every part is bound to the same job, generation, Freeze,
 * profile and Personal Analysis, and all eight pages are complete.
 */
export function verifyCompletedReportRecord(rec: CompletedReportRecord): void {
  if (!rec || rec.record_version !== DI2_COMPLETED_REPORT_RECORD_VERSION) invalid("unknown record version");
  const { record_hash, ...body } = rec;
  if (record_hash !== recordHashOf(body)) invalid("record hash mismatch");
  const r = rec.result;
  if (
    !r ||
    r.kind !== "decision_intake_report" ||
    r.report_job_id !== rec.report_job_id ||
    r.freeze_id !== rec.freeze_id ||
    r.context_hash !== rec.context_hash ||
    r.execution_generation !== rec.execution_generation ||
    r.analysis_id !== rec.analysis_id ||
    r.report_schema_version !== rec.report_schema_version ||
    !r.full_text.trim()
  ) {
    invalid("result is not bound to this record");
  }
  const a = rec.analysis;
  if (
    !a ||
    a.status !== "completed" ||
    !a.analysis_result ||
    a.analysis_id !== rec.analysis_id ||
    a.session_id !== rec.session_id ||
    a.freeze_id !== rec.freeze_id ||
    a.context_hash !== rec.context_hash ||
    a.profile_hash !== rec.profile_hash ||
    a.analysis_schema_version !== rec.analysis_schema_version
  ) {
    invalid("Personal Analysis is incomplete or bound elsewhere");
  }
  if (!Array.isArray(rec.pages) || rec.pages.length !== DECISION_PAGE_IDS.length) invalid("page count");
  for (const id of DECISION_PAGE_IDS) {
    const p = rec.pages.find((x) => x.page_id === id);
    if (
      !p ||
      p.status !== "completed" ||
      p.job_id !== rec.job_id ||
      p.execution_generation !== rec.execution_generation ||
      p.freeze_id !== rec.freeze_id ||
      p.context_hash !== rec.context_hash ||
      p.analysis_id !== rec.analysis_id ||
      p.report_schema_version !== rec.report_schema_version ||
      !p.content_markdown.trim()
    ) {
      invalid(`page ${id} is incomplete or bound elsewhere`);
    }
  }
  if (r.page_ids.length !== DECISION_PAGE_IDS.length || DECISION_PAGE_IDS.some((id) => !r.page_ids.includes(id))) {
    invalid("result page list");
  }
}

/** Same report: identity plus page and analysis content (timestamps of a retry are ignored). */
function sameReport(a: CompletedReportRecord, b: CompletedReportDraft): boolean {
  const pageSig = (pages: readonly DecisionReportPageRecord[]) =>
    canonicalHash(DECISION_PAGE_IDS.map((id) => pages.find((p) => p.page_id === id)?.content_markdown ?? null));
  return (
    a.job_id === b.job_id &&
    a.session_id === b.session_id &&
    a.execution_generation === b.execution_generation &&
    a.report_job_id === b.report_job_id &&
    a.freeze_id === b.freeze_id &&
    a.context_hash === b.context_hash &&
    a.profile_hash === b.profile_hash &&
    a.freeze_receipt_id === b.freeze_receipt_id &&
    a.profile_receipt_id === b.profile_receipt_id &&
    a.analysis_id === b.analysis_id &&
    canonicalHash(a.analysis.analysis_result) === canonicalHash(b.analysis.analysis_result) &&
    pageSig(a.pages) === pageSig(b.pages)
  );
}

export function sealCompletedReportRecord(draft: CompletedReportDraft): CompletedReportRecord {
  const body = { ...draft, record_version: DI2_COMPLETED_REPORT_RECORD_VERSION };
  return { ...body, record_hash: recordHashOf(body) };
}

/** Verified read. Corrupt or foreign records are errors, absence is null. */
export async function loadCompletedReport(session_id: string, job_id: string): Promise<CompletedReportRecord | null> {
  const got = await durableKv().get<CompletedReportRecord>(di2CompletedReportKey(session_id, job_id));
  if (!got) return null;
  if (got.session_id !== session_id || got.job_id !== job_id) invalid("record stored under another identity");
  verifyCompletedReportRecord(got);
  return got;
}

/**
 * Idempotent final commit. The first record written for a job is final: a retry of the
 * same report returns it unchanged; a different report for the same job is refused.
 * Success means the record was read back from the durable store.
 */
export async function commitCompletedReport(
  draft: CompletedReportDraft,
): Promise<{ record: CompletedReportRecord; outcome: "written" | "existing" }> {
  const candidate = sealCompletedReportRecord(draft);
  verifyCompletedReportRecord(candidate);
  const key = di2CompletedReportKey(candidate.session_id, candidate.job_id);
  const store = durableKv();

  const reuse = (existing: CompletedReportRecord) => {
    if (!sameReport(existing, draft)) {
      throw new DecisionReportStoreError("REPORT_RECORD_CONFLICT", "a different report is already committed for this job");
    }
    return { record: existing, outcome: "existing" as const };
  };

  const prior = await loadCompletedReport(candidate.session_id, candidate.job_id);
  if (prior) return reuse(prior);

  const set = await store.set(key, candidate, { ex: RETENTION, nx: true });
  const back = await loadCompletedReport(candidate.session_id, candidate.job_id);
  if (!back) {
    throw new DecisionReportStoreError("REPORT_PERSIST_UNCONFIRMED", "report record not readable after write");
  }
  if (set !== "OK" || back.record_hash !== candidate.record_hash) return reuse(back);
  return { record: back, outcome: "written" };
}

/** A generation that lost the fence after writing its record takes it back. */
export async function withdrawCompletedReport(session_id: string, job_id: string, execution_generation: number): Promise<void> {
  const key = di2CompletedReportKey(session_id, job_id);
  const got = await durableKv().get<CompletedReportRecord>(key);
  if (got && got.execution_generation === execution_generation) await durableKv().del(key);
}

// ─── Worker dispatch marker ────────────────────────────────────────────────

/**
 * A stage hand-off is in flight for this many seconds: long enough to cover a relay
 * publish + attach wait, so recovery never doubles a hop that is about to start.
 */
export const DI2_DISPATCH_GRACE_S = 45;

export type DecisionReportDispatchMarker = { stage: string; at: number };

export function di2DispatchKey(job_id: string): string {
  return `poju-di2:dispatch:${safe(job_id)}`;
}

export async function markDecisionReportDispatch(job_id: string, stage: string): Promise<void> {
  await kv.set(di2DispatchKey(job_id), { stage, at: Date.now() }, { ex: DI2_DISPATCH_GRACE_S });
}

/** Single-flight: only one caller may dispatch a recovery hop per grace window. */
export async function claimDecisionReportDispatch(job_id: string, stage: string): Promise<boolean> {
  const set = await kv.set(di2DispatchKey(job_id), { stage, at: Date.now() }, { ex: DI2_DISPATCH_GRACE_S, nx: true });
  return set === "OK";
}

export async function loadDecisionReportDispatch(job_id: string): Promise<DecisionReportDispatchMarker | null> {
  return kv.get<DecisionReportDispatchMarker>(di2DispatchKey(job_id));
}

/** A dispatch known to have failed must not hold off the next recovery for the grace window. */
export async function clearDecisionReportDispatch(job_id: string): Promise<void> {
  await kv.del(di2DispatchKey(job_id));
}

// ─── Charge marker ─────────────────────────────────────────────────────────

export function di2ChargedKey(session_id: string): string {
  return `poju-di2:charged:${safe(session_id)}`;
}

/** The session's report was charged once; later generations for it are not charged again. */
export async function hasDecisionReportCharge(session_id: string): Promise<boolean> {
  return (await durableKv().get(di2ChargedKey(session_id))) != null;
}

export async function markDecisionReportCharged(session_id: string): Promise<void> {
  await durableKv().set(di2ChargedKey(session_id), { at: Date.now() }, { ex: RETENTION });
}
