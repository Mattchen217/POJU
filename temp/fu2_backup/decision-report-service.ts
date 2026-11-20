/**
 * M3 — server orchestration for Decision Intake 2.0 reports (start / status / continue).
 *
 * Independent of the legacy Stage-2 contract: input is the server-sealed Freeze (DC +
 * Blueprint) and the server-recomputed profile, both reached only through their signed
 * receipts. No agent_v2 / breakthrough_core / covered_agenda.
 * Shares the per-session execution fence with the legacy book so a Regenerate on
 * either path revokes the other's in-flight generation.
 */

import {
  activeDeliveryJobMaxWallMs,
  isDeliveryJobContinueHopExceeded,
} from "@/lib/llm/pro/delivery/delivery-retry-policy";
import {
  forceReleaseDeliveryContinueLease,
  loadDeliveryContinueLease,
  loadDeliveryJobContinueHops,
} from "@/lib/llm/pro/delivery/delivery-stage-store";
import {
  allocateFinalDeliveryExecutionGeneration,
  authorizeFinalDeliveryExecution,
  supersedeFinalDeliveryJobForRegenerate,
} from "@/lib/poju/final-delivery-execution-authority";
import {
  currentDeliveryDeployGeneration,
  isDeliveryJobFromCurrentDeploy,
} from "@/lib/poju/delivery-deploy-generation";
import {
  acquireXhighSessionLock,
  createXhighJob,
  failXhighJob,
  findLatestXhighJobForSession,
  getFdExecutionFence,
  getXhighJob,
  reclaimStaleXhighSessionLock,
  releaseXhighSessionLock,
  updateXhighJobStatus,
} from "@/lib/poju/xhigh-job-store";
import type { PojuXhighJob } from "@/lib/poju/xhigh-job-types";
import {
  assertFreezeReceiptMatches,
  loadVerifiedFreezeRecord,
} from "@/lib/poju/decision-authority/server/freeze-authority";
import {
  DcAuthorityError,
  assertWriter,
  readLedgerHead,
} from "@/lib/poju/decision-authority/server/ledger-store";
import {
  assertProfileReceiptMatches,
  loadVerifiedProfileRecord,
} from "@/lib/poju/decision-authority/server/profile-authority";
import { AuthoritySigningUnavailableError } from "@/lib/poju/decision-authority/server/signing";
import type {
  FreezeReceipt,
  FreezeRecord,
  ProfileReceipt,
  ProfileRecord,
} from "@/lib/poju/decision-authority/types";
import {
  DI2_REPORT_SCHEMA_VERSION,
  PERSONAL_ANALYSIS_SCHEMA_VERSION,
  di2ReportJobId,
  isDecisionReportJobInput,
  isDecisionReportJobResult,
  personalAnalysisIdempotencyKey,
  type DecisionReportJobInput,
  type DecisionReportStatusPayload,
} from "./decision-report-types";
import { resolvePage07Applicability } from "./decision-report-pages";
import {
  clearDecisionReportDispatch,
  commitCompletedReport,
  DecisionReportStoreError,
  loadAllPages,
  loadAnalysis,
  loadCompletedReport,
  type CompletedReportRecord,
} from "./decision-report-store";
import {
  completeRefusalAbortRecord,
  DI2_ABORT_CLAIM_MS,
  loadChargeAuthorization,
  revokeDecisionReportExecution,
  type ChargeAuthorization,
} from "./decision-report-charge";
import {
  completedReportDraft,
  firstIncompleteDecisionReportStage,
  resetDecisionReportBudgets,
} from "./decision-report-runner";
import { decisionReportWorkerState } from "./decision-report-dispatch";

/** Older than one invoke budget with no live lease → the worker died. */
const STALE_NO_LEASE_MS = 6 * 60_000;

/** A start holds the session lock only for its create window when no job is live. */
const ORPHAN_LOCK_MS = 2 * 60_000;

/**
 * The session lock outlived its job (job record lost before the lock TTL). With no live
 * job for the session and the lock older than any create window, take it over.
 */
