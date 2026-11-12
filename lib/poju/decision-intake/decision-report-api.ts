/**
 * M5 — /api/poju/decision-report actions (route body, without the Next.js wrapper).
 *
 *   status    job + analysis + pages; completed only from the committed report record
 *   start     verify Freeze + profile receipts, create or reuse the job for this Freeze,
 *             settle the session's charge authorization, then (only when authorized)
 *             grant the job and give it a worker. One pass per session: later
 *             generations are free only once the session's authorization is confirmed.
 *   continue  pending/running → ensure a worker (no new generation, no new charge);
 *             interrupted → revive the same job from its checkpoints;
 *             completed → ALREADY_COMPLETED once the report record is confirmed.
 *
 * M5-R1 — no job runs on an unconfirmed charge: a pending / uncertain / refused
 * authorization never dispatches, whichever request reaches the job.
 * M5-R1-FU2 — a refusal terminates its job only after winning `refused → abort_claimed`;
 * while that abort is unfinished no request charges, creates, revives or dispatches, and
 * an abandoned one is resumed (same job) by the next start / status / continue.
 * M5-R1-FU3 — start takes the owner-checked session lock before it reads the abort state,
 * and holds it through create / charge until it hands the lock to the job (authorized) or
 * to the refusal's abort, or releases it (owner-checked) on every other exit.
 */

import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
import { getXhighJob } from "@/lib/poju/xhigh-job-store";
import type { PojuXhighJob } from "@/lib/poju/xhigh-job-types";
import {
  dispatchDecisionReportStage,
  ensureDecisionReportWorker,
  type DecisionReportDispatchDeps,
} from "./decision-report-dispatch";
import {
  abandonDecisionReportStartJob,
  acquireDecisionReportStartLock,
  buildDecisionReportStatus,
  continueDecisionReportJob,
  createOrReuseDecisionReportJob,
  finishDecisionReportRefusalAbort,
  planDecisionReportStart,
  resumeDecisionReportRefusalAbort,
  resumeRefusalAbortRecord,
  runReportStartHook,
  sameIdentity,
  type DecisionReportStartPlan,
  type RefusalAbortResume,
  type ServiceFailure,
} from "./decision-report-service";
import { clearDecisionReportDispatch, loadCompletedReport } from "./decision-report-store";
import { isDecisionReportJobInput } from "./decision-report-types";
import {
  claimDecisionReportRefusalAbort,
  grantDecisionReportExecution,
  loadChargeAuthorization,
  settleDecisionReportCharge,
  type ChargeAuthorization,
  type ChargeSettlement,
  type DecisionReportCharge,
} from "./decision-report-charge";
import {
  newReportLockOwner,
  releaseOwnedReportLock,
  reportLockOwnerOf,
  updateOwnedReportLock,
  type ReportLockOwner,
  type ReportSessionLock,
} from "./decision-report-lock";

export type { DecisionReportChargeResult } from "./decision-report-charge";

export type DecisionReportApiDeps = DecisionReportDispatchDeps & {
  charge: DecisionReportCharge;
  modelConfigured?: () => boolean;
};

export type DecisionReportApiReply =
  | { kind: "json"; status: number; body: Record<string, unknown> }
  | { kind: "response"; response: Response };

function str(x: unknown): string {
  return typeof x === "string" ? x.trim() : "";
}

function json(status: number, body: Record<string, unknown>): DecisionReportApiReply {
  return { kind: "json", status, body };
}

function failureReply(f: { status: number; code: string; error: string; retryable: boolean }): DecisionReportApiReply {
  return json(f.status, { ok: false, error: f.error, code: f.code, retryable: f.retryable });
}

/** The job's charge is not confirmed: say so, never dispatch. */
function unauthorizedReply(job_id: string, s: Exclude<ChargeSettlement, { state: "authorized" }>): DecisionReportApiReply {
  if (s.state === "refused") {
    if (s.response) return { kind: "response", response: s.response };
    return json(402, { ok: false, job_id, code: "CHARGE_REFUSED", error: "pass_required", retryable: false });
  }
  if (s.state === "required") {
    return json(402, { ok: false, job_id, code: "CHARGE_REQUIRED", error: "Report has no charge for this session", retryable: false });
  }
  if (s.state === "uncertain") return chargeUnconfirmed(job_id, s.reason);
  if (s.state === "abort_in_progress") return abortInProgress(s.record, "claimed");
  return json(409, { ok: false, job_id, code: "CHARGE_PENDING", error: "Charge for this session is in progress", retryable: true });
}

