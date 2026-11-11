/**
 * M3 — browser driver for the Decision Intake 2.0 report.
 *
 * Freeze → /api/poju/decision-report start → poll status → mirror the Personal
 * Analysis record and per-page checkpoints into the device session
 * (`personal_analysis_records`, `freeze_bound_report_jobs`, source DI2) → on
 * completion verify all eight pages against the Freeze binding, then hydrate the
 * book through the same delivery display / archive path as the legacy report.
 *
 * Never calls the legacy /api/poju/final-delivery and never needs agent_v2,
 * breakthrough_core or covered_agenda.
 */

import { DECISION_PAGE_IDS } from "@/lib/llm/pro/delivery/page-feed-matrix";
import type { POJUSessionState } from "@/lib/poju/types";
import {
  freezeReceiptFor,
  loadFreezeProfileInput,
  profileReceiptFor,
  withFreezeReceipts,
} from "@/lib/poju/decision-authority/client-freeze";
import { getDecisionAuthorityTransport } from "@/lib/poju/decision-authority/client-transport";
import type { FreezeReceipt, ProfileReceipt } from "@/lib/poju/decision-authority/types";
import {
  DI2_REPORT_SCHEMA_VERSION,
  DI2_REPORT_SOURCE,
  type DecisionReportPageRecord,
  type DecisionReportStatusPayload,
  type PersonalAnalysisRecord,
} from "./decision-report-types";
import { renderDi2BookMarkdown } from "./decision-report-render";
import {
  assertCompleteEightPageReport,
  loadAuthoritativeFreeze,
  M22_SNAPSHOT_SCHEMA_VERSION,
  type FreezeBoundReportJob,
  type FreezeBoundReportJobStatus,
  type FreezeBoundReportPage,
} from "./freeze-bound-report";

const POLL_MS = 4_000;
const ENDPOINT = "/api/poju/decision-report";

/** Server can no longer run this job — start a new generation for the same Freeze. */
const REGENERATE_FALLBACK_CODES = new Set([
  "JOB_MISSING",
  "JOB_BUDGET_EXHAUSTED",
  "SUPERSEDED_BY_DEPLOY",
  "SUPERSEDED",
  "NOT_REVIVABLE",
]);

export class DecisionReportClientError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly status: number;
  constructor(code: string, message: string, opts?: { retryable?: boolean; status?: number }) {
    super(message);
    this.name = "DecisionReportClientError";
    this.code = code;
    this.retryable = opts?.retryable ?? false;
    this.status = opts?.status ?? 0;
  }
}

export type DecisionReportProgress = {
  job_id: string;
  phase: "starting" | "analysis" | "pages" | "assembling" | "completed" | "failed";
  analysis_status: string;
  pages_completed: number;
  pages_total: number;
  /** Book markdown from completed pages only (never marks the report complete). */
  partial_markdown: string;
  job_status: DecisionReportStatusPayload["status"];
};

export type DecisionReportRunOpts = {
  regenerate?: boolean;
  signal?: AbortSignal;
  onProgress?: (p: DecisionReportProgress) => void;
  /** Persist each mirrored checkpoint (default: savePOJUSession). */
  persist?: (session: POJUSessionState) => Promise<void>;
};

/** Fresh DI2 sessions carry a Blueprint; legacy sessions never do. */
export function isDecisionIntakeV2Session(session: POJUSessionState | null | undefined): boolean {
  return Boolean(session?.decision_blueprint);
}

export function currentDi2FreezeId(session: POJUSessionState): string | null {
  const dc = session.decision_context;
  if (!isDecisionIntakeV2Session(session) || !dc || dc.status !== "final") return null;
  return `${dc.context_id}@v${dc.version}`;
}

function di2Rows(session: POJUSessionState): FreezeBoundReportJob[] {
  return (session.freeze_bound_report_jobs ?? []).filter((j) => j.source === DI2_REPORT_SOURCE);
}