async function reclaimOrphanReportLock(session_id: string): Promise<boolean> {
  const ok = await reclaimStaleXhighSessionLock("decision_report", session_id, ORPHAN_LOCK_MS).catch(() => false);
  if (ok) console.warn("[decision-report] reclaimed orphan session lock", { session_id });
  return ok;
}

export type ServiceFailure = {
  ok: false;
  status: number;
  code: string;
  error: string;
  retryable: boolean;
};

export type StartDecisionReportOutcome =
  | { ok: true; job: PojuXhighJob; reused: boolean; question: string }
  | ServiceFailure;

function failure(status: number, code: string, error: string, retryable = false): ServiceFailure {
  return { ok: false, status, code, error, retryable };
}

function sameIdentity(a: DecisionReportJobInput, b: Pick<DecisionReportJobInput, "freeze_id" | "context_hash" | "profile_hash" | "report_schema_version" | "analysis_schema_version">): boolean {
  return (
    a.freeze_id === b.freeze_id &&
    a.context_hash === b.context_hash &&
    a.profile_hash === b.profile_hash &&
    a.report_schema_version === b.report_schema_version &&
    a.analysis_schema_version === b.analysis_schema_version
  );
}

function isRevivable(job: PojuXhighJob): boolean {
  if (job.status !== "failed") return false;
  const r = job.failure_reason;
  if (r === "superseded_by_regenerate" || r === "superseded_by_deploy" || r === "user_cancelled") {
    return false;
  }
  return job.retryable === true || r === "interrupted";
}

type AuthorizedSources = {
  freeze: FreezeRecord;
  profile: ProfileRecord;
};

/**
 * M4 trust boundary: the device presents only its server-signed receipts (+ writer
 * capability). Everything the job runs on is re-read from the server records: the
 * Freeze sealed from the ledger and the profile recomputed at that Freeze instant.
 */
async function authorizeReportSources(input: {
  session_id: string;
  writer_token: unknown;
  freeze_receipt: unknown;
  profile_receipt: unknown;
}): Promise<AuthorizedSources | ServiceFailure> {
  const held = input.freeze_receipt as FreezeReceipt | null;
  if (!held || typeof held !== "object" || typeof held.freeze_id !== "string") {
    return failure(400, "FREEZE_RECEIPT_REQUIRED", "A server Freeze receipt for this session is required");
  }
  if (held.session_id !== input.session_id) {
    return failure(403, "FREEZE_RECEIPT_INVALID", "Freeze receipt belongs to another session");
  }
  try {
    await assertWriter(input.session_id, input.writer_token);
    const freeze = await loadVerifiedFreezeRecord(input.session_id, held.freeze_id);
    assertFreezeReceiptMatches(held, freeze);
    const head = await readLedgerHead(input.session_id);
    if (!head || head.commit_version !== freeze.freeze_commit_version || head.change_type !== "freeze") {
      return failure(409, "FREEZE_NOT_CURRENT", "This Freeze is no longer the session's current Freeze");
    }
    const profileHeld = input.profile_receipt as ProfileReceipt | null;
    if (!profileHeld || typeof profileHeld !== "object" || profileHeld.freeze_id !== freeze.freeze_id) {
      return failure(422, "PROFILE_RECEIPT_REQUIRED", "A server-computed profile for this Freeze is required");
    }
    const profile = await loadVerifiedProfileRecord({
      session_id: input.session_id,
      freeze,
      profile_hash: profileHeld.profile_hash,
    });
    assertProfileReceiptMatches(profileHeld, profile);
    return { freeze, profile };
  } catch (e) {
    if (e instanceof DcAuthorityError) {
      const status =
        e.code === "DC_AUTHORITY_FORBIDDEN" || e.code.endsWith("RECEIPT_INVALID")
          ? 403
          : e.code === "PROFILE_NOT_REGISTERED"
            ? 422
            : e.code === "DC_LEDGER_NOT_FOUND" || e.code === "FREEZE_NOT_REGISTERED"
              ? 404
              : 409;
      return failure(status, e.code, e.message);
    }
    if (e instanceof AuthoritySigningUnavailableError) return failure(503, e.code, e.message, true);
    throw e;
  }
}

