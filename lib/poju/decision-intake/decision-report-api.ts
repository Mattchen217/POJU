/**
 * M5 — /api/poju/decision-report actions (route body, without the Next.js wrapper).
 *
 *   status    job + analysis + pages; completed only from the committed report record
 *   start     verify Freeze + profile receipts, create or reuse the job for this Freeze.
 *             A reused pending/running job gets a worker if it has none; a new job is
 *             charged once per session, then dispatched.
 *   continue  pending/running → ensure a worker (no new generation, no charge);
 *             interrupted → revive the same job from its checkpoints;
 *             completed → ALREADY_COMPLETED once the report record is confirmed.
 */

import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
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
import {
  clearDecisionReportDispatch,
  hasDecisionReportCharge,
  loadCompletedReport,
  markDecisionReportCharged,
} from "./decision-report-store";

export type DecisionReportChargeResult = { ok: true } | { ok: false; response: Response };

export type DecisionReportApiDeps = DecisionReportDispatchDeps & {
  charge: (input: { sessionId: string; question: string; jointPassRef: string | null }) => Promise<DecisionReportChargeResult>;
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

async function continueAction(job_id: string, session_id: string, deps: DecisionReportApiDeps): Promise<DecisionReportApiReply> {
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

    if (started.reused) {
      if (job.status === "pending" || job.status === "running") {
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
      return json(200, {
        ok: true,
        job_id: job.job_id,
        status: job.status,
        reused: true,
        execution_generation: job.execution_generation ?? null,
      });
    }

    // One charge per session: Regenerate of a session that already ran a report, and any
    // later generation after the first successful charge, are free.
    const charged = (regenerate && started.had_prior_job) || (await hasDecisionReportCharge(session_id));
    if (!charged) {
      const res = await deps.charge({
        sessionId: session_id,
        question: started.question,
        jointPassRef: str(body.joint_pass_ref) || null,
      });
      if (!res.ok) {
        await abortDecisionReportJob(job, "pass_required");
        return { kind: "response", response: res.response };
      }
      await markDecisionReportCharged(session_id).catch((e) => {
        console.warn("[decision-report] charge marker write failed", { session_id, e });
      });
    }

    try {
      await dispatchDecisionReportStage(job.job_id, session_id, "finalize", deps);
    } catch (e) {
      // The job exists and is charged; the next start / continue recovers the worker.
      await clearDecisionReportDispatch(job.job_id).catch(() => undefined);
      console.error("[decision-report] first dispatch failed", { job_id: job.job_id, e });
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