/** Newest DI2 report row for a Freeze (highest execution generation). */
export function latestDi2ReportRow(
  session: POJUSessionState,
  freezeId: string,
): FreezeBoundReportJob | null {
  const rows = di2Rows(session).filter((j) => j.binding.freezeId === freezeId);
  if (!rows.length) return null;
  return rows.sort((a, b) => (b.execution_generation ?? 0) - (a.execution_generation ?? 0))[0]!;
}

/** Freeze is final and nothing has been started for it yet on this device. */
export function di2ReportNeedsAutoStart(session: POJUSessionState): boolean {
  const freezeId = currentDi2FreezeId(session);
  if (!freezeId) return false;
  if (session.pending_decision_report_job_id) return false;
  return latestDi2ReportRow(session, freezeId) == null;
}

/** A started report for the current Freeze is unfinished and should be resumed. */
export function di2ReportShouldResume(session: POJUSessionState): boolean {
  return Boolean(currentDi2FreezeId(session) && session.pending_decision_report_job_id);
}

async function defaultPersist(session: POJUSessionState): Promise<void> {
  const { savePOJUSession } = await import("@/lib/poju/session-manager");
  await savePOJUSession(session);
}

async function post<T>(body: Record<string, unknown>, signal?: AbortSignal): Promise<{ status: number; json: T }> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const json = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, json };
}

type StartResponse = {
  ok: boolean;
  job_id?: string;
  status?: string;
  reused?: boolean;
  execution_generation?: number | null;
  error?: string;
  code?: string;
  retryable?: boolean;
};

function rowStatusFrom(payload: DecisionReportStatusPayload): FreezeBoundReportJobStatus {
  switch (payload.status) {
    case "completed":
      return "generating"; // promoted to completed only after client-side integrity check
    case "failed":
    case "missing":
      return "failed";
    case "running":
      return "generating";
    default:
      return "queued";
  }
}

function mirrorAnalysis(session: POJUSessionState, record: PersonalAnalysisRecord | null): POJUSessionState {
  if (!record) return session;
  const rest = (session.personal_analysis_records ?? []).filter((r) => r.analysis_id !== record.analysis_id);
  const prior = (session.personal_analysis_records ?? []).find((r) => r.analysis_id === record.analysis_id);
  // Never let an older poll overwrite a completed record.
  if (prior?.status === "completed" && record.status !== "completed") return session;
  return { ...session, personal_analysis_records: [...rest, record] };
}

function pagesFromRecords(records: readonly DecisionReportPageRecord[]): FreezeBoundReportPage[] {
  return records.map((r) => ({
    pageId: r.page_id,
    content: r.status === "completed" ? r.content_markdown : "",
    status: r.status === "completed" ? "completed" : r.status === "failed" ? "failed" : "empty",
    generated_at: r.generated_at ?? new Date().toISOString(),
    error: r.error,
    applicability: r.applicability,
  }));
}

function mirrorRow(
  session: POJUSessionState,
  payload: DecisionReportStatusPayload,
  freeze: { freezeId: string; context_id: string; version: number; content_hash: string },
): POJUSessionState {
  const report_job_id = payload.report_job_id;
  if (!report_job_id) return session;
  const now = new Date().toISOString();
  const rows = session.freeze_bound_report_jobs ?? [];
  const prior = rows.find((j) => j.job_id === report_job_id);
  // Completed rows are immutable; a stale poll never downgrades them.
  if (prior?.status === "completed") return session;
  const row: FreezeBoundReportJob = {
    job_id: report_job_id,
    idempotency_key: report_job_id,
    status: rowStatusFrom(payload),
    binding: {
      sessionId: session.session_id,
      freezeId: freeze.freezeId,
      decisionContextVersion: freeze.version,
      contentHash: freeze.content_hash,
      snapshotSchemaVersion: M22_SNAPSHOT_SCHEMA_VERSION,
      reportSchemaVersion: DI2_REPORT_SCHEMA_VERSION,
      contextId: freeze.context_id,
    },
    pages: pagesFromRecords(payload.pages),
    created_at: prior?.created_at ?? now,
    updated_at: now,
    error: payload.error,
    completed_at: null,
    source: DI2_REPORT_SOURCE,
    xhigh_job_id: payload.job_id,
    execution_generation: payload.execution_generation,
    analysis_id: payload.analysis.analysis_id,
    profile_hash: payload.profile_hash,
  };
  return {
    ...session,
    freeze_bound_report_jobs: [...rows.filter((j) => j.job_id !== report_job_id), row],
  };
}