/**
 * Verify the Freeze + profile authority and create (or reuse) the report job.
 * Does not schedule — the route schedules after the pass charge succeeds.
 */
export async function startDecisionReportJob(input: {
  session_id: string;
  locale: string;
  writer_token: unknown;
  freeze_receipt: unknown;
  profile_receipt: unknown;
  regenerate: boolean;
}): Promise<StartDecisionReportOutcome> {
  const session_id = input.session_id;
  const authorized = await authorizeReportSources(input);
  if ("ok" in authorized) return authorized;
  const freezeRec = authorized.freeze;
  const profile = authorized.profile;
  const freeze = {
    freeze_id: freezeRec.freeze_id,
    context_hash: freezeRec.context_hash,
    decision_context: freezeRec.frozen_dc,
    blueprint: freezeRec.blueprint ?? null,
  };

  const page07 = resolvePage07Applicability({
    dc: freeze.decision_context,
    blueprint: freeze.blueprint,
  });
  const question =
    freeze.decision_context.definition.decision_question ?? freeze.blueprint?.decision_question ?? "";
  const identity = {
    freeze_id: freeze.freeze_id,
    context_hash: freeze.context_hash,
    profile_hash: profile.profile_hash,
    report_schema_version: DI2_REPORT_SCHEMA_VERSION,
    analysis_schema_version: PERSONAL_ANALYSIS_SCHEMA_VERSION,
  };

  const latest = await findLatestXhighJobForSession("decision_report", session_id);
  const latestInput = latest && isDecisionReportJobInput(latest.input) ? latest.input : null;
  if (latest && latestInput && !input.regenerate && sameIdentity(latestInput, identity)) {
    const live = latest.status === "pending" || latest.status === "running";
    if (live || latest.status === "completed" || isRevivable(latest)) {
      return { ok: true, job: latest, reused: true, question };
    }
  }

  let generation: number | null = null;
  if (latest && (latest.status === "pending" || latest.status === "running")) {
    // Different Freeze / profile, or explicit Regenerate: revoke the in-flight generation.
    // Its pages stay under its own job_id; nothing it wrote is overwritten.
    try {
      const revoked = await supersedeFinalDeliveryJobForRegenerate(latest.job_id);
      generation = revoked.new_generation;
    } catch (e) {
      return failure(
        409,
        "SUPERSEDE_FAILED",
        e instanceof Error ? e.message : "Regenerate supersede failed closed",
        true,
      );
    }
    await releaseXhighSessionLock("decision_report", session_id).catch(() => undefined);
  }

  let locked = await acquireXhighSessionLock("decision_report", session_id);
  if (!locked && !(latest && (latest.status === "pending" || latest.status === "running"))) {
    locked = await reclaimOrphanReportLock(session_id);
  }
  if (!locked) {
    return failure(409, "REPORT_JOB_BUSY", "Another report start is in progress for this session", true);
  }

  try {
    if (generation == null) {
      generation = await allocateFinalDeliveryExecutionGeneration(session_id);
    }
    const job_input: DecisionReportJobInput = {
      kind: "decision_intake_report",
      session_id,
      locale: input.locale,
      freeze_id: freeze.freeze_id,
      context_id: freeze.decision_context.context_id,
      context_version: freeze.decision_context.version,
      context_hash: freeze.context_hash,
      report_schema_version: DI2_REPORT_SCHEMA_VERSION,
      analysis_schema_version: PERSONAL_ANALYSIS_SCHEMA_VERSION,
      profile_id: profile.profile_id,
      profile_hash: profile.profile_hash,
      freeze_receipt_id: freezeRec.receipt.receipt_id,
      frozen_at: freezeRec.frozen_at,
      profile_receipt_id: profile.receipt.receipt_id,
      profile_calculation_schema_version: profile.calculation_schema_version,
      analysis_key: personalAnalysisIdempotencyKey({
        session_id,
        freeze_id: freeze.freeze_id,
        context_hash: freeze.context_hash,
        profile_hash: profile.profile_hash,
      }),
      report_job_id: di2ReportJobId({
        session_id,
        freeze_id: freeze.freeze_id,
        profile_hash: profile.profile_hash,
        execution_generation: generation,
      }),
      page07_applies: page07.applies,
      page07_topic: page07.topic,
      regenerate: input.regenerate,
    };
    const job = await createXhighJob({
      phase: "decision_report",
      session_id,
      locale: input.locale,
      job_input,
      deploy_generation: currentDeliveryDeployGeneration(),
      execution_generation: generation,
    });
    try {
      await authorizeFinalDeliveryExecution(session_id, generation, job.job_id);
    } catch (e) {
      await failXhighJob(job.job_id, "fence_authorize_failed", {
        retryable: false,
        failure_reason: "transport_error",
      }).catch(() => undefined);
      await releaseXhighSessionLock("decision_report", session_id).catch(() => undefined);
      return failure(
        409,
        "FENCE_AUTHORIZE_FAILED",
        e instanceof Error ? e.message : "Execution fence authorize failed",
        true,
      );
    }
    return { ok: true, job, reused: false, question };
  } catch (e) {
    await releaseXhighSessionLock("decision_report", session_id).catch(() => undefined);
    throw e;
  }
}

