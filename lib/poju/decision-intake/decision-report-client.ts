/**
 * M3 — browser driver for the Decision Intake 2.0 report.
 *
 * Freeze → /api/poju/decision-report start → poll status → mirror the Personal
 * Analysis record and per-page checkpoints into the device session
 * (`personal_analysis_records`, `freeze_bound_report_jobs`, source DI2) → on
 * completion verify all eight pages against the Freeze binding, then hydrate the
 * book through the same delivery display / archive path as the legacy report.
 *
 * M5 — recovery on reopen / interruption, one driver per session:
 *   pending / running      poll; a job reported without a worker gets one (continue)
 *   completed              verify against this device's Freeze, then one local commit
 *   interrupted            Continue the same job from its checkpoints (bounded, automatic)
 *   quality 1+1 spent      stop; Continue only on user request
 *   permanently failed     stop with the error; no automatic retry
 *   missing / expired      status already falls back to the committed report; only when
 *                          none exists, one new generation for the same Freeze
 * A local save failure never counts as delivered: the job id stays pending and the
 * report is fetched again from the server.
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
/** Automatic Continue of interrupted runs per driver run (the server hop/wall budgets still apply). */
const MAX_AUTO_CONTINUES = 2;
/** Consecutive polls without any worker before asking the server to dispatch one. */
const IDLE_POLLS_BEFORE_ENSURE = 2;

/** Server can no longer run this job — start a new generation for the same Freeze. */
const REGENERATE_FALLBACK_CODES = new Set([
  "JOB_MISSING",
  "JOB_BUDGET_EXHAUSTED",
  "SUPERSEDED_BY_DEPLOY",
  "SUPERSEDED",
  "NOT_REVIVABLE",
]);

/** Continue answers that mean "keep polling" (a revived job without a worker is re-ensured by polling). */
const POLL_ON_CODES = new Set(["JOB_RUNNING", "REPORT_JOB_BUSY", "ALREADY_COMPLETED", "DISPATCH_FAILED"]);
/** Worker re-dispatch requests per driver run before the run stops as retryable. */
const MAX_WORKER_ENSURES = 6;

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
  /** Latest stored Session, used when the final write lost a revision race (default: loadPOJUSession). */
  reload?: (session_id: string) => Promise<POJUSessionState | null>;
  /** Poll interval override (tests). */
  pollMs?: number;
};

export type DecisionReportStatusClass =
  | "pending"
  | "running"
  | "completed"
  /** Infrastructure interruption: Continue from checkpoints, automatically. */
  | "retryable_failed"
  /** A unit spent its production 1+1 on output quality: Continue only on user request. */
  | "needs_user_continue"
  | "permanent_failed"
  | "missing";

export function classifyDecisionReportStatus(p: Pick<DecisionReportStatusPayload, "status" | "retryable" | "failure_reason">): DecisionReportStatusClass {
  switch (p.status) {
    case "pending":
    case "running":
    case "completed":
    case "missing":
      return p.status;
    default:
      if (!p.retryable) return "permanent_failed";
      return p.failure_reason === "quality_exhausted" ? "needs_user_continue" : "retryable_failed";
  }
}

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

