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
  createXhighJob,
  failXhighJob,
  findLatestXhighJobForSession,
  getFdExecutionFence,
  getXhighJob,
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
  abortHeldSince,
  claimRefusalAbortResume,
  completeRefusalAbortRecord,
  DI2_ABORT_CLAIM_MS,
  loadChargeAuthorization,
  revokeDecisionReportExecution,
  type ChargeAuthorization,
} from "./decision-report-charge";
import {
  LEGACY_REPORT_LOCK_ORPHAN_MS,
  newReportLockOwner,
  readReportSessionLock,
  releaseOwnedReportLock,
  releaseReportJobLock,
  REPORT_START_LOCK_IDLE_MS,
  reportLockOwnerOf,
  takeOverReportLock,
  tryCreateReportLock,
  updateOwnedReportLock,
  type ReportLockOwner,
  type ReportSessionLock,
} from "./decision-report-lock";
import {
  completedReportDraft,
  firstIncompleteDecisionReportStage,
  resetDecisionReportBudgets,
} from "./decision-report-runner";
import { decisionReportWorkerState } from "./decision-report-dispatch";

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
  | { ok: true; job: PojuXhighJob; reused: boolean; question: string }
  | ServiceFailure;

function failure(status: number, code: string, error: string, retryable = false): ServiceFailure {
  return { ok: false, status, code, error, retryable };
}