export type RefusalAbortStep = "revoke_grant" | "fail_job" | "clear_dispatch" | "release_lock" | "mark_completed";

let refusalAbortStepHook: ((step: RefusalAbortStep, job_id: string) => Promise<void> | void) | null = null;

/** Tests only: runs before each termination step (pause with a gate, or throw to stop there). */
export function __setRefusalAbortStepHookForTests(
  fn: ((step: RefusalAbortStep, job_id: string) => Promise<void> | void) | null,
): void {
  refusalAbortStepHook = fn;
}

/**
 * Pass-charge refusal: the job must never run. The execution grant goes first, so a
 * worker already queued for it (relay redelivery, a background task, an older dispatch)
 * is refused at its entry and at every checkpoint, before the job is stamped failed and
 * its marker / lock are released. Every step is idempotent and the first failure stops
 * the sequence (throws), so a repeat from the start converges on the same end state.
 */
export async function abortDecisionReportJob(job: PojuXhighJob, reason: string): Promise<void> {
  await terminateRefusedJob(job.job_id, job.session_id, reason);
}

async function terminateRefusedJob(job_id: string, session_id: string, reason: string): Promise<void> {
  await refusalAbortStepHook?.("revoke_grant", job_id);
  await revokeDecisionReportExecution(job_id);

  await refusalAbortStepHook?.("fail_job", job_id);
  const job = await getXhighJob(job_id);
  if (job && job.session_id !== session_id) throw new Error(`abort job ${job_id} belongs to another session`);
  if (job && job.status !== "completed" && !(job.status === "failed" && job.failure_reason === "charge_refused")) {
    await failXhighJob(job_id, reason, { retryable: false, failure_reason: "charge_refused" });
    const after = await getXhighJob(job_id);
    if (after && !(after.status === "failed" && after.failure_reason === "charge_refused")) {
      throw new Error(`abort job ${job_id} was not stamped charge_refused (${after.status})`);
    }
  }

  await refusalAbortStepHook?.("clear_dispatch", job_id);
  await clearDecisionReportDispatch(job_id);

  await refusalAbortStepHook?.("release_lock", job_id);
  await releaseXhighSessionLock("decision_report", session_id);
}

export type RefusalAbortOutcome = { ok: true } | { ok: false; reason: string };

/**
 * Drive a claimed refusal abort to its end: terminate exactly `abort_job_id` (never
 * another job), then CAS `abort_claimed → abort_completed` on the claimed record. Safe
 * to call from any request (the claimant, or a later start / status / continue resuming
 * after a crash): every step is idempotent and the completion is bound to the claim.
 * Never creates a job, charges or dispatches.
 */