function partialBook(session: POJUSessionState, payload: DecisionReportStatusPayload, locale: string): string {
  const done = payload.pages.filter((p) => p.status === "completed");
  if (!done.length) return "";
  const dc = session.decision_context;
  return renderDi2BookMarkdown({
    pages: done,
    locale,
    question: dc?.definition.decision_question ?? session.decision_blueprint?.decision_question ?? "",
    binding: {
      context_id: dc?.context_id ?? "",
      context_version: dc?.version ?? 0,
      context_hash: dc?.content_hash ?? "",
    },
    report_id: `POJU-${session.session_id.slice(0, 8)}`,
    generated_at: new Date().toISOString(),
  });
}

function progressPhase(payload: DecisionReportStatusPayload): DecisionReportProgress["phase"] {
  if (payload.status === "completed") return "completed";
  if (payload.status === "failed" || payload.status === "missing") return "failed";
  if (payload.analysis.status !== "completed") return "analysis";
  if (payload.current_stage === "assemble") return "assembling";
  return "pages";
}

/** Verify the server book against this device's Freeze before showing it as complete. */
function verifyCompletedReport(
  payload: DecisionReportStatusPayload,
  freeze: { freezeId: string; content_hash: string },
): void {
  const result = payload.result;
  if (!result) throw new DecisionReportClientError("REPORT_RESULT_MISSING", "Completed job has no result", { retryable: true });
  if (result.freeze_id !== freeze.freezeId || result.context_hash !== freeze.content_hash) {
    throw new DecisionReportClientError("REPORT_BINDING_MISMATCH", "Report is not bound to this Freeze");
  }
  const pages = DECISION_PAGE_IDS.map((id) => {
    const p = payload.pages.find((r) => r.page_id === id);
    if (!p || p.status !== "completed") {
      throw new DecisionReportClientError("REPORT_INCOMPLETE", `Page ${id} is not completed`, { retryable: true });
    }
    if (p.freeze_id !== freeze.freezeId || p.context_hash !== freeze.content_hash) {
      throw new DecisionReportClientError("REPORT_BINDING_MISMATCH", `Page ${id} belongs to another Freeze`);
    }
    return { pageId: id, content: p.content_markdown };
  });
  assertCompleteEightPageReport(pages);
}