function chargeUnconfirmed(job_id: string | null, reason: string): DecisionReportApiReply {
  return json(503, {
    ok: false,
    job_id,
    code: "CHARGE_UNCONFIRMED",
    error: `Charge could not be confirmed (${reason}); retry to reconcile`,
    retryable: true,
  });
}

function abortInProgress(record: ChargeAuthorization, reason: string): DecisionReportApiReply {
  return json(409, {
    ok: false,
    job_id: record.abort_job_id ?? null,
    code: "CHARGE_ABORT_IN_PROGRESS",
    error: `A refused charge is still terminating its report job (${reason})`,
    retryable: true,
  });
}

/** The refusal's job is terminated and recorded: the refusal is final for that job. */
function refusalFinal(record: ChargeAuthorization, response: Response | null): DecisionReportApiReply {
  if (response) return { kind: "response", response };
  return json(402, { ok: false, job_id: record.abort_job_id ?? null, code: "CHARGE_REFUSED", error: "pass_required", retryable: false });
}

/**
 * A refusal's abort owns the session. This request never charges, creates, revives or
 * dispatches: it either leaves a live claimant's abort alone or resumes an abandoned one
 * (same `abort_job_id`), and says which.
 */
type OwnedAbortResume = Exclude<RefusalAbortResume, { kind: "none" } | { kind: "unreadable" }>;

function abortOwnsSession(r: RefusalAbortResume): r is OwnedAbortResume {
  return r.kind === "held" || r.kind === "resumed" || r.kind === "completed";
}

function abortResumeReply(r: OwnedAbortResume): DecisionReportApiReply {
  if (r.kind === "held") return abortInProgress(r.record, "claimed");
  if (r.kind === "completed") return refusalFinal(r.record, null);
  return r.outcome.ok ? refusalFinal(r.record, null) : abortInProgress(r.record, r.outcome.reason);
}

function lockUnconfirmed(reason: string): DecisionReportApiReply {
  return json(503, {
    ok: false,
    job_id: null,
    code: "REPORT_LOCK_UNCONFIRMED",
    error: `Report session lock could not be confirmed (${reason}); retry`,
    retryable: true,
  });
}

function busyReply(): DecisionReportApiReply {
  return json(409, {
    ok: false,
    code: "REPORT_JOB_BUSY",
    error: "Another report start is in progress for this session",
    retryable: true,
  });
}

function awaitingCharge(job: PojuXhighJob, reused: boolean): DecisionReportApiReply {
  return json(200, {
    ok: true,
    job_id: job.job_id,
    status: job.status,
    reused,
    worker: "awaiting_charge",
    execution_generation: job.execution_generation ?? null,
  });
}