export async function finishDecisionReportRefusalAbort(claimed: ChargeAuthorization): Promise<RefusalAbortOutcome> {
  if (claimed.state === "abort_completed") return { ok: true };
  if (claimed.state !== "abort_claimed" || !claimed.abort_job_id) return { ok: false, reason: "not_abort_claimed" };
  try {
    await terminateRefusedJob(claimed.abort_job_id, claimed.session_id, "pass_required");
    await refusalAbortStepHook?.("mark_completed", claimed.abort_job_id);
  } catch (e) {
    console.error("[decision-report] refusal abort incomplete", { job_id: claimed.abort_job_id, e });
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
  return (await completeRefusalAbortRecord(claimed)) ? { ok: true } : { ok: false, reason: "abort_completion_unconfirmed" };
}

export type RefusalAbortResume =
  | { kind: "none" }
  | { kind: "unreadable" }
  /** Claimed by a request still inside its window: the abort stays that request's. */
  | { kind: "held"; record: ChargeAuthorization }
  | { kind: "resumed"; record: ChargeAuthorization; outcome: RefusalAbortOutcome };

/**
 * A claimed abort belongs to its claimant while the claim is fresh; once older than the
 * claim window (the claimant died mid-abort) any request resumes the same abort.
 */
export async function resumeRefusalAbortRecord(rec: ChargeAuthorization): Promise<RefusalAbortResume> {
  if (rec.state !== "abort_claimed") return { kind: "none" };
  if (Date.now() - (rec.abort_claimed_at ?? 0) < DI2_ABORT_CLAIM_MS) return { kind: "held", record: rec };
  return { kind: "resumed", record: rec, outcome: await finishDecisionReportRefusalAbort(rec) };
}

/** The session's refusal abort, if one is claimed and unfinished (see `resumeRefusalAbortRecord`). */
export async function resumeDecisionReportRefusalAbort(session_id: string): Promise<RefusalAbortResume> {
  let rec: ChargeAuthorization | null;
  try {
    rec = await loadChargeAuthorization(session_id);
  } catch {
    return { kind: "unreadable" };
  }
  return rec ? resumeRefusalAbortRecord(rec) : { kind: "none" };
}

function statusFromRecord(done: CompletedReportRecord): DecisionReportStatusPayload {
  return {
    ok: true,
    job_id: done.job_id,
    session_id: done.session_id,
    status: "completed",
    current_stage: "assemble",
    execution_generation: done.execution_generation,
    freeze_id: done.freeze_id,
    context_hash: done.context_hash,
    report_job_id: done.report_job_id,
    profile_hash: done.profile_hash,
    analysis: {
      status: done.analysis.status,
      analysis_id: done.analysis.analysis_id,
      attempts: done.analysis.attempts,
      error: done.analysis.error,
      record: done.analysis,
    },
    pages: done.pages,
    result: done.result,
    retryable: false,
    failure_reason: null,
    error: null,
    worker: null,
  };
}

/**
 * The committed record of a completed job. Jobs completed by this pipeline always have
 * one (it is written first); for a job that lost it (expiry / older build) it is rebuilt
 * once from the job result and the immutable checkpoints, through the same commit.
 */
async function ensureCompletedReportRecord(job: PojuXhighJob): Promise<CompletedReportRecord> {
  const ji = job.input as DecisionReportJobInput;
  const existing = await loadCompletedReport(job.session_id, job.job_id);
  if (existing) return existing;
  if (!isDecisionReportJobResult(job.result) || typeof job.execution_generation !== "number") {
    throw new DecisionReportStoreError("REPORT_RECORD_INVALID", "completed job has no report result");
  }
  const analysis = await loadAnalysis(ji.analysis_key);
  if (!analysis || analysis.record.status !== "completed") {
    throw new DecisionReportStoreError("REPORT_RECORD_INVALID", "completed job has no completed Personal Analysis");
  }
  const pages = (await loadAllPages(job.job_id)).map((p) => p.record);
  const draft = completedReportDraft(
    ji,
    job.job_id,
    job.execution_generation,
    analysis.record,
    pages,
    job.result,
    job.result.completed_at,
  );
  return (await commitCompletedReport(draft)).record;
}

function missingPayload(input: { job_id: string; session_id: string }): DecisionReportStatusPayload {
  return {
    ok: false,
    job_id: input.job_id,
    session_id: input.session_id,
    status: "missing",
    current_stage: null,
    execution_generation: null,
    freeze_id: null,
    context_hash: null,
    report_job_id: null,
    profile_hash: null,
    analysis: { status: "missing", analysis_id: null, attempts: 0, error: null, record: null },
    pages: [],
    result: null,
    retryable: true,
    failure_reason: "job_missing",
    error: "Report job not found or expired",
    worker: null,
  };
}

export async function buildDecisionReportStatus(input: {
  job_id: string;
  session_id: string;
}): Promise<DecisionReportStatusPayload> {
  let job = await getXhighJob(input.job_id);
  if (!job) {
    // The execution job expires with its 2h TTL; a finished book stays under retention.
    let done: CompletedReportRecord | null = null;
    try {
      done = await loadCompletedReport(input.session_id, input.job_id);
    } catch (e) {
      console.error("[decision-report] completed report record unreadable", { job_id: input.job_id, e });
    }
    return done ? statusFromRecord(done) : missingPayload(input);
  }
  if (job.phase !== "decision_report" || !isDecisionReportJobInput(job.input) || job.session_id !== input.session_id) {
    return missingPayload(input);
  }

  if (job.status === "completed") {
    // Completed is reported only from the committed record — never from the job alone.
    try {
      return statusFromRecord(await ensureCompletedReportRecord(job));
    } catch (e) {
      const code = e instanceof DecisionReportStoreError ? e.code : "REPORT_PERSIST_FAILED";
      const ji = job.input as DecisionReportJobInput;
      return {
        ...missingPayload(input),
        status: "failed",
        current_stage: "assemble",
        execution_generation: job.execution_generation ?? null,
        freeze_id: ji.freeze_id,
        context_hash: ji.context_hash,
        report_job_id: ji.report_job_id,
        profile_hash: ji.profile_hash,
        retryable: code !== "REPORT_RECORD_CONFLICT" && code !== "REPORT_RECORD_INVALID",
        failure_reason: "report_persist_failed",
        error: `${code}: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  if (job.status === "pending" || job.status === "running") {
    const lease = await loadDeliveryContinueLease(job.job_id).catch(() => null);
    const leaseLive = Boolean(lease && lease.expires_at > Date.now());
    if (!leaseLive && Date.now() - job.updated_at > STALE_NO_LEASE_MS) {
      await failXhighJob(job.job_id, "STOP: report worker stopped without a live lease", {
        retryable: true,
        failure_reason: "interrupted",
        current_stage: job.current_stage,
        accumulated_content: "failed:stale_no_lease",
      }).catch(() => undefined);
      await releaseXhighSessionLock("decision_report", job.session_id).catch(() => undefined);
      job = (await getXhighJob(job.job_id)) ?? job;
    }
  }

  const ji = job.input as DecisionReportJobInput;
  const analysis = await loadAnalysis(ji.analysis_key);
  const pages = (await loadAllPages(job.job_id)).map((p) => p.record);
  const failed = job.status === "failed";
  const live = job.status === "pending" || job.status === "running";

  return {
    ok: !failed,
    job_id: job.job_id,
    session_id: job.session_id,
    status: job.status,
    current_stage: job.current_stage ?? null,
    execution_generation: job.execution_generation ?? null,
    freeze_id: ji.freeze_id,
    context_hash: ji.context_hash,
    report_job_id: ji.report_job_id,
    profile_hash: ji.profile_hash,
    analysis: analysis
      ? {
          status: analysis.record.status,
          analysis_id: analysis.record.analysis_id,
          attempts: analysis.record.attempts,
          error: analysis.record.error,
          record: analysis.record,
        }
      : { status: "missing", analysis_id: null, attempts: 0, error: null, record: null },
    pages,
    result: null,
    retryable: failed ? isRevivable(job) : false,
    failure_reason: job.failure_reason ?? null,
    error: failed ? job.error ?? "report job failed" : null,
    worker: live ? await decisionReportWorkerState(job.job_id) : null,
  };
}

export type ContinueDecisionReportOutcome =
  | { ok: true; job: PojuXhighJob; stage: "finalize" | "segments" | "assemble" }
  | ServiceFailure;

/**
 * User Continue after an interrupted run. Same job, same generation, same Freeze;
 * completed checkpoints are kept, failed units get a fresh 1+1 budget.
 * When the job can no longer run (expired, superseded, budget spent) the caller
 * should start a Regenerate for the same Freeze instead.
 */
export async function continueDecisionReportJob(input: {
  job_id: string;
  session_id: string;
}): Promise<ContinueDecisionReportOutcome> {
  const job = await getXhighJob(input.job_id);
  if (!job || job.phase !== "decision_report" || job.session_id !== input.session_id || !isDecisionReportJobInput(job.input)) {
    return failure(404, "JOB_MISSING", "Report job not found or expired", true);
  }
  if (job.status === "completed") {
    try {
      await ensureCompletedReportRecord(job);
    } catch (e) {
      const code = e instanceof DecisionReportStoreError ? e.code : "REPORT_PERSIST_FAILED";
      return failure(
        503,
        "REPORT_PERSIST_FAILED",
        `${code}: ${e instanceof Error ? e.message : String(e)}`,
        code !== "REPORT_RECORD_CONFLICT" && code !== "REPORT_RECORD_INVALID",
      );
    }
    return failure(409, "ALREADY_COMPLETED", "Report already completed");
  }
  if (job.status === "pending" || job.status === "running") {
    return failure(409, "JOB_RUNNING", "Report job is still running", true);
  }
  if (!isRevivable(job)) {
    return failure(409, "NOT_REVIVABLE", `Report job cannot continue (${job.failure_reason ?? "failed"})`, true);
  }
  if (!isDeliveryJobFromCurrentDeploy(job)) {
    return failure(409, "SUPERSEDED_BY_DEPLOY", "Report job belongs to a previous deployment", true);
  }
  if (Date.now() - job.created_at > activeDeliveryJobMaxWallMs()) {
    return failure(409, "JOB_BUDGET_EXHAUSTED", "Report job time budget exhausted", true);
  }
  if (isDeliveryJobContinueHopExceeded(await loadDeliveryJobContinueHops(job.job_id))) {
    return failure(409, "JOB_BUDGET_EXHAUSTED", "Report job continue budget exhausted", true);
  }
  const fence = await getFdExecutionFence(job.session_id);
  if (!fence || fence.generation !== job.execution_generation || fence.authorized_job_id !== job.job_id) {
    return failure(409, "SUPERSEDED", "A newer report generation owns this session", true);
  }
  const locked = await acquireXhighSessionLock("decision_report", job.session_id);
  if (!locked) {
    return failure(409, "REPORT_JOB_BUSY", "Another report run is in progress for this session", true);
  }
  await resetDecisionReportBudgets(job);
  await forceReleaseDeliveryContinueLease(job.job_id).catch(() => undefined);
  const stage = await firstIncompleteDecisionReportStage(job);
  await updateXhighJobStatus(job.job_id, "running", {
    error: undefined,
    error_detail: undefined,
    retryable: undefined,
    failure_reason: undefined,
    current_stage: stage,
    accumulated_content: `queued:${stage}:${Date.now()}`,
  });
  const revived = await getXhighJob(job.job_id);
  if (!revived || revived.status !== "running") {
    await releaseXhighSessionLock("decision_report", job.session_id).catch(() => undefined);
    return failure(409, "REVIVE_FAILED", "Report job could not be resumed", true);
  }
  return { ok: true, job: revived, stage };
}