export function sameIdentity(a: DecisionReportJobInput, b: Pick<DecisionReportJobInput, "freeze_id" | "context_hash" | "profile_hash" | "report_schema_version" | "analysis_schema_version">): boolean {
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

export type ReportStartHookPoint =
  | "before_lock"
  | "after_lock"
  | "precheck"
  | "before_create"
  | "after_create"
  | "before_settle"
  | "before_handoff"
  | "before_resume_claim";

let reportStartHook:
  | ((point: ReportStartHookPoint, ctx: { session_id: string; owner_attempt_id: string | null }) => Promise<void> | void)
  | null = null;

/** Tests only: runs at each start / resume boundary (pause with a gate, or throw to stop there). */
export function __setReportStartHookForTests(fn: typeof reportStartHook): void {
  reportStartHook = fn;
}

export async function runReportStartHook(
  point: ReportStartHookPoint,
  ctx: { session_id: string; owner_attempt_id: string | null },
): Promise<void> {
  await reportStartHook?.(point, ctx);
}

function isLiveJob(job: PojuXhighJob): boolean {
  return job.status === "pending" || job.status === "running";
}

export type DecisionReportStartPlan = {
  session_id: string;
  locale: string;
  regenerate: boolean;
  question: string;
  identity: Pick<
    DecisionReportJobInput,
    "freeze_id" | "context_hash" | "profile_hash" | "report_schema_version" | "analysis_schema_version"
  >;
  freezeRec: FreezeRecord;
  profile: ProfileRecord;
  page07: ReturnType<typeof resolvePage07Applicability>;
};

/**
 * Verify the Freeze + profile authority (read-only; no job, no lock, no charge record).
 * Everything that depends on the session's state is decided later, under the start lock.
 */
export async function planDecisionReportStart(input: {
  session_id: string;
  locale: string;
  writer_token: unknown;
  freeze_receipt: unknown;
  profile_receipt: unknown;
  regenerate: boolean;
}): Promise<DecisionReportStartPlan | ServiceFailure> {
  const authorized = await authorizeReportSources(input);
  if ("ok" in authorized) return authorized;
  const freezeRec = authorized.freeze;
  const profile = authorized.profile;
  const dc = freezeRec.frozen_dc;
  const blueprint = freezeRec.blueprint ?? null;
  return {
    session_id: input.session_id,
    locale: input.locale,
    regenerate: input.regenerate,
    question: dc.definition.decision_question ?? blueprint?.decision_question ?? "",
    identity: {
      freeze_id: freezeRec.freeze_id,
      context_hash: freezeRec.context_hash,
      profile_hash: profile.profile_hash,
      report_schema_version: DI2_REPORT_SCHEMA_VERSION,
      analysis_schema_version: PERSONAL_ANALYSIS_SCHEMA_VERSION,
    },
    freezeRec,
    profile,
    page07: resolvePage07Applicability({ dc, blueprint }),
  };
}

export type ReportStartLock =
  /** This start owns the session lock (holder `start`). */
  | { kind: "locked"; lock: ReportSessionLock }
  /** An authorized live job of this Freeze holds the lock: follow it, nothing to create. */
  | { kind: "follow"; job: PojuXhighJob }
  /** Another start is inside its window (its job, once bound): read-only, never advance it. */
  | { kind: "observe"; job: PojuXhighJob | null }
  | { kind: "busy" }
  /** The lock could not be read / written with certainty: fail closed. */
  | { kind: "unconfirmed"; reason: string };

/**
 * Take the session lock before anything about the session is decided. A live job's lock
 * is taken over only to replace that job (Regenerate / another Freeze); an idle start's,
 * a terminal job's or an aged legacy lock only by CAS on the exact value read.
 */
export async function acquireDecisionReportStartLock(
  plan: DecisionReportStartPlan,
  owner: ReportLockOwner,
): Promise<ReportStartLock> {
  const sid = plan.session_id;
  const takeOver = async (raw: unknown, why: string): Promise<ReportSessionLock | null> => {
    const taken = await takeOverReportLock(raw, owner, "start", null);
    if (taken) console.warn("[decision-report] took over session lock", { session_id: sid, why });
    return taken;
  };
  const liveJobLock = async (raw: unknown, job: PojuXhighJob): Promise<ReportStartLock | null> => {
    const ji = isDecisionReportJobInput(job.input) ? job.input : null;
    const latest = await findLatestXhighJobForSession("decision_report", sid);
    if (!plan.regenerate && ji && sameIdentity(ji, plan.identity) && latest?.job_id === job.job_id) {
      return { kind: "follow", job };
    }
    const taken = await takeOver(raw, "replace_live_job");
    return taken ? { kind: "locked", lock: taken } : null;
  };
  try {
    for (let round = 0; round < 3; round++) {
      const created = await tryCreateReportLock(owner, "start", null);
      if (created) return { kind: "locked", lock: created };
      const cur = await readReportSessionLock(sid);
      if (cur.kind === "absent") continue;
      if (cur.kind === "invalid") return { kind: "unconfirmed", reason: "lock_unrecognised" };
      if (cur.kind === "legacy") {
        const latest = await findLatestXhighJobForSession("decision_report", sid);
        if (latest && isLiveJob(latest)) {
          const r = await liveJobLock(cur.raw, latest);
          if (r) return r;
          continue;
        }
        if (Date.now() - cur.at < LEGACY_REPORT_LOCK_ORPHAN_MS) return { kind: "busy" };
        const taken = await takeOver(cur.raw, "legacy_orphan");
        if (taken) return { kind: "locked", lock: taken };
        continue;
      }
      const held = cur.lock;
      if (held.holder === "start") {
        if (Date.now() - held.touched_at < REPORT_START_LOCK_IDLE_MS) {
          const job = held.job_id ? await getXhighJob(held.job_id) : null;
          return { kind: "observe", job: job && job.session_id === sid ? job : null };
        }
        const taken = await takeOver(cur.raw, "idle_start");
        if (taken) return { kind: "locked", lock: taken };
        continue;
      }
      const job = held.job_id ? await getXhighJob(held.job_id) : null;
      if (job && job.session_id === sid && isLiveJob(job)) {
        const r = await liveJobLock(cur.raw, job);
        if (r) return r;
        continue;
      }
      const taken = await takeOver(cur.raw, "job_not_live");
      if (taken) return { kind: "locked", lock: taken };
    }
    return { kind: "busy" };
  } catch (e) {
    console.error("[decision-report] start lock unconfirmed", { session_id: sid, e });
    return { kind: "unconfirmed", reason: e instanceof Error ? e.message : String(e) };
  }
}

export type PreparedReportJob =
  | { ok: true; job: PojuXhighJob; reused: boolean; question: string; lock: ReportSessionLock }
  | ServiceFailure;

const LOCK_LOST = (): ServiceFailure =>
  failure(409, "REPORT_JOB_BUSY", "This report start no longer holds the session lock", true);

/**
 * Under the start lock (after the authorization pre-check): reuse the session's job for
 * this Freeze, or create one, and bind the lock to it. Does not schedule or charge. On a
 * failure the caller releases its own lock.
 */
export async function createOrReuseDecisionReportJob(
  plan: DecisionReportStartPlan,
  lock: ReportSessionLock,
): Promise<PreparedReportJob> {
  const owner = reportLockOwnerOf(lock);
  const session_id = plan.session_id;
  const { freezeRec, profile, page07, question, identity } = plan;

  const latest = await findLatestXhighJobForSession("decision_report", session_id);
  const latestInput = latest && isDecisionReportJobInput(latest.input) ? latest.input : null;
  if (latest && latestInput && !plan.regenerate && sameIdentity(latestInput, identity)) {
    if (isLiveJob(latest) || latest.status === "completed" || isRevivable(latest)) {
      const bound = await updateOwnedReportLock(owner, { job_id: latest.job_id });
      if (!bound) return LOCK_LOST();
      return { ok: true, job: latest, reused: true, question, lock: bound };
    }
  }

  await runReportStartHook("before_create", { session_id, owner_attempt_id: owner.owner_attempt_id });
  // Generations are bumped only by the lock's current owner (re-checked after the window).
  if (!(await updateOwnedReportLock(owner))) return LOCK_LOST();
  let generation: number;
  if (latest && isLiveJob(latest)) {
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
  } else {
    generation = await allocateFinalDeliveryExecutionGeneration(session_id);
  }
  {
    const freeze = {
      freeze_id: freezeRec.freeze_id,
      context_hash: freezeRec.context_hash,
      decision_context: freezeRec.frozen_dc,
    };
    const job_input: DecisionReportJobInput = {
      kind: "decision_intake_report",
      session_id,
      locale: plan.locale,
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
      regenerate: plan.regenerate,
    };
    const job = await createXhighJob({
      phase: "decision_report",
      session_id,
      locale: plan.locale,
      job_input,
      deploy_generation: currentDeliveryDeployGeneration(),
      execution_generation: generation,
    });
    await runReportStartHook("after_create", { session_id, owner_attempt_id: owner.owner_attempt_id });
    const bound = await updateOwnedReportLock(owner, { job_id: job.job_id }).catch(() => null);
    if (!bound) {
      // Another start owns the session now: this job must not linger as a second chain.
      await failXhighJob(job.job_id, "STOP: report start lost its session lock", {
        retryable: false,
        failure_reason: "superseded_by_regenerate",
      }).catch(() => undefined);
      return LOCK_LOST();
    }
    try {
      await authorizeFinalDeliveryExecution(session_id, generation, job.job_id);
    } catch (e) {
      await failXhighJob(job.job_id, "fence_authorize_failed", {
        retryable: false,
        failure_reason: "transport_error",
      }).catch(() => undefined);
      return failure(
        409,
        "FENCE_AUTHORIZE_FAILED",
        e instanceof Error ? e.message : "Execution fence authorize failed",
        true,
      );
    }
    return { ok: true, job, reused: false, question, lock: bound };
  }
}

/**
 * Service-level start (no charge): lock → refusal-abort pre-check → create / reuse →
 * hand the lock to the job. The route uses the same steps with the charge in between
 * (`decision-report-api.ts`). Does not schedule.
 */
export async function startDecisionReportJob(input: {
  session_id: string;
  locale: string;
  writer_token: unknown;
  freeze_receipt: unknown;
  profile_receipt: unknown;
  regenerate: boolean;
}): Promise<StartDecisionReportOutcome> {
  const plan = await planDecisionReportStart(input);
  if ("ok" in plan) return plan;
  const owner = newReportLockOwner(input.session_id);
  const acq = await acquireDecisionReportStartLock(plan, owner);
  if (acq.kind === "follow") return { ok: true, job: acq.job, reused: true, question: plan.question };
  if (acq.kind === "unconfirmed") return failure(503, "REPORT_LOCK_UNCONFIRMED", acq.reason, true);
  if (acq.kind !== "locked") {
    return failure(409, "REPORT_JOB_BUSY", "Another report start is in progress for this session", true);
  }
  const release = () => releaseOwnedReportLock(owner).catch(() => undefined);
  try {
    const pre = await resumeDecisionReportRefusalAbort(input.session_id);
    if (pre.kind === "unreadable") {
      await release();
      return failure(503, "CHARGE_UNCONFIRMED", "Charge authorization unreadable", true);
    }
    if (pre.kind !== "none") {
      await release();
      return failure(409, "CHARGE_ABORT_IN_PROGRESS", "A refused charge owns this session", true);
    }
    const prepared = await createOrReuseDecisionReportJob(plan, acq.lock);
    if (!prepared.ok) {
      await release();
      return prepared;
    }
    if (isLiveJob(prepared.job)) {
      await updateOwnedReportLock(owner, { holder: "job", job_id: prepared.job.job_id });
    } else {
      await release();
    }
    return { ok: true, job: prepared.job, reused: prepared.reused, question: prepared.question };
  } catch (e) {
    await release();
    throw e;
  }
}

/**
 * The job a start created that cannot proceed because a refusal's abort owns the
 * session: it never runs (same terminal state as a refused job; a later start re-charges).
 */
export async function abandonDecisionReportStartJob(job_id: string, session_id: string, reason: string): Promise<void> {
  await revokeDecisionReportExecution(job_id);
  const job = await getXhighJob(job_id);
  if (job && job.session_id === session_id && isLiveJob(job)) {
    await failXhighJob(job_id, reason, { retryable: false, failure_reason: "charge_refused" });
  }
  await clearDecisionReportDispatch(job_id);
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
  await terminateRefusedJob(job.job_id, job.session_id, reason, { kind: "job" });
}

/**
 * Which lock the termination releases: the one the abort was claimed under (owner-checked),
 * the lock handed to the job itself, or none when that owner cannot be established.
 */
type AbortLockRelease = { kind: "owner"; owner: ReportLockOwner } | { kind: "job" } | { kind: "none" };

function abortLockOf(claimed: ChargeAuthorization): AbortLockRelease {
  if (claimed.abort_lock_token && claimed.abort_lock_owner_attempt_id) {
    return {
      kind: "owner",
      owner: {
        session_id: claimed.session_id,
        lock_token: claimed.abort_lock_token,
        owner_attempt_id: claimed.abort_lock_owner_attempt_id,
      },
    };
  }
  return { kind: "none" };
}

async function terminateRefusedJob(
  job_id: string,
  session_id: string,
  reason: string,
  lock: AbortLockRelease,
): Promise<void> {
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
  // Only the abort's own lock (or the job's): a lock any later request holds stays. A read
  // failure throws — the abort stays incomplete and resumable, nothing is deleted.
  if (lock.kind === "owner") await releaseOwnedReportLock(lock.owner);
  else if (lock.kind === "job") await releaseReportJobLock(session_id, job_id);
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
    await terminateRefusedJob(claimed.abort_job_id, claimed.session_id, "pass_required", abortLockOf(claimed));
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
  /** This call took the resume right and drove the same abort (`outcome`). */
  | { kind: "resumed"; record: ChargeAuthorization; outcome: RefusalAbortOutcome }
  /** The abort read here was finished by another request meanwhile. */
  | { kind: "completed"; record: ChargeAuthorization };

/**
 * A claimed abort belongs to its claimant (or last resumer) while fresh; once idle past
 * the window, a request resumes it only after winning the resume right (CAS on the exact
 * record read), and then drives that same `abort_job_id` — never another job. Losing the
 * right leaves it to the winner. Never creates a job, charges or dispatches.
 */
export async function resumeRefusalAbortRecord(rec: ChargeAuthorization): Promise<RefusalAbortResume> {
  if (rec.state !== "abort_claimed") return { kind: "none" };
  if (Date.now() - abortHeldSince(rec) < DI2_ABORT_CLAIM_MS) return { kind: "held", record: rec };
  await runReportStartHook("before_resume_claim", { session_id: rec.session_id, owner_attempt_id: null });
  const right = await claimRefusalAbortResume(rec);
  if (right.kind === "uncertain") return { kind: "unreadable" };
  if (right.kind === "taken") {
    return { kind: "resumed", record: right.record, outcome: await finishDecisionReportRefusalAbort(right.record) };
  }
  const latest = right.record;
  if (latest?.state === "abort_claimed") return { kind: "held", record: latest };
  if (
    latest?.state === "abort_completed" &&
    latest.abort_attempt_id === rec.abort_attempt_id &&
    latest.abort_job_id === rec.abort_job_id
  ) {
    return { kind: "completed", record: latest };
  }
  return { kind: "none" };
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
      await releaseReportJobLock(job.session_id, job.job_id).catch(() => undefined);
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
  const owner = await acquireReportJobLockForContinue(job);
  if (!owner) {
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
    await releaseOwnedReportLock(owner).catch(() => undefined);
    return failure(409, "REVIVE_FAILED", "Report job could not be resumed", true);
  }
  return { ok: true, job: revived, stage };
}

/**
 * Continue runs the job it revives under a lock handed straight to that job. It takes over
 * only that job's own leftover lock, a terminal / missing job's, or an aged legacy value
 * with no live job; a start inside its window or another live job keeps the session.
 * Unreadable → no lock (busy; nothing revived).
 */
async function acquireReportJobLockForContinue(job: PojuXhighJob): Promise<ReportLockOwner | null> {
  const owner = newReportLockOwner(job.session_id);
  try {
    for (let round = 0; round < 3; round++) {
      if (await tryCreateReportLock(owner, "job", job.job_id)) return owner;
      const cur = await readReportSessionLock(job.session_id);
      if (cur.kind === "absent") continue;
      if (cur.kind === "invalid") return null;
      let abandoned: boolean;
      if (cur.kind === "legacy") {
        const latest = await findLatestXhighJobForSession("decision_report", job.session_id);
        abandoned = !(latest && isLiveJob(latest)) && Date.now() - cur.at >= LEGACY_REPORT_LOCK_ORPHAN_MS;
      } else if (cur.lock.holder === "start") {
        abandoned = Date.now() - cur.lock.touched_at >= REPORT_START_LOCK_IDLE_MS;
      } else if (cur.lock.job_id === job.job_id) {
        abandoned = true;
      } else {
        const other = cur.lock.job_id ? await getXhighJob(cur.lock.job_id) : null;
        abandoned = !(other && other.session_id === job.session_id && isLiveJob(other));
      }
      if (!abandoned) return null;
      if (await takeOverReportLock(cur.raw, owner, "job", job.job_id)) return owner;
    }
  } catch (e) {
    console.error("[decision-report] continue lock unconfirmed", { job_id: job.job_id, e });
  }
  return null;
}