async function continueAction(job_id: string, session_id: string, deps: DecisionReportApiDeps): Promise<DecisionReportApiReply> {
  const job = await getXhighJob(job_id).catch(() => null);
  if (job && job.session_id === session_id && job.status !== "completed") {
    // Reconcile an unknown outcome (same ref); never open a first charge from Continue.
    const settled = await settleDecisionReportCharge({
      session_id,
      question: "",
      joint_pass_ref: null,
      allowNewCharge: false,
      charge: deps.charge,
    });
    if (settled.state === "abort_in_progress") {
      const r = await resumeRefusalAbortRecord(settled.record);
      if (abortOwnsSession(r)) return abortResumeReply(r);
    }
    if (settled.state !== "authorized") return unauthorizedReply(job_id, settled);
  }

  const ensured = await ensureDecisionReportWorker({ job_id, session_id, deps });
  if (ensured.ok && ensured.state !== "completed") {
    return json(200, {
      ok: true,
      job_id,
      status: ensured.job.status,
      worker: ensured.state,
      stage: ensured.stage,
    });
  }
  if (!ensured.ok && ensured.code === "JOB_MISSING") {
    // The execution job expired; a committed report outlives it.
    const done = await loadCompletedReport(session_id, job_id).catch(() => null);
    if (done) return json(409, { ok: false, code: "ALREADY_COMPLETED", error: "Report already completed", retryable: false });
  }
  if (!ensured.ok && ensured.code !== "JOB_NOT_RUNNING") return failureReply(ensured);

  const cont = await continueDecisionReportJob({ job_id, session_id });
  if (!cont.ok) return failureReply(cont as ServiceFailure);
  const granted = await grantDecisionReportExecution(cont.job);
  if (!granted.ok) {
    return json(402, { ok: false, job_id, code: "CHARGE_NOT_AUTHORIZED", error: `Report job is not authorized to run (${granted.reason})`, retryable: true });
  }
  try {
    await dispatchDecisionReportStage(cont.job.job_id, session_id, cont.stage, deps);
  } catch (e) {
    // The job is revived (pending); the next status / continue recovers its worker.
    await clearDecisionReportDispatch(cont.job.job_id).catch(() => undefined);
    console.error("[decision-report] continue dispatch failed", { job_id, e });
    return json(503, { ok: false, code: "DISPATCH_FAILED", error: "Report worker could not be scheduled", retryable: true });
  }
  return json(200, { ok: true, job_id: cont.job.job_id, status: "running", worker: "dispatched", stage: cont.stage });
}

async function startReusedJob(job: PojuXhighJob, session_id: string, deps: DecisionReportApiDeps): Promise<DecisionReportApiReply> {
  const ensured = await ensureDecisionReportWorker({ job_id: job.job_id, session_id, deps });
  // The job id is still the one to follow; status polling recovers the worker.
  if (!ensured.ok && ensured.code !== "DISPATCH_FAILED") return failureReply(ensured);
  return json(200, {
    ok: true,
    job_id: job.job_id,
    status: ensured.ok ? ensured.job.status : job.status,
    reused: true,
    worker: ensured.ok ? ensured.state : "none",
    execution_generation: job.execution_generation ?? null,
  });
}

/**
 * Start = one critical section under the session lock: take the lock, then (only then)
 * read the refusal-abort state, create / reuse the job, settle the charge, and leave the
 * section by handing the lock to the job (authorized), to the refusal's abort (claimed
 * under this lock; its release step frees it), or by releasing it owner-checked. A start
 * that cannot take the lock never creates, charges, revives or dispatches.
 */
async function startAction(body: Record<string, unknown>, session_id: string, deps: DecisionReportApiDeps): Promise<DecisionReportApiReply> {
  const plan = await planDecisionReportStart({
    session_id,
    locale: str(body.locale) || "zh",
    writer_token: body.writer_token ?? null,
    freeze_receipt: body.freeze_receipt ?? null,
    profile_receipt: body.profile_receipt ?? null,
    regenerate: body.regenerate === true,
  });
  if ("ok" in plan) return failureReply(plan);

  const owner = newReportLockOwner(session_id);
  await runReportStartHook("before_lock", { session_id, owner_attempt_id: owner.owner_attempt_id });
  const acq = await acquireDecisionReportStartLock(plan, owner);
  switch (acq.kind) {
    case "unconfirmed":
      return lockUnconfirmed(acq.reason);
    case "busy":
      return busyReply();
    case "observe":
      return observeStart(plan, acq.job);
    case "follow":
      return followStart(acq.job, session_id, deps);
    case "locked":
      break;
  }

  const exit = { handedOff: false };
  try {
    return await lockedStart(plan, acq.lock, body, deps, exit);
  } catch (e) {
    if (!exit.handedOff) await releaseOwnedReportLock(owner).catch(() => undefined);
    throw e;
  }
}

/**
 * Another start owns the session lock. Read-only: report its job when it is this Freeze's
 * (the driver polls it) or an unfinished refusal abort; never charge, create or advance.
 */
async function observeStart(plan: DecisionReportStartPlan, job: PojuXhighJob | null): Promise<DecisionReportApiReply> {
  const pre = await resumeDecisionReportRefusalAbort(plan.session_id);
  if (pre.kind === "unreadable") return chargeUnconfirmed(null, "authorization_unreadable");
  if (abortOwnsSession(pre)) return abortResumeReply(pre);
  const ji = job && isDecisionReportJobInput(job.input) ? job.input : null;
  const live = job && (job.status === "pending" || job.status === "running");
  if (job && live && ji && !plan.regenerate && sameIdentity(ji, plan.identity)) return awaitingCharge(job, true);
  return busyReply();
}

