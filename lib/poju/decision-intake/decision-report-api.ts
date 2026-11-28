/**
 * M5 — /api/poju/decision-report actions (route body, without the Next.js wrapper).
 *
 *   status    job + analysis + pages; completed only from the committed report record
 *   start     verify Freeze + profile receipts, create or reuse the job for this Freeze,
 *             settle the session's charge authorization, then (only when authorized)
 *             grant the job and give it a worker. One pass per session: later
 *             generations are free only once the session's authorization is confirmed.
 *   continue  Unit D → Batch2/3 Recovery via persisted identity binding (RECOVER);
 *             no new Generation / identity; never the legacy DI2 eight-page runner.
 *
 * M5-R1 — no job runs on an unconfirmed charge: a pending / uncertain / refused
 * authorization never dispatches, whichever request reaches the job.
 * M5-R1-FU2 — a refusal terminates its job only after winning `refused → abort_claimed`;
 * while that abort is unfinished no request charges, creates, revives or dispatches, and
 * an abandoned one is resumed (same job) by the next start / status / continue.
 * M5-R1-FU3 — start takes the owner-checked session lock before it reads the abort state,
 * and holds it through create / charge until it hands the lock to the job (authorized) or
 * to the refusal's abort, or releases it (owner-checked) on every other exit.
 * M5-R1-FU4 — a report (analysis, pages, result) is returned, continued or reused only
 * under the job's own durable delivery authorization; a refusal revokes it for good.
 */

