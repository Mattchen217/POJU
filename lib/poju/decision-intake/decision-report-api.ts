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
  abortDecisionReportJob,
  buildDecisionReportStatus,
  continueDecisionReportJob,
  startDecisionReportJob,
  type ServiceFailure,
} from "./decision-report-service";
import { clearDecisionReportDispatch, loadCompletedReport } from "./decision-report-store";
import {
  grantDecisionReportExecution,
  loadChargeAuthorization,
  settleDecisionReportCharge,
  type ChargeSettlement,
  type DecisionReportCharge,
} from "./decision-report-charge";

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
  if (s.state === "uncertain") {
    return json(503, {
      ok: false,
      job_id,
      code: "CHARGE_UNCONFIRMED",
      error: `Charge could not be confirmed (${s.reason}); retry to reconcile`,
      retryable: true,
    });
  }
  return json(409, { ok: false, job_id, code: "CHARGE_PENDING", error: "Charge for this session is in progress", retryable: true });
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

  if (action === "start") {
    const regenerate = body.regenerate === true;
    const started = await startDecisionReportJob({
      session_id,
      locale: str(body.locale) || "zh",
      writer_token: body.writer_token ?? null,
      freeze_receipt: body.freeze_receipt ?? null,
      profile_receipt: body.profile_receipt ?? null,
      regenerate,
    });
    if (!started.ok) return failureReply(started);
    const job = started.job;
    const live = job.status === "pending" || job.status === "running";

    if (started.reused && !live) {
      return json(200, {
        ok: true,
        job_id: job.job_id,
        status: job.status,
        reused: true,
        execution_generation: job.execution_generation ?? null,
      });
    }

    // New or reused, nothing runs before the session's charge is confirmed. A historical
    // job is not a historical charge: only an `authorized` record makes a generation free.
    const settled = await settleDecisionReportCharge({
      session_id,
      question: started.question,
      joint_pass_ref: str(body.joint_pass_ref) || null,
      allowNewCharge: true,
      charge: deps.charge,
    });
    if (settled.state === "refused") {
      // A concurrent request may have authorized the session meanwhile; its job runs.
      const now = await loadChargeAuthorization(session_id).catch(() => null);
      if (now?.state !== "authorized") await abortDecisionReportJob(job, "pass_required");
    }
    if (settled.state !== "authorized") {
      if (settled.state === "pending") {
        // Another request owns the session's charge: follow the job, do not run it.
        return json(200, {
          ok: true,
          job_id: job.job_id,
          status: job.status,
          reused: started.reused,
          worker: "awaiting_charge",
          execution_generation: job.execution_generation ?? null,
        });
      }
      return unauthorizedReply(job.job_id, settled);
    }

    if (started.reused) return startReusedJob(job, session_id, deps);

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

  return json(400, { ok: false, error: "unknown action" });
}