/** An authorized live job of this Freeze holds the lock: follow it (no charge, no new job). */
async function followStart(job: PojuXhighJob, session_id: string, deps: DecisionReportApiDeps): Promise<DecisionReportApiReply> {
  let rec: ChargeAuthorization | null;
  try {
    rec = await loadChargeAuthorization(session_id);
  } catch {
    return chargeUnconfirmed(job.job_id, "authorization_unreadable");
  }
  if (rec?.state === "authorized") return startReusedJob(job, session_id, deps);
  if (rec?.state === "abort_claimed") {
    const r = await resumeRefusalAbortRecord(rec);
    if (abortOwnsSession(r)) return abortResumeReply(r);
  }
  if (rec?.state === "pending") return awaitingCharge(job, true);
  return busyReply();
}

async function lockedStart(
  plan: DecisionReportStartPlan,
  lock: ReportSessionLock,
  body: Record<string, unknown>,
  deps: DecisionReportApiDeps,
  exit: { handedOff: boolean },
): Promise<DecisionReportApiReply> {
  const session_id = plan.session_id;
  const owner: ReportLockOwner = reportLockOwnerOf(lock);
  const ctx = { session_id, owner_attempt_id: owner.owner_attempt_id };
  const release = async () => {
    await releaseOwnedReportLock(owner).catch((e) => {
      console.error("[decision-report] start lock release unconfirmed", { session_id, e });
    });
  };
  await runReportStartHook("after_lock", ctx);

  // Under the lock, before any job is created, reused or revived (Regenerate included):
  // an unfinished refusal abort owns the session. Unreadable authorization fails closed.
  await runReportStartHook("precheck", ctx);
  const pre = await resumeDecisionReportRefusalAbort(session_id);
  if (pre.kind === "unreadable") {
    await release();
    return chargeUnconfirmed(null, "authorization_unreadable");
  }
  if (abortOwnsSession(pre)) {
    await release();
    return abortResumeReply(pre);
  }

  const prepared = await createOrReuseDecisionReportJob(plan, lock);
  if (!prepared.ok) {
    await release();
    return failureReply(prepared);
  }
  const job = prepared.job;
  const live = job.status === "pending" || job.status === "running";
  if (prepared.reused && !live) {
    await release();
    return json(200, {
      ok: true,
      job_id: job.job_id,
      status: job.status,
      reused: true,
      execution_generation: job.execution_generation ?? null,
    });
  }

  /** A job this start created must not outlive it when the session belongs to an abort. */
  const abandonOwnJob = async (abort_job_id: string | null | undefined) => {
    if (prepared.reused || abort_job_id === job.job_id) return;
    await abandonDecisionReportStartJob(job.job_id, session_id, "STOP: refused charge owns the session").catch((e) => {
      console.error("[decision-report] abandon start job failed", { job_id: job.job_id, e });
    });
  };

  // New or reused, nothing runs before the session's charge is confirmed. A historical
  // job is not a historical charge: only an `authorized` record makes a generation free.
  await runReportStartHook("before_settle", ctx);
  let settled = await settleDecisionReportCharge({
    session_id,
    question: prepared.question,
    joint_pass_ref: str(body.joint_pass_ref) || null,
    allowNewCharge: true,
    charge: deps.charge,
  });
  // A refusal stops the job only through the atomic `refused → abort_claimed` CAS on the
  // record this attempt wrote, claimed under this start's lock (which the abort then
  // releases). A start that re-claims the same record CASes against the same value, so
  // either this job is aborted or the session is charged again — never both.
  if (settled.state === "refused") {
    const stillOwned = await updateOwnedReportLock(owner).catch(() => null);
    if (!stillOwned) {
      // The lock moved on: the abort cannot be bound to this start. Touch nothing.
      return chargeUnconfirmed(job.job_id, "lock_owner_unconfirmed");
    }
    const claim = await claimDecisionReportRefusalAbort(settled, job.job_id, owner);
    switch (claim.kind) {
      case "claimed": {
        exit.handedOff = true;
        const done = await finishDecisionReportRefusalAbort(claim.record);
        return done.ok ? refusalFinal(claim.record, settled.response) : abortInProgress(claim.record, done.reason);
      }
      case "in_progress": {
        await abandonOwnJob(claim.record.abort_job_id);
        await release();
        const r = await resumeRefusalAbortRecord(claim.record);
        return abortOwnsSession(r) ? abortResumeReply(r) : abortInProgress(claim.record, "claimed");
      }
      case "completed":
        await abandonOwnJob(claim.record.abort_job_id);
        await release();
        return refusalFinal(claim.record, settled.response);
      case "superseded":
      case "stale":
        settled = { state: "stale_claim", record: claim.record ?? settled.record };
        break;
      case "uncertain":
        settled = { state: "uncertain", reason: claim.reason };
        break;
    }
  }
  if (settled.state === "abort_in_progress") {
    await abandonOwnJob(settled.record.abort_job_id);
    await release();
    const r = await resumeRefusalAbortRecord(settled.record);
    return abortOwnsSession(r) ? abortResumeReply(r) : abortInProgress(settled.record, "claimed");
  }
  if (settled.state !== "authorized") {
    await release();
    // Another request owns the session's charge: follow the job, do not run it.
    if (settled.state === "pending" || settled.state === "stale_claim") return awaitingCharge(job, prepared.reused);
    return unauthorizedReply(job.job_id, settled);
  }

  // Authorized: the lock passes to the job before anything can run it.
  await runReportStartHook("before_handoff", ctx);
  const handed = await updateOwnedReportLock(owner, { holder: "job", job_id: job.job_id }).catch(() => null);
  if (!handed) {
    // A later start owns the session; it (or status polling) carries this paid job on.
    return json(200, {
      ok: true,
      job_id: job.job_id,
      status: job.status,
      reused: prepared.reused,
      worker: "none",
      execution_generation: job.execution_generation ?? null,
    });
  }
  exit.handedOff = true;

  if (prepared.reused) return startReusedJob(job, session_id, deps);

  const granted = await grantDecisionReportExecution((await getXhighJob(job.job_id)) ?? job);
  if (!granted.ok) {
    // The session is paid; the job just could not be granted yet — Continue recovers it.
    console.error("[decision-report] grant after charge failed", { job_id: job.job_id, reason: granted.reason });
  } else {
    try {
      await dispatchDecisionReportStage(job.job_id, session_id, "finalize", deps);
    } catch (e) {
      // The job exists and is charged; the next start / continue recovers the worker.
      await clearDecisionReportDispatch(job.job_id).catch(() => undefined);
      console.error("[decision-report] first dispatch failed", { job_id: job.job_id, e });
    }
  }
  return json(200, {
    ok: true,
    job_id: job.job_id,
    status: "pending",
    reused: false,
    execution_generation: job.execution_generation ?? null,
  });
}

export async function handleDecisionReportAction(
  body: Record<string, unknown>,
  deps: DecisionReportApiDeps,
): Promise<DecisionReportApiReply> {
  const action = str(body.action);
  const session_id = str(body.session_id);
  if (!session_id) return json(400, { ok: false, error: "session_id required" });

  if (action === "status") {
    const job_id = str(body.job_id);
    if (!job_id) return json(400, { ok: false, error: "job_id required" });
    // A refusal abort abandoned mid-way is finished here too (same job; no charge, no run).
    await resumeDecisionReportRefusalAbort(session_id).catch(() => undefined);
    return json(200, (await buildDecisionReportStatus({ job_id, session_id })) as unknown as Record<string, unknown>);
  }

  if (!(deps.modelConfigured ?? isOpenRouterConfigured)()) {
    return json(503, { ok: false, error: "OpenRouter is not configured (OPENROUTER_API_KEY)." });
  }

  if (action === "continue") {
    const job_id = str(body.job_id);
    if (!job_id) return json(400, { ok: false, error: "job_id required" });
    return continueAction(job_id, session_id, deps);
  }

  if (action === "start") return startAction(body, session_id, deps);

  return json(400, { ok: false, error: "unknown action" });
}