import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
import { getXhighJob } from "@/lib/poju/xhigh-job-store";
import type { PojuXhighJob } from "@/lib/poju/xhigh-job-types";
import {
  type DecisionReportDispatchDeps,
} from "./decision-report-dispatch";
import {
  abandonDecisionReportStartJob,
  acquireDecisionReportStartLock,
  buildDecisionReportStatus,
  createOrReuseDecisionReportJob,
  deliveryDeniedFailure,
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
import { loadCompletedReport } from "./decision-report-store";
import { isDecisionReportJobInput } from "./decision-report-types";
import {
  claimDecisionReportRefusalAbort,
  grantDecisionReportExecution,
  loadChargeAuthorization,
  settleDecisionReportCharge,
  verifyDecisionReportDelivery,
  type ChargeAuthorization,
  type ChargeSettlement,
  type DecisionReportCharge,
} from "./decision-report-charge";
import {
  newReportLockOwner,
  readReportSessionLock,
  releaseOwnedReportLock,
  reportLockOwnerOf,
  isReportStartLockIdle,
  takeOverReportLock,
  tryCreateReportLock,
  updateOwnedReportLock,
  type ReportLockOwner,
  type ReportSessionLock,
} from "./decision-report-lock";
import { startDi2Batch2Production } from "./decision-report-batch2-start";
import { continueDi2Batch2Production } from "./decision-report-batch2-continue";
import { evaluateExistingDi2Batch2Binding } from "./decision-report-batch2-identity";
import {
  assertBrowserTaskCredential,
  bindBrowserTaskCredential,
  type TaskCredentialGateFailure,
} from "./browser-task-credential";

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

function credentialFromBody(body: Record<string, unknown>): unknown {
  return body.browser_task_credential ?? body.task_credential ?? null;
}

function credentialGateReply(f: TaskCredentialGateFailure): DecisionReportApiReply {
  return json(f.status, { ok: false, code: f.code, error: f.error, retryable: false });
}

async function requireTaskCredential(
  body: Record<string, unknown>,
  session_id: string,
  job_id: string,
): Promise<DecisionReportApiReply | null> {
  const gate = await assertBrowserTaskCredential({
    job_id,
    session_id,
    credential: credentialFromBody(body),
  });
  if (!gate.ok) return credentialGateReply(gate);
  return null;
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

/**
 * Unit D — Continue / Recovery → Batch2/3 only.
 * Never falls back to ensureDecisionReportWorker / dispatchDecisionReportStage
 * (legacy DI2 eight-page runner).
 */
async function continueAction(job_id: string, session_id: string, deps: DecisionReportApiDeps): Promise<DecisionReportApiReply> {
  void deps;
  const job = await getXhighJob(job_id).catch(() => null);
  if (!job || job.session_id !== session_id) {
    const done = await loadCompletedReport(session_id, job_id).catch(() => null);
    if (done) {
      const delivery = await verifyDecisionReportDelivery(done);
      if (!delivery.ok) return failureReply(deliveryDeniedFailure(delivery));
      return json(409, {
        ok: false,
        code: "ALREADY_COMPLETED",
        error: "Report already completed",
        retryable: false,
      });
    }
    return json(404, {
      ok: false,
      code: "JOB_MISSING",
      error: "Report job not found or expired",
      retryable: true,
    });
  }

  if (job.status !== "completed") {
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

  // Identity binding must already exist from Unit C Start — never allocate here.
  const bindingEval = evaluateExistingDi2Batch2Binding(job);
  if (!bindingEval.ok) {
    return json(409, {
      ok: false,
      code:
        bindingEval.code === "missing_job"
          ? "BATCH2_BINDING_MISSING"
          : "BATCH2_BINDING_INVALID",
      error: bindingEval.detail,
      retryable: false,
      job_id,
      execution_generation: job.execution_generation ?? null,
    });
  }

  const owner = newReportLockOwner(session_id);
  let handedOff = false;
  try {
    const cur = await readReportSessionLock(session_id);
    if (cur.kind === "owned") {
      if (cur.lock.holder === "start" && !isReportStartLockIdle(cur.lock)) {
        return busyReply();
      }
      const taken = await takeOverReportLock(
        cur.raw,
        owner,
        "start",
        job.job_id,
      );
      if (!taken) return busyReply();
    } else if (cur.kind === "absent") {
      const created = await tryCreateReportLock(owner, "start", job.job_id);
      if (!created) return busyReply();
    } else if (cur.kind === "legacy") {
      const taken = await takeOverReportLock(cur.raw, owner, "start", job.job_id);
      if (!taken) return busyReply();
    } else {
      return lockUnconfirmed("continue_lock_unreadable");
    }

    const continued = await continueDi2Batch2Production({
      job_id,
      lock_owner: owner,
    });

    const handed = await updateOwnedReportLock(owner, {
      holder: "job",
      job_id: job.job_id,
    }).catch(() => null);
    if (handed) handedOff = true;
    else handedOff = true; // paid job; do not release another owner's lock

    if (!continued.ok) {
      console.error("[decision-report] Batch2 continue failed", {
        job_id,
        code: continued.code,
        detail: continued.detail,
      });
      return json(
        continued.code === "dispatch_uncertain" ||
          continued.code === "kv_unavailable" ||
          continued.code === "inngest_unavailable" ||
          continued.code === "session_lock_lost"
          ? 503
          : 409,
        {
          ok: false,
          code: continued.code,
          error: continued.detail,
          retryable:
            continued.code === "dispatch_uncertain" ||
            continued.code === "kv_unavailable" ||
            continued.code === "inngest_unavailable" ||
            continued.code === "session_lock_lost" ||
            continued.code === "cas_failed",
          job_id,
          execution_generation: job.execution_generation ?? null,
        },
      );
    }

    return json(200, {
      ok: true,
      job_id,
      status:
        continued.outcome === "delivered"
          ? "completed"
          : continued.outcome === "ready_for_delivery"
            ? "completed_batch2"
            : continued.job.status === "pending"
              ? "pending"
              : continued.job.status,
      worker:
        continued.outcome === "delivered"
          ? "di2_final_delivery"
          : continued.outcome === "ready_for_delivery"
            ? "batch2_ready_for_delivery"
            : continued.recover_sent
              ? "batch2_recovered"
              : "batch2_observing",
      outcome: continued.outcome,
      batch2_report_id: continued.binding.report_id,
      batch2_generation_id: continued.binding.generation_id,
      batch2_status: continued.batch2_status,
      recover_sent: continued.recover_sent,
      execution_generation: job.execution_generation ?? null,
    });
  } finally {
    if (!handedOff) await releaseOwnedReportLock(owner).catch(() => undefined);
  }
}

function batch2StartFailureReply(
  started: { ok: false; code: string; detail: string },
  job_id: string,
  execution_generation: number | null | undefined,
): DecisionReportApiReply {
  return json(started.code === "dispatch_uncertain" ? 503 : 409, {
    ok: false,
    code: started.code,
    error: started.detail,
    retryable:
      started.code === "dispatch_uncertain" ||
      started.code === "kv_unavailable" ||
      started.code === "inngest_unavailable" ||
      started.code === "cas_failed" ||
      started.code === "session_lock_lost",
    job_id,
    execution_generation: execution_generation ?? null,
  });
}

async function startReusedJob(
  job: PojuXhighJob,
  plan: DecisionReportStartPlan,
  birth_info: unknown,
  deps: DecisionReportApiDeps,
  lock_owner: ReportLockOwner,
): Promise<DecisionReportApiReply> {
  void deps;
  // Unit C R2: reused Start resumes Batch2 only while holding session start lock.
  const started = await startDi2Batch2Production({
    job_id: job.job_id,
    freeze: plan.freezeRec,
    profile: plan.profile,
    birth_info,
    lock_owner,
  });
  if (!started.ok) {
    return batch2StartFailureReply(
      started,
      job.job_id,
      job.execution_generation,
    );
  }
  if (job.status === "completed" || started.job.status === "completed") {
    const delivery = await verifyDecisionReportDelivery(started.job);
    if (!delivery.ok) return failureReply(deliveryDeniedFailure(delivery));
  }
  return json(200, {
    ok: true,
    job_id: job.job_id,
    status: started.job.status === "pending" ? "pending" : started.job.status,
    reused: true,
    worker: started.reused ? "batch2_reused" : "batch2_started",
    execution_generation: job.execution_generation ?? null,
    batch2_report_id: started.binding.report_id,
    batch2_generation_id: started.binding.generation_id,
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
  // Unit B — start always requires the originating-browser credential (bound after job id exists).
  if (!str(String(credentialFromBody(body) ?? ""))) {
    return json(401, {
      ok: false,
      code: "TASK_CREDENTIAL_REQUIRED",
      error: "browser_task_credential required",
      retryable: false,
    });
  }

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
      return observeStart(plan, acq.job, body);
    case "follow":
      return followStart(acq.job, plan, body, deps);
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
async function observeStart(
  plan: DecisionReportStartPlan,
  job: PojuXhighJob | null,
  body: Record<string, unknown>,
): Promise<DecisionReportApiReply> {
  const pre = await resumeDecisionReportRefusalAbort(plan.session_id);
  if (pre.kind === "unreadable") return chargeUnconfirmed(null, "authorization_unreadable");
  if (abortOwnsSession(pre)) return abortResumeReply(pre);
  const ji = job && isDecisionReportJobInput(job.input) ? job.input : null;
  const live = job && (job.status === "pending" || job.status === "running");
  if (job && live && ji && !plan.regenerate && sameIdentity(ji, plan.identity)) {
    // Busy peer start owns the lock — still require originating-browser credential.
    const bound = await bindBrowserTaskCredential({
      job_id: job.job_id,
      session_id: plan.session_id,
      credential: String(credentialFromBody(body) ?? ""),
    });
    if (!bound.ok) return credentialGateReply(bound);
    return awaitingCharge(job, true);
  }
  return busyReply();
}

/** An authorized live job of this Freeze holds the lock: follow it (no charge, no new job). */
async function followStart(
  job: PojuXhighJob,
  plan: DecisionReportStartPlan,
  body: Record<string, unknown>,
  deps: DecisionReportApiDeps,
): Promise<DecisionReportApiReply> {
  const bound = await bindBrowserTaskCredential({
    job_id: job.job_id,
    session_id: plan.session_id,
    credential: String(credentialFromBody(body) ?? ""),
  });
  if (!bound.ok) return credentialGateReply(bound);

  let rec: ChargeAuthorization | null;
  try {
    rec = await loadChargeAuthorization(plan.session_id);
  } catch {
    return chargeUnconfirmed(job.job_id, "authorization_unreadable");
  }
  if (rec?.state === "authorized") {
    // R2: take the job-held session lock into holder "start" so Batch2 reuse
    // remains mutually exclusive with Regenerate supersede.
    const owner = newReportLockOwner(plan.session_id);
    let handedOff = false;
    try {
      const cur = await readReportSessionLock(plan.session_id);
      if (cur.kind !== "owned") {
        return lockUnconfirmed("follow_lock_unreadable");
      }
      if (cur.lock.holder === "start" && !isReportStartLockIdle(cur.lock)) {
        return busyReply();
      }
      const taken = await takeOverReportLock(cur.raw, owner, "start", job.job_id);
      if (!taken) return busyReply();
      const reply = await startReusedJob(job, plan, body.birth_info ?? undefined, deps, owner);
      const handed = await updateOwnedReportLock(owner, {
        holder: "job",
        job_id: job.job_id,
      }).catch(() => null);
      if (handed) handedOff = true;
      return reply;
    } finally {
      if (!handedOff) await releaseOwnedReportLock(owner).catch(() => undefined);
    }
  }
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

  // Unit B — bind originating-browser task credential before any further access.
  const bound = await bindBrowserTaskCredential({
    job_id: job.job_id,
    session_id,
    credential: String(credentialFromBody(body) ?? ""),
  });
  if (!bound.ok) {
    await release();
    return credentialGateReply(bound);
  }

  const live = job.status === "pending" || job.status === "running";
  if (prepared.reused && !live) {
    await release();
    return json(200, {
      ok: true,
      job_id: job.job_id,
      status: job.status,
      reused: true,
      execution_generation: job.execution_generation ?? null,
      browser_task_credential_bound: true,
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

  // Authorized: keep holder "start" through Batch2 critical side effects so
  // Regenerate (supersede under createOrReuse) cannot interleave. Hand off to
  // job only after Batch2 Start returns.
  const birth_info = body.birth_info ?? undefined;

  if (prepared.reused) {
    try {
      const reusedReply = await startReusedJob(job, plan, birth_info, deps, owner);
      const handed = await updateOwnedReportLock(owner, {
        holder: "job",
        job_id: job.job_id,
      }).catch(() => null);
      if (handed) exit.handedOff = true;
      else {
        // Paid job exists; later start/status may carry it. Do not release into void.
        exit.handedOff = true;
      }
      return reusedReply;
    } catch (e) {
      console.error("[decision-report] Batch2 reused start threw", {
        job_id: job.job_id,
        e,
      });
      const handed = await updateOwnedReportLock(owner, {
        holder: "job",
        job_id: job.job_id,
      }).catch(() => null);
      if (handed) exit.handedOff = true;
      return json(503, {
        ok: false,
        code: "BATCH2_START_UNCERTAIN",
        error: e instanceof Error ? e.message : String(e),
        retryable: true,
        job_id: job.job_id,
        execution_generation: job.execution_generation ?? null,
      });
    }
  }

  const granted = await grantDecisionReportExecution((await getXhighJob(job.job_id)) ?? job);
  if (!granted.ok) {
    // The session is paid; the job just could not be granted yet — Continue recovers it.
    console.error("[decision-report] grant after charge failed", { job_id: job.job_id, reason: granted.reason });
    const handed = await updateOwnedReportLock(owner, {
      holder: "job",
      job_id: job.job_id,
    }).catch(() => null);
    if (handed) exit.handedOff = true;
    return json(200, {
      ok: true,
      job_id: job.job_id,
      status: "pending",
      reused: false,
      worker: "none",
      execution_generation: job.execution_generation ?? null,
    });
  }

  // Unit C R2 — Batch2 under session start lock (legacy DI2 runner disconnected).
  try {
    const started = await startDi2Batch2Production({
      job_id: job.job_id,
      freeze: plan.freezeRec,
      profile: plan.profile,
      birth_info,
      lock_owner: owner,
    });
    const handed = await updateOwnedReportLock(owner, {
      holder: "job",
      job_id: job.job_id,
    }).catch(() => null);
    if (handed) exit.handedOff = true;
    else exit.handedOff = true; // paid; avoid releasing another owner's lock

    if (!started.ok) {
      console.error("[decision-report] Batch2 start failed", {
        job_id: job.job_id,
        code: started.code,
        detail: started.detail,
      });
      return batch2StartFailureReply(
        started,
        job.job_id,
        job.execution_generation,
      );
    }
    return json(200, {
      ok: true,
      job_id: job.job_id,
      status: "pending",
      reused: false,
      worker: started.reused ? "batch2_reused" : "batch2_started",
      execution_generation: job.execution_generation ?? null,
      batch2_report_id: started.binding.report_id,
      batch2_generation_id: started.binding.generation_id,
    });
  } catch (e) {
    // Do not fall back to the legacy DI2 runner. Leave recoverable job state.
    console.error("[decision-report] Batch2 start threw", { job_id: job.job_id, e });
    const handed = await updateOwnedReportLock(owner, {
      holder: "job",
      job_id: job.job_id,
    }).catch(() => null);
    if (handed) exit.handedOff = true;
    else exit.handedOff = true;
    return json(503, {
      ok: false,
      code: "BATCH2_START_UNCERTAIN",
      error: e instanceof Error ? e.message : String(e),
      retryable: true,
      job_id: job.job_id,
      execution_generation: job.execution_generation ?? null,
    });
  }
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
    const denied = await requireTaskCredential(body, session_id, job_id);
    if (denied) return denied;
    const { loadReportLifecycle, isReportLifecycleContentExpired, purgeReportPersonalContent } =
      await import("./report-data-lifecycle");
    const life = await loadReportLifecycle(job_id);
    if (life && isReportLifecycleContentExpired(life)) {
      await purgeReportPersonalContent({
        job_id,
        session_id,
        reason: life.content_expires_at && Date.parse(life.content_expires_at) <= Date.now() ? "ttl" : "absolute",
      }).catch(() => undefined);
      return json(410, {
        ok: false,
        code: "REPORT_CONTENT_EXPIRED",
        error: "Report personal content expired and was purged",
        retryable: false,
      });
    }
    // A refusal abort abandoned mid-way is finished here too (same job; no charge, no run).
    await resumeDecisionReportRefusalAbort(session_id).catch(() => undefined);
    return json(200, (await buildDecisionReportStatus({ job_id, session_id })) as unknown as Record<string, unknown>);
  }

  if (action === "claim") {
    const job_id = str(body.job_id);
    if (!job_id) return json(400, { ok: false, error: "job_id required" });
    const denied = await requireTaskCredential(body, session_id, job_id);
    if (denied) return denied;
    const done = await loadCompletedReport(session_id, job_id).catch(() => null);
    if (!done) {
      return json(404, {
        ok: false,
        code: "REPORT_NOT_READY",
        error: "Completed report is not available for claim",
        retryable: true,
      });
    }
    const delivery = await verifyDecisionReportDelivery(done);
    if (!delivery.ok) return failureReply(deliveryDeniedFailure(delivery));
    return json(200, {
      ok: true,
      action: "claim",
      job_id,
      session_id,
      report_job_id: done.report_job_id,
      execution_generation: done.execution_generation,
      committed_at: done.committed_at,
      result: done.result,
      pages: done.pages,
      analysis: done.analysis,
    });
  }

  if (!(deps.modelConfigured ?? isOpenRouterConfigured)()) {
    return json(503, { ok: false, error: "OpenRouter is not configured (OPENROUTER_API_KEY)." });
  }

  if (action === "continue") {
    const job_id = str(body.job_id);
    if (!job_id) return json(400, { ok: false, error: "job_id required" });
    const denied = await requireTaskCredential(body, session_id, job_id);
    if (denied) return denied;
    return continueAction(job_id, session_id, deps);
  }

  if (action === "start") return startAction(body, session_id, deps);

  return json(400, { ok: false, error: "unknown action" });
}