async function pollUntilDone(
  initial: POJUSessionState,
  job_id: string,
  locale: string,
  freeze: { freezeId: string; context_id: string; version: number; content_hash: string },
  opts: DecisionReportRunOpts,
): Promise<POJUSessionState> {
  const persist = opts.persist ?? defaultPersist;
  let session = initial;
  let lastSig = "";
  for (;;) {
    if (opts.signal?.aborted) return session;
    let payload: DecisionReportStatusPayload;
    try {
      const r = await post<DecisionReportStatusPayload>(
        { action: "status", session_id: session.session_id, job_id },
        opts.signal,
      );
      payload = r.json;
    } catch (e) {
      if (opts.signal?.aborted) return session;
      // Network blip: keep polling; the job runs server-side regardless.
      await new Promise((r) => setTimeout(r, POLL_MS));
      continue;
    }
    if (!payload || typeof payload !== "object" || !("status" in payload)) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      continue;
    }

    session = mirrorAnalysis(session, payload.analysis.record);
    session = mirrorRow(session, payload, freeze);
    const sig = `${payload.status}|${payload.current_stage}|${payload.analysis.status}|${payload.pages
      .map((p) => `${p.page_id}:${p.status}`)
      .join(",")}`;
    if (sig !== lastSig) {
      lastSig = sig;
      await persist(session);
    }
    opts.onProgress?.({
      job_id,
      phase: progressPhase(payload),
      analysis_status: payload.analysis.status,
      pages_completed: payload.pages.filter((p) => p.status === "completed").length,
      pages_total: DECISION_PAGE_IDS.length,
      partial_markdown: partialBook(session, payload, locale),
      job_status: payload.status,
    });

    if (payload.status === "completed") {
      verifyCompletedReport(payload, freeze);
      const result = payload.result!;
      const now = new Date().toISOString();
      const { applyFinalDeliveryResultToSession } = await import("@/lib/llm/pro/final-delivery");
      session = {
        ...session,
        freeze_bound_report_jobs: (session.freeze_bound_report_jobs ?? []).map((j) =>
          j.job_id === result.report_job_id ? { ...j, status: "completed", completed_at: now, updated_at: now, error: null } : j,
        ),
        last_delivery_context_binding: {
          context_id: freeze.context_id,
          context_version: freeze.version,
          context_hash: freeze.content_hash,
        },
      };
      session = applyFinalDeliveryResultToSession(
        session,
        {
          full_text: result.full_text,
          actions: [],
          model: result.model,
          tokens_used: result.tokens_used,
          latency_ms: 0,
          cost_usd: 0,
        },
        locale,
      );
      session = { ...session, pending_decision_report_job_id: null };
      await persist(session);
      return session;
    }

    if (payload.status === "failed" || payload.status === "missing") {
      if (!payload.retryable || payload.status === "missing") {
        session = { ...session, pending_decision_report_job_id: payload.status === "missing" ? null : session.pending_decision_report_job_id };
      }
      await persist(session);
      throw new DecisionReportClientError(
        payload.status === "missing" ? "JOB_MISSING" : "REPORT_FAILED",
        payload.error ?? "Report generation failed",
        { retryable: payload.retryable },
      );
    }

    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

function freezeOf(session: POJUSessionState) {
  const freezeId = currentDi2FreezeId(session);
  if (!freezeId) {
    throw new DecisionReportClientError("FREEZE_REQUIRED", "This session has no confirmed Freeze yet");
  }
  const { frozen, binding } = loadAuthoritativeFreeze(session, { freezeId });
  return {
    frozen,
    freeze: {
      freezeId,
      context_id: binding.context_id,
      version: binding.context_version,
      content_hash: binding.context_hash,
    },
  };
}

type ReportAuthority = {
  session: POJUSessionState;
  writer_token: string;
  freeze_receipt: FreezeReceipt;
  profile_receipt: ProfileReceipt;
};

/**
 * The report starts only from server-signed receipts. A profile receipt missing for this
 * Freeze (no birth at seal time, or lost) is obtained by asking the server to recompute
 * the profile at the Freeze instant — the device never sends a computed chart.
 */
async function ensureReportAuthority(
  initial: POJUSessionState,
  freeze: { freezeId: string; content_hash: string },
  opts: DecisionReportRunOpts,
): Promise<ReportAuthority> {
  let session = initial;
  const writer_token = session.dc_ledger?.writer_token ?? "";
  const freeze_receipt = freezeReceiptFor(session, freeze.freezeId);
  if (!writer_token || !freeze_receipt) {
    throw new DecisionReportClientError(
      "FREEZE_NOT_SERVER_SEALED",
      "This Freeze has no server receipt; only a server-sealed Freeze can start a report",
    );
  }
  if (freeze_receipt.context_hash !== freeze.content_hash) {
    throw new DecisionReportClientError("FREEZE_RECEIPT_MISMATCH", "Freeze receipt does not match the session Freeze");
  }
  let profile_receipt = profileReceiptFor(session, freeze.freezeId);
  if (!profile_receipt) {
    const profile = await loadFreezeProfileInput(session);
    if (!profile) {
      throw new DecisionReportClientError(
        "PROFILE_REQUIRED",
        "A personal profile with birth data is required for the report",
      );
    }
    let res;
    try {
      res = await getDecisionAuthorityTransport().registerProfile({
        session_id: session.session_id,
        writer_token,
        freeze_receipt,
        profile_id: profile.profile_id,
        birth_info: profile.birth_info,
      });
    } catch (e) {
      throw new DecisionReportClientError(
        "DC_AUTHORITY_UNREACHABLE",
        e instanceof Error ? e.message : "decision authority unreachable",
        { retryable: true },
      );
    }
    if (!res.ok) {
      throw new DecisionReportClientError(res.code, res.error, { retryable: res.retryable });
    }
    profile_receipt = res.receipt;
    session = { ...session, ...withFreezeReceipts(session, freeze_receipt, profile_receipt) };
    await (opts.persist ?? defaultPersist)(session);
  }
  return { session, writer_token, freeze_receipt, profile_receipt };
}

/**
 * Start (or reuse) the report for the current Freeze and follow it to completion.
 * `regenerate` starts a new execution generation; the previous generation's row and
 * pages stay intact in the session.
 */
export async function runDecisionReportForSession(
  initialSession: POJUSessionState,
  locale: string,
  opts: DecisionReportRunOpts = {},
): Promise<POJUSessionState> {
  let session = initialSession;
  const { freeze } = freezeOf(session);
  const persist = opts.persist ?? defaultPersist;

  if (!opts.regenerate && session.pending_decision_report_job_id) {
    return pollUntilDone(session, session.pending_decision_report_job_id, locale, freeze, opts);
  }

  const authority = await ensureReportAuthority(session, freeze, opts);
  session = authority.session;

  opts.onProgress?.({
    job_id: "",
    phase: "starting",
    analysis_status: "missing",
    pages_completed: 0,
    pages_total: DECISION_PAGE_IDS.length,
    partial_markdown: "",
    job_status: "pending",
  });

  const { status, json } = await post<StartResponse>(
    {
      action: "start",
      session_id: session.session_id,
      locale,
      regenerate: opts.regenerate === true,
      writer_token: authority.writer_token,
      freeze_receipt: authority.freeze_receipt,
      profile_receipt: authority.profile_receipt,
    },
    opts.signal,
  );
  if (!json.ok || !json.job_id) {
    throw new DecisionReportClientError(json.code ?? json.error ?? "REPORT_START_FAILED", json.error ?? "Report start failed", {
      retryable: json.retryable === true,
      status,
    });
  }

  const started: POJUSessionState = { ...session, pending_decision_report_job_id: json.job_id };
  await persist(started);
  return pollUntilDone(started, json.job_id, locale, freeze, opts);
}

/**
 * Continue an interrupted report from its checkpoints (same job, same Freeze).
 * Falls back to a new generation for the same Freeze when the job can no longer run.
 */
export async function continueDecisionReportForSession(
  session: POJUSessionState,
  locale: string,
  opts: Omit<DecisionReportRunOpts, "regenerate"> = {},
): Promise<POJUSessionState> {
  const { freeze } = freezeOf(session);
  const job_id = session.pending_decision_report_job_id;
  if (!job_id) {
    return runDecisionReportForSession(session, locale, { ...opts, regenerate: true });
  }
  const { status, json } = await post<StartResponse>(
    { action: "continue", session_id: session.session_id, job_id },
    opts.signal,
  );
  if (!json.ok) {
    const code = json.code ?? "CONTINUE_FAILED";
    if (code === "JOB_RUNNING") return pollUntilDone(session, job_id, locale, freeze, opts);
    if (REGENERATE_FALLBACK_CODES.has(code)) {
      return runDecisionReportForSession(
        { ...session, pending_decision_report_job_id: null },
        locale,
        { ...opts, regenerate: true },
      );
    }
    throw new DecisionReportClientError(code, json.error ?? "Continue failed", {
      retryable: json.retryable === true,
      status,
    });
  }
  return pollUntilDone(session, job_id, locale, freeze, opts);
}
