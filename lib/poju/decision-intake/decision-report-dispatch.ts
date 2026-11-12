/**
 * M5 — Decision Intake 2.0 report worker scheduling (server).
 *
 * One entry for every hop that starts outside a running worker: first schedule after
 * create, Continue after an interrupted run, and recovery of a pending/running job
 * that has no worker (lost dispatch, publish without attach, killed invoke).
 *
 * Worker liveness is the continue lease (single-flight, heartbeat-refreshed) plus the
 * hand-off ACK and the dispatch marker. Recovery never steals a live lease, never
 * creates a new execution generation and never resets completed checkpoints: the stage
 * is derived from the persisted Personal Analysis and page records.
 */

import { activeDeliveryJobMaxWallMs } from "@/lib/llm/pro/delivery/delivery-retry-policy";
import {
  loadDeliveryContinueAck,
  loadDeliveryContinueLease,
  type DeliveryPipelineStage,
} from "@/lib/llm/pro/delivery/delivery-stage-store";
import { isDeliveryJobFromCurrentDeploy } from "@/lib/poju/delivery-deploy-generation";
import {
  getFdExecutionFence,
  getXhighJob,
  releaseXhighSessionLock,
  updateXhighJobStatus,
} from "@/lib/poju/xhigh-job-store";
import type { PojuXhighJob } from "@/lib/poju/xhigh-job-types";
import { isDecisionReportJobInput } from "./decision-report-types";
import {
  claimDecisionReportDispatch,
  clearDecisionReportDispatch,
  loadDecisionReportDispatch,
  markDecisionReportDispatch,
  DI2_DISPATCH_GRACE_S,
} from "./decision-report-store";
import { firstIncompleteDecisionReportStage, runDecisionReportStage } from "./decision-report-runner";
import {
  DecisionReportNotAuthorizedError,
  grantDecisionReportExecution,
  verifyDecisionReportExecution,
} from "./decision-report-charge";

/** How the caller hosts a background invoke (`after()` in the route). */
export type DecisionReportBackground = (task: () => Promise<void>) => void;

export type DecisionReportDispatchDeps = {
  background: DecisionReportBackground;
  /** Wait for a relay-published worker to attach before hosting it here. */
  attachWaitMs?: number;
};

const DEFAULT_ATTACH_WAIT_MS = 30_000;

export type DecisionReportWorkerState = "live" | "dispatching" | "none";

/** Read-only liveness for status: lease held → live; ACK / recent dispatch → dispatching. */
export async function decisionReportWorkerState(job_id: string): Promise<DecisionReportWorkerState> {
  const lease = await loadDeliveryContinueLease(job_id).catch(() => null);
  if (lease) return "live";
  const ack = await loadDeliveryContinueAck(job_id).catch(() => null);
  if (ack) return "dispatching";
  const marker = await loadDecisionReportDispatch(job_id).catch(() => null);
  if (marker && Date.now() - marker.at < DI2_DISPATCH_GRACE_S * 1000) return "dispatching";
  return "none";
}

/**
 * Hand a stage to a worker: relay first (Inngest) when configured and it attaches,
 * otherwise this invoke hosts it in the background. The job shows `pending` until the
 * worker touches it, so the attach wait cannot mistake an unattached job for a live one.
 */
export async function dispatchDecisionReportStage(
  job_id: string,
  session_id: string,
  stage: DeliveryPipelineStage,
  deps: DecisionReportDispatchDeps,
): Promise<"relay" | "background"> {
  const job = await getXhighJob(job_id);
  const granted = job ? await verifyDecisionReportExecution(job) : { ok: false as const, reason: "job_missing" };
  if (!granted.ok) throw new DecisionReportNotAuthorizedError(job_id, granted.reason);
  await markDecisionReportDispatch(job_id, stage);
  await updateXhighJobStatus(job_id, "pending", {
    current_stage: stage,
    accumulated_content: `queued:${stage}:${Date.now()}`,
  });
  const { shouldDispatchContinueViaInngest, publishContinueViaInngest, waitForDeliveryWorker } = await import(
    "@/lib/poju/delivery-continue-dispatch"
  );
  if (shouldDispatchContinueViaInngest()) {
    const published = await publishContinueViaInngest(job_id, stage);
    if (published === "published") {
      if (await waitForDeliveryWorker(job_id, stage, deps.attachWaitMs ?? DEFAULT_ATTACH_WAIT_MS)) return "relay";
      console.warn("[decision-report] relay published but no worker attached — hosting here", { job_id, stage });
      await markDecisionReportDispatch(job_id, stage);
    }
  }
  deps.background(async () => {
    try {
      await runDecisionReportStage(job_id, stage);
    } catch (e) {
      console.error("[decision-report] background stage failed", e);
      await releaseXhighSessionLock("decision_report", session_id).catch(() => undefined);
    }
  });
  return "background";
}