async function defaultReload(session_id: string): Promise<POJUSessionState | null> {
  const { loadPOJUSession } = await import("@/lib/poju/session-manager");
  return loadPOJUSession(session_id);
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

// ─── one driver per session (tabs, mounts) ─────────────────────────────────

type ReleaseDriver = () => void;
const localDrivers = new Set<string>();

type LockManagerLike = {
  request: (
    name: string,
    opts: { ifAvailable: boolean },
    cb: (lock: unknown) => Promise<void> | void,
  ) => Promise<unknown>;
};

/**
 * Only the driver may Continue / dispatch / regenerate; everyone else just polls.
 * Cross-tab via the Web Locks API when present, otherwise per JS realm.
 */
async function tryAcquireReportDriver(session_id: string): Promise<ReleaseDriver | null> {
  const key = `poju-di2-report:${session_id}`;
  const locks = (globalThis as { navigator?: { locks?: LockManagerLike } }).navigator?.locks;
  if (locks && typeof locks.request === "function") {
    return new Promise<ReleaseDriver | null>((resolve) => {
      locks
        .request(key, { ifAvailable: true }, (lock) => {
          if (!lock) {
            resolve(null);
            return;
          }
          return new Promise<void>((release) => resolve(() => release()));
        })
        .catch(() => resolve(null));
    });
  }
  if (localDrivers.has(key)) return null;
  localDrivers.add(key);
  return () => localDrivers.delete(key);
}

// ─── session mirroring ─────────────────────────────────────────────────────

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

type FreezeRef = { freezeId: string; context_id: string; version: number; content_hash: string };

function mirrorRow(session: POJUSessionState, payload: DecisionReportStatusPayload, freeze: FreezeRef): POJUSessionState {
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

// ─── completion ────────────────────────────────────────────────────────────

function bindingMismatch(message: string): never {
  throw new DecisionReportClientError("REPORT_BINDING_MISMATCH", message);
}

/**
 * Verify the server book against this device's Freeze before showing it as complete:
 * the job polled, one execution generation, this Freeze and content hash, one completed
 * Personal Analysis (and this profile, when the device holds its receipt), eight pages.
 */
function verifyCompletedReport(
  payload: DecisionReportStatusPayload,
  expected: { job_id: string; freeze: FreezeRef; profile_hash: string | null },
): void {
  const { freeze } = expected;
  const result = payload.result;
  if (!result) throw new DecisionReportClientError("REPORT_RESULT_MISSING", "Completed job has no result", { retryable: true });
  const gen = payload.execution_generation;
  if (payload.job_id !== expected.job_id) bindingMismatch("Report belongs to another job");
  if (typeof gen !== "number" || result.execution_generation !== gen) bindingMismatch("Report generation mismatch");
  if (result.report_job_id !== payload.report_job_id) bindingMismatch("Report row mismatch");
  if (
    result.freeze_id !== freeze.freezeId ||
    result.context_hash !== freeze.content_hash ||
    payload.freeze_id !== freeze.freezeId ||
    payload.context_hash !== freeze.content_hash
  ) {
    bindingMismatch("Report is not bound to this Freeze");
  }
  if (expected.profile_hash && payload.profile_hash !== expected.profile_hash) bindingMismatch("Report is bound to another profile");
  const a = payload.analysis.record;
  if (
    !a ||
    a.status !== "completed" ||
    !a.analysis_result ||
    a.analysis_id !== result.analysis_id ||
    a.freeze_id !== freeze.freezeId ||
    a.context_hash !== freeze.content_hash ||
    a.profile_hash !== payload.profile_hash
  ) {
    throw new DecisionReportClientError("REPORT_ANALYSIS_INCOMPLETE", "Personal Analysis is incomplete or bound elsewhere");
  }
  const pages = DECISION_PAGE_IDS.map((id) => {
    const p = payload.pages.find((r) => r.page_id === id);
    if (!p || p.status !== "completed") {
      throw new DecisionReportClientError("REPORT_INCOMPLETE", `Page ${id} is not completed`, { retryable: true });
    }
    if (p.freeze_id !== freeze.freezeId || p.context_hash !== freeze.content_hash) {
      bindingMismatch(`Page ${id} belongs to another Freeze`);
    }
    if (p.job_id !== payload.job_id || p.execution_generation !== gen || p.analysis_id !== result.analysis_id) {
      bindingMismatch(`Page ${id} belongs to another job or generation`);
    }
    return { pageId: id, content: p.content_markdown };
  });
  assertCompleteEightPageReport(pages);
}

/**
 * One local write for the delivered report: analysis, eight-page row (completed),
 * delivery body (existing display / archive path), Freeze binding, pending cleared.
 * If it fails the report is not delivered on this device; the pending job id stays
 * in storage so the next open fetches it again.
 */
async function commitCompletedReportToSession(
  session: POJUSessionState,
  payload: DecisionReportStatusPayload,
  locale: string,
  freeze: FreezeRef,
  persist: (s: POJUSessionState) => Promise<void>,
  reload: (session_id: string) => Promise<POJUSessionState | null>,
): Promise<POJUSessionState> {
  verifyCompletedReport(payload, {
    job_id: payload.job_id ?? "",
    freeze,
    profile_hash: profileReceiptFor(session, freeze.freezeId)?.profile_hash ?? null,
  });
  const report_job_id = payload.result!.report_job_id;
  let next = await withCompletedReport(session, payload, locale, freeze);
  try {
    await persist(next);
    return next;
  } catch (e) {
    if (!isStaleSessionWrite(e)) throw localSaveFailed(e);
  }
  // Another writer (tab, chat turn) moved the stored Session: re-apply onto the latest.
  let latest: POJUSessionState | null;
  try {
    latest = await reload(session.session_id);
  } catch (e) {
    throw localSaveFailed(e);
  }
  if (!latest || currentDi2FreezeId(latest) !== freeze.freezeId) {
    throw localSaveFailed(new Error("stored Session no longer holds this Freeze"));
  }
  const row = (latest.freeze_bound_report_jobs ?? []).find((j) => j.job_id === report_job_id);
  if (row?.status === "completed" && latest.main_delivery_done && !latest.pending_decision_report_job_id) {
    return latest;
  }
  next = await withCompletedReport(latest, payload, locale, freeze);
  try {
    await persist(next);
  } catch (e) {
    throw localSaveFailed(e);
  }
  return next;
}

function isStaleSessionWrite(e: unknown): boolean {
  return (e as { name?: string } | null)?.name === "SessionCasError";
}

function localSaveFailed(e: unknown): DecisionReportClientError {
  return new DecisionReportClientError(
    "LOCAL_SAVE_FAILED",
    `Report is complete on the server but could not be saved on this device: ${e instanceof Error ? e.message : String(e)}`,
    { retryable: true },
  );
}

/** Session with the verified report applied (no I/O). */
async function withCompletedReport(
  session: POJUSessionState,
  payload: DecisionReportStatusPayload,
  locale: string,
  freeze: FreezeRef,
): Promise<POJUSessionState> {
  const result = payload.result!;
  const now = new Date().toISOString();
  let next = mirrorAnalysis(session, payload.analysis.record);
  next = mirrorRow(next, payload, freeze);
  next = {
    ...next,
    freeze_bound_report_jobs: (next.freeze_bound_report_jobs ?? []).map((j) =>
      j.job_id === result.report_job_id
        ? { ...j, status: "completed", pages: pagesFromRecords(payload.pages), completed_at: now, updated_at: now, error: null }
        : j,
    ),
    last_delivery_context_binding: {
      context_id: freeze.context_id,
      context_version: freeze.version,
      context_hash: freeze.content_hash,
    },
  };
  const { applyFinalDeliveryResultToSession } = await import("@/lib/llm/pro/final-delivery");
  next = applyFinalDeliveryResultToSession(
    next,
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
  return { ...next, pending_decision_report_job_id: null };
}

// ─── start / continue requests ─────────────────────────────────────────────

function freezeOf(session: POJUSessionState): { freeze: FreezeRef } {
  const freezeId = currentDi2FreezeId(session);
  if (!freezeId) {
    throw new DecisionReportClientError("FREEZE_REQUIRED", "This session has no confirmed Freeze yet");
  }
  const { binding } = loadAuthoritativeFreeze(session, { freezeId });
  return {
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

/** Start (or reuse) the job for this Freeze and record its id before anything else. */
async function startReportJob(
  initial: POJUSessionState,
  locale: string,
  freeze: FreezeRef,
  opts: DecisionReportRunOpts,
  regenerate: boolean,
): Promise<{ session: POJUSessionState; job_id: string }> {
  const authority = await ensureReportAuthority(initial, freeze, opts);
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
      session_id: authority.session.session_id,
      locale,
      regenerate,
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
  const session: POJUSessionState = { ...authority.session, pending_decision_report_job_id: json.job_id };
  try {
    await (opts.persist ?? defaultPersist)(session);
  } catch (e) {
    // The server job exists; a later start for this Freeze reuses it (no new charge).
    throw new DecisionReportClientError(
      "LOCAL_SAVE_FAILED",
      `Report started but could not be recorded on this device: ${e instanceof Error ? e.message : String(e)}`,
      { retryable: true },
    );
  }
  return { session, job_id: json.job_id };
}

async function postContinue(
  session_id: string,
  job_id: string,
  signal?: AbortSignal,
): Promise<{ status: number; json: StartResponse }> {
  return post<StartResponse>({ action: "continue", session_id, job_id }, signal);
}

// ─── poll + recovery ───────────────────────────────────────────────────────

type Recovery = { continues: number; ensures: number; regenerated: boolean; idlePolls: number };

function freshRecovery(): Recovery {
  return { continues: 0, ensures: 0, regenerated: false, idlePolls: 0 };
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return;
  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    }, { once: true });
  });
}

async function pollUntilDone(
  initial: POJUSessionState,
  initialJobId: string,
  locale: string,
  freeze: FreezeRef,
  opts: DecisionReportRunOpts,
  recovery: Recovery = freshRecovery(),
): Promise<POJUSessionState> {
  const persist = opts.persist ?? defaultPersist;
  const pollMs = opts.pollMs ?? POLL_MS;
  let session = initial;
  let job_id = initialJobId;
  let lastSig = "";
  let release = await tryAcquireReportDriver(session.session_id);
  const saveCheckpoint = async (s: POJUSessionState) => {
    // Progress mirrors are best-effort: the server keeps every checkpoint.
    await persist(s).catch((e) => console.warn("[poju] report checkpoint save failed", e));
  };
  const regenerate = async (): Promise<boolean> => {
    if (recovery.regenerated) return false;
    recovery.regenerated = true;
    const started = await startReportJob(session, locale, freeze, opts, true);
    session = started.session;
    job_id = started.job_id;
    recovery.idlePolls = 0;
    lastSig = "";
    return true;
  };

  try {
    for (;;) {
      if (opts.signal?.aborted) return session;
      if (!release) release = await tryAcquireReportDriver(session.session_id);
      const driver = release != null;

      let payload: DecisionReportStatusPayload;
      try {
        payload = (await post<DecisionReportStatusPayload>({ action: "status", session_id: session.session_id, job_id }, opts.signal)).json;
      } catch {
        if (opts.signal?.aborted) return session;
        await sleep(pollMs, opts.signal);
        continue;
      }
      if (!payload || typeof payload !== "object" || !("status" in payload)) {
        await sleep(pollMs, opts.signal);
        continue;
      }

      const cls = classifyDecisionReportStatus(payload);
      if (cls === "completed") {
        return await commitCompletedReportToSession(session, payload, locale, freeze, persist, opts.reload ?? defaultReload);
      }

      session = mirrorAnalysis(session, payload.analysis.record);
      session = mirrorRow(session, payload, freeze);
      const sig = `${payload.status}|${payload.current_stage}|${payload.analysis.status}|${payload.pages
        .map((p) => `${p.page_id}:${p.status}`)
        .join(",")}`;
      if (sig !== lastSig) {
        lastSig = sig;
        await saveCheckpoint(session);
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

      if (cls === "pending" || cls === "running") {
        recovery.idlePolls = payload.worker === "none" ? recovery.idlePolls + 1 : 0;
        if (driver && recovery.idlePolls >= IDLE_POLLS_BEFORE_ENSURE) {
          recovery.idlePolls = 0;
          recovery.ensures += 1;
          if (recovery.ensures > MAX_WORKER_ENSURES) {
            await saveCheckpoint(session);
            throw new DecisionReportClientError("WORKER_UNAVAILABLE", "Report worker could not be started", {
              retryable: true,
            });
          }
          const r = await postContinue(session.session_id, job_id, opts.signal).catch(() => null);
          const code = r?.json.code ?? "";
          if (r && !r.json.ok && REGENERATE_FALLBACK_CODES.has(code) && (await regenerate())) continue;
        }
        await sleep(pollMs, opts.signal);
        continue;
      }

      if (cls === "retryable_failed" || cls === "missing") {
        if (!driver) {
          // Another tab or mount drives recovery; follow it.
          await sleep(pollMs, opts.signal);
          continue;
        }
        if (cls === "retryable_failed" && recovery.continues < MAX_AUTO_CONTINUES) {
          recovery.continues += 1;
          const r = await postContinue(session.session_id, job_id, opts.signal);
          const code = r.json.code ?? "";
          if (r.json.ok || POLL_ON_CODES.has(code)) {
            await sleep(Math.min(pollMs, 1_000), opts.signal);
            continue;
          }
          if (REGENERATE_FALLBACK_CODES.has(code) && (await regenerate())) continue;
          throw new DecisionReportClientError(code || "CONTINUE_FAILED", r.json.error ?? "Continue failed", {
            retryable: r.json.retryable === true,
            status: r.status,
          });
        }
        if (cls === "missing" && (await regenerate())) continue;
      }

      // Stopped: the row keeps job id, generation and Freeze binding; the pending id stays.
      await saveCheckpoint(session);
      throw new DecisionReportClientError(
        cls === "missing" ? "JOB_MISSING" : cls === "needs_user_continue" ? "REPORT_QUALITY_EXHAUSTED" : "REPORT_FAILED",
        payload.error ?? "Report generation failed",
        { retryable: cls !== "permanent_failed" },
      );
    }
  } finally {
    release?.();
  }
}

/**
 * Start (or reuse) the report for the current Freeze and follow it to completion.
 * With a pending job id this resumes that job (never a new generation unless the job
 * can no longer run). `regenerate` starts a new execution generation; the previous
 * generation's row and pages stay intact in the session.
 */
export async function runDecisionReportForSession(
  initialSession: POJUSessionState,
  locale: string,
  opts: DecisionReportRunOpts = {},
): Promise<POJUSessionState> {
  const { freeze } = freezeOf(initialSession);
  if (!opts.regenerate && initialSession.pending_decision_report_job_id) {
    return pollUntilDone(initialSession, initialSession.pending_decision_report_job_id, locale, freeze, opts);
  }
  const started = await startReportJob(initialSession, locale, freeze, opts, opts.regenerate === true);
  return pollUntilDone(started.session, started.job_id, locale, freeze, opts, {
    ...freshRecovery(),
    regenerated: opts.regenerate === true,
  });
}

/**
 * User Continue: same job from its checkpoints (including a run that spent its 1+1).
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
  const { status, json } = await postContinue(session.session_id, job_id, opts.signal);
  if (!json.ok) {
    const code = json.code ?? "CONTINUE_FAILED";
    if (POLL_ON_CODES.has(code)) return pollUntilDone(session, job_id, locale, freeze, opts);
    if (REGENERATE_FALLBACK_CODES.has(code)) {
      return runDecisionReportForSession(session, locale, { ...opts, regenerate: true });
    }
    throw new DecisionReportClientError(code, json.error ?? "Continue failed", {
      retryable: json.retryable === true,
      status,
    });
  }
  return pollUntilDone(session, job_id, locale, freeze, opts);
}
