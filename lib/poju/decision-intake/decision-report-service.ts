/**
 * M3 — server orchestration for Decision Intake 2.0 reports (start / status / continue).
 *
 * Independent of the legacy Stage-2 contract: input is the frozen DC + Blueprint +
 * the user's formal profile structure. No agent_v2 / breakthrough_core / covered_agenda.
 * Shares the per-session execution fence with the legacy book so a Regenerate on
 * either path revokes the other's in-flight generation.
 */

import { tryStructuredFromBaseAnalysis } from "@/lib/llm/pro/delivery/page-schema/anchor-category-tally";
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
  releaseXhighSessionLock,
  updateXhighJobStatus,
} from "@/lib/poju/xhigh-job-store";
import type { PojuXhighJob } from "@/lib/poju/xhigh-job-types";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import { coerceBirthInfo, ziweiClosedSetFromBirth } from "@/lib/ziwei/lab-ziwei";
import {
  DI2_REPORT_SCHEMA_VERSION,
  PERSONAL_ANALYSIS_SCHEMA_VERSION,
  di2ReportJobId,
  isDecisionReportJobInput,
  personalAnalysisIdempotencyKey,
  type DecisionReportJobInput,
  type DecisionReportStatusPayload,
} from "./decision-report-types";
import { resolvePage07Applicability } from "./decision-report-pages";
import {
  DecisionReportStoreError,
  loadAllPages,
  loadAnalysis,
  registerFrozenDecisionContext,
  registerProfile,
} from "./decision-report-store";
import { firstIncompleteDecisionReportStage, resetDecisionReportBudgets } from "./decision-report-runner";
import type { DecisionBlueprint } from "./types";

/** Older than one invoke budget with no live lease → the worker died. */
const STALE_NO_LEASE_MS = 6 * 60_000;

export type ServiceFailure = {
  ok: false;
  status: number;
  code: string;
  error: string;
  retryable: boolean;
};

export type StartDecisionReportOutcome =
  | { ok: true; job: PojuXhighJob; reused: boolean; question: string; had_prior_job: boolean }
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

/**
 * Register Freeze + profile and create (or reuse) the report job.
 * Does not schedule — the route schedules after the pass charge succeeds.
 */
export async function startDecisionReportJob(input: {
  session_id: string;
  locale: string;
  decision_context: unknown;
  blueprint: unknown;
  profile_id: string | null;
  base_analysis: unknown;
  birth_info: unknown;
  regenerate: boolean;
}): Promise<StartDecisionReportOutcome> {
  const session_id = input.session_id;
  const dcRaw = input.decision_context as DecisionContext | null;
  if (!dcRaw || typeof dcRaw !== "object" || typeof dcRaw.context_id !== "string") {
    return failure(400, "DECISION_CONTEXT_REQUIRED", "A frozen Decision Context for this session is required");
  }

  let freeze;
  try {
    freeze = await registerFrozenDecisionContext({
      session_id,
      decision_context: dcRaw,
      blueprint: (input.blueprint as DecisionBlueprint | null) ?? null,
    });
  } catch (e) {
    if (e instanceof DecisionReportStoreError) {
      return failure(409, e.code, e.message);
    }
    throw e;
  }

  const structured = tryStructuredFromBaseAnalysis(input.base_analysis);
  if (!structured) {
    return failure(
      422,
      "PROFILE_STRUCTURE_UNAVAILABLE",
      "The personal profile has no computed chart structure; recompute the profile first",
    );
  }
  const birth = coerceBirthInfo(input.birth_info);
  const ziwei = birth
    ? ziweiClosedSetFromBirth(birth, { asOf: freeze.decision_context.updated_at }) || null
    : null;
  const profile = await registerProfile({
    session_id,
    profile_id: input.profile_id,
    structured,
    ziwei_closed_set: ziwei,
  });

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
      return { ok: true, job: latest, reused: true, question, had_prior_job: true };
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

  const locked = await acquireXhighSessionLock("decision_report", session_id);
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
      profile_id: input.profile_id,
      profile_hash: profile.profile_hash,
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
    return { ok: true, job, reused: false, question, had_prior_job: Boolean(latest) };
  } catch (e) {
    await releaseXhighSessionLock("decision_report", session_id).catch(() => undefined);
    throw e;
  }
}

/** Pass-charge refusal after create: the job must not run. */
export async function abortDecisionReportJob(job: PojuXhighJob, reason: string): Promise<void> {
  await failXhighJob(job.job_id, reason, { retryable: false, failure_reason: "transport_error" }).catch(
    () => undefined,
  );
  await releaseXhighSessionLock("decision_report", job.session_id).catch(() => undefined);
}

export async function buildDecisionReportStatus(input: {
  job_id: string;
  session_id: string;
}): Promise<DecisionReportStatusPayload> {
  let job = await getXhighJob(input.job_id);
  if (!job || job.phase !== "decision_report" || !isDecisionReportJobInput(job.input) || job.session_id !== input.session_id) {
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
    };
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
  const result =
    job.status === "completed" && job.result && (job.result as { kind?: string }).kind === "decision_intake_report"
      ? (job.result as DecisionReportStatusPayload["result"])
      : null;

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
    result,
    retryable: failed ? isRevivable(job) : false,
    failure_reason: job.failure_reason ?? null,
    error: failed ? job.error ?? "report job failed" : null,
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