export type EnsureWorkerOutcome =
  | { ok: true; state: "completed"; job: PojuXhighJob }
  | {
      ok: true;
      state: "worker_live" | "dispatch_in_flight" | "dispatched";
      job: PojuXhighJob;
      stage: DeliveryPipelineStage | null;
    }
  | { ok: false; status: number; code: string; error: string; retryable: boolean };

function refuse(status: number, code: string, error: string, retryable: boolean): EnsureWorkerOutcome {
  return { ok: false, status, code, error, retryable };
}

/**
 * A pending/running job must have a worker. Same job, same generation, no charge:
 *  - completed → nothing to do (the caller returns the persisted report);
 *  - live lease → nothing to do (never a second worker);
 *  - hand-off ACK or a dispatch inside the grace window → nothing to do;
 *  - otherwise one caller (NX claim) re-dispatches from the persisted checkpoints.
 * Failed jobs are not handled here (Continue revives them first).
 */
export async function ensureDecisionReportWorker(input: {
  job_id: string;
  session_id: string;
  deps: DecisionReportDispatchDeps;
}): Promise<EnsureWorkerOutcome> {
  const job = await getXhighJob(input.job_id);
  if (
    !job ||
    job.phase !== "decision_report" ||
    job.session_id !== input.session_id ||
    !isDecisionReportJobInput(job.input)
  ) {
    return refuse(404, "JOB_MISSING", "Report job not found or expired", true);
  }
  if (job.status === "completed") return { ok: true, state: "completed", job };
  if (job.status === "failed") {
    return refuse(409, "JOB_NOT_RUNNING", "Report job stopped; Continue it instead", true);
  }
  if (!isDeliveryJobFromCurrentDeploy(job)) {
    return refuse(409, "SUPERSEDED_BY_DEPLOY", "Report job belongs to a previous deployment", true);
  }
  const fence = await getFdExecutionFence(job.session_id);
  if (!fence || fence.generation !== job.execution_generation || fence.authorized_job_id !== job.job_id) {
    return refuse(409, "SUPERSEDED", "A newer report generation owns this session", true);
  }
  if (Date.now() - job.created_at > activeDeliveryJobMaxWallMs()) {
    return refuse(409, "JOB_BUDGET_EXHAUSTED", "Report job time budget exhausted", true);
  }
  const granted = await grantDecisionReportExecution(job);
  if (!granted.ok) {
    return refuse(402, "CHARGE_NOT_AUTHORIZED", `Report job is not authorized to run (${granted.reason})`, true);
  }

  if (await loadDeliveryContinueLease(job.job_id).catch(() => null)) {
    return { ok: true, state: "worker_live", job, stage: null };
  }
  if (await loadDeliveryContinueAck(job.job_id).catch(() => null)) {
    return { ok: true, state: "dispatch_in_flight", job, stage: null };
  }
  const stage = await firstIncompleteDecisionReportStage(job);
  if (!(await claimDecisionReportDispatch(job.job_id, stage))) {
    return { ok: true, state: "dispatch_in_flight", job, stage: null };
  }
  console.warn("[decision-report] no live worker — re-dispatching from checkpoints", {
    job_id: job.job_id,
    stage,
    recorded_stage: job.current_stage ?? null,
  });
  try {
    await dispatchDecisionReportStage(job.job_id, job.session_id, stage, input.deps);
  } catch (e) {
    await clearDecisionReportDispatch(job.job_id).catch(() => undefined);
    console.error("[decision-report] recovery dispatch failed", { job_id: job.job_id, stage, e });
    return refuse(503, "DISPATCH_FAILED", "Report worker could not be scheduled", true);
  }
  return { ok: true, state: "dispatched", job, stage };
}
