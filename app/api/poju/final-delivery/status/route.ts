import { after, NextRequest, NextResponse } from "next/server";

import { isKvStoreOutage } from "@/lib/kv/upstash-plan-limit";

import { deliveryTaskLeaseHeld, releaseDispatchTaskLease } from "@/lib/llm/pro/delivery/dispatch/task-store";
import {
  forceReleaseDeliveryContinueLease,
  hasLiveDeliveryContinueForStage,
  loadAllDeliverySegmentReady,
  loadDeliveryContinueLease,
  loadDeliveryJobContinueHops,
  type DeliveryPipelineStage,
} from "@/lib/llm/pro/delivery/delivery-stage-store";
import type { DeliverySegmentReady } from "@/lib/llm/pro/delivery/run-segment-chain";
import {
  DELIVERY_JOB_MAX_CONTINUE_HOPS,
  DELIVERY_JOB_MAX_WALL_MS,
  activeDeliveryJobMaxWallMs,
  isDeliveryJobContinueHopExceeded,
} from "@/lib/llm/pro/delivery/delivery-retry-policy";
import { resolveDeliveryWallFuse } from "@/lib/llm/pro/delivery/pipeline-v3/wall-tail";
import {
  currentDeliveryDeployGeneration,
  isDeliveryJobFromCurrentDeploy,
} from "@/lib/poju/delivery-deploy-generation";
import {
  failXhighJob,
  getXhighJob,
  releaseXhighSessionLock,
  setXhighJobContent,
  updateXhighJobStatus,
} from "@/lib/poju/xhigh-job-store";
import { isProductionV3ClosedFailure, productionDeliveryUsesV3 } from "@/lib/llm/pro/delivery/pipeline-v3/flag";
import { isFinalDeliveryJobInput, isFinalDeliveryJobResult } from "@/lib/poju/xhigh-job-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Rescued stage/task runs in after() and needs a full worker budget. */
export const maxDuration = 300;

/**
 * Heartbeat ~12s while a task runs.
 * If pending/running with no heartbeat → pause (or STOP).
 * Sticky continue leases do not override a stale heartbeat.
 * When segment:ready pages already exist, always pause for Continue — never wipe the book.
 */
const STALE_RUNNING_MS = 45_000;
/**
 * Create publishes Inngest and returns while the job is still pending.
 * The worker may not heartbeat within one stale window (cold start / queue).
 * Rearm that hop instead of hard-STOP; do not charge a Pass.
 */
const PENDING_WORKER_GRACE_MS = 3 * 60_000;
/** Still pending with only await_worker stamps → run the stage in this isolate. */
const PENDING_DIRECT_AFTER_MS = 75_000;
/**
 * Running job parked on a publish that never attached (await_continue_ack /
 * await_task_attach / dispatch_parked). Rescue before the 45s hard stop.
 * Above the 12s stage heartbeat so a live invoke is not stolen.
 */
const UNATTACHED_HOP_RESCUE_MS = 15_000;
/** Legacy 40m name kept for the fuse test. Live jobs use activeDeliveryJobMaxWallMs (v3 = 120m). */
const MAX_JOB_AGE_MS = DELIVERY_JOB_MAX_WALL_MS;

const STAGE_PROGRESS_ZH: Record<string, string> = {
  finalize: "正在定稿结构…",
  segments: "正在逐段撰写…",
  assemble: "正在组装报告…",
  completed: "交付完成",
  // legacy labels (in-flight jobs during rollout)
  narrative: "正在撰写正文…",
  evidence: "正在生成依据…",
  mark: "正在打标与润色…",
};

function isPipelineStage(value: string): value is DeliveryPipelineStage {
  return value === "finalize" || value === "segments" || value === "assemble";
}

type UnattachedHop =
  | { kind: "stage"; stage: DeliveryPipelineStage; nextN: number; silentWorker?: boolean }
  | { kind: "task"; task_id: string; nextN: number; silentWorker?: boolean };

/**
 * Publish succeeded and the worker never heartbeated, or a v3.step worker
 * stamped dispatch_task / v3_step and then went silent.
 * A counted direct_continue stamp at n>=1 already failed to start — stop rescuing.
 * silentWorker hops wait out the 45s stale window so a live 12s heartbeat is not stolen.
 */
function classifyUnattachedHop(
  content: string | null | undefined,
  currentStage: string | null,
): UnattachedHop | "capped" | null {
  if (!content) return null;
  const counted = content.match(/^direct_continue:(stage|task):([^:]+):\d+:n(\d+)$/);
  if (counted) {
    const n = Number(counted[3]);
    if (n >= 1) return "capped";
    if (counted[1] === "stage" && isPipelineStage(counted[2])) {
      return { kind: "stage", stage: counted[2], nextN: n + 1 };
    }
    if (counted[1] === "task" && counted[2]) {
      return { kind: "task", task_id: counted[2], nextN: n + 1 };
    }
    return null;
  }
  const ack = content.match(/^(?:await_continue_ack|handoff_continue):([^:]+):\d+/);
  if (ack?.[1] && isPipelineStage(ack[1])) {
    return { kind: "stage", stage: ack[1], nextN: 0 };
  }
  const plainDirect = content.match(/^direct_continue:(finalize|segments|assemble):\d+$/);
  if (plainDirect?.[1] && isPipelineStage(plainDirect[1])) {
    return { kind: "stage", stage: plainDirect[1], nextN: 0 };
  }
  const task = content.match(/^await_task_attach:([^:]+):\d+/);
  if (task?.[1]) return { kind: "task", task_id: task[1], nextN: 0 };
  const runningTask = content.match(/^dispatch_task:([^:]+):(?:\d+|start)$/);
  if (runningTask?.[1]) {
    return { kind: "task", task_id: runningTask[1], nextN: 0, silentWorker: true };
  }
  if (/^v3_step:.+:\d+$/.test(content) && productionDeliveryUsesV3()) {
    return { kind: "task", task_id: "v3.step", nextN: 0, silentWorker: true };
  }
  if (content.startsWith("dispatch_parked:") || content.startsWith("dispatch_scheduled:")) {
    if (currentStage === "assemble") return { kind: "stage", stage: "assemble", nextN: 0 };
    if (productionDeliveryUsesV3()) return { kind: "task", task_id: "v3.step", nextN: 0 };
    if (currentStage === "segments" || currentStage === "finalize") {
      return { kind: "stage", stage: currentStage, nextN: 0 };
    }
  }
  return null;
}

function streamedSegmentsFromReady(ready: DeliverySegmentReady[]) {
  return ready.map((s) => ({
    key: s.key,
    heading: s.heading,
    body: s.body_markdown,
    evidence: s.evidence_markdown,
    interleaved: s.interleaved_markdown ?? "",
    evidence_ready: s.evidence_ready,
    page_schema: s.page_schema ?? undefined,
  }));
}

/**
 * Host the next hop on this status request when publish never became a worker.
 * Returns a running payload when a rescue was started. Null lets the caller
 * keep the normal stale/running path (including hard STOP when rescue is capped).
 */
async function rescueUnattachedRunningJob(
  job: { job_id: string; status: string; updated_at: number; accumulated_content?: string | null },
  currentStage: string | null,
): Promise<NextResponse | null> {
  if (job.status !== "running") return null;
  const age = Date.now() - job.updated_at;
  const hop = classifyUnattachedHop(job.accumulated_content, currentStage);
  if (!hop || hop === "capped") return null;
  // A live v3.step heartbeats every 12s. Only take over once that heartbeat
  // is already past the hard-stop window.
  if (hop.silentWorker && age <= STALE_RUNNING_MS) return null;
  if (age <= UNATTACHED_HOP_RESCUE_MS) return null;

  const { loadDeliveryDispatchDag } = await import("@/lib/llm/pro/delivery/dispatch/task-store");
  const dag = await loadDeliveryDispatchDag(job.job_id).catch(() => null);
  const liveDispatch = dag
    ? Object.values(dag.tasks).filter(
        (t) => t.status === "running" && Date.now() - (t.updated_at || 0) < 330_000,
      )
    : [];
  if (liveDispatch.length > 0) return null;

  if (hop.kind === "stage") {
    const live = await hasLiveDeliveryContinueForStage(job.job_id, hop.stage);
    if (live && age <= STALE_RUNNING_MS) return null;
    if (live) await forceReleaseDeliveryContinueLease(job.job_id).catch(() => undefined);
  } else {
    const held = await deliveryTaskLeaseHeld(job.job_id, hop.task_id);
    if (held && age <= STALE_RUNNING_MS) return null;
    if (held) await releaseDispatchTaskLease(job.job_id, hop.task_id).catch(() => undefined);
  }

  if (hop.silentWorker && hop.kind === "task") {
    let cursor = 0;
    if (hop.task_id === "v3.step") {
      const { loadDeliveryLab } = await import("@/lib/llm/pro/delivery/lab/store");
      const { productionV3LabId } = await import("@/lib/llm/pro/delivery/pipeline-v3/production-run");
      const lab = await loadDeliveryLab(productionV3LabId(job.job_id)).catch(() => null);
      cursor = lab?.cursor_index ?? 0;
    }
    const { noteDeadTaskRescue } = await import("@/lib/llm/pro/delivery/dispatch/task-store");
    const rescueN = await noteDeadTaskRescue(job.job_id, cursor).catch(() => 1);
    if (rescueN > 2) {
      console.warn("[final-delivery-status] silent task rescue capped", {
        job_id: job.job_id,
        cursor,
        n: rescueN,
      });
      return null;
    }
  }

  const stampKind = hop.kind === "stage" ? "stage" : "task";
  const stampId = hop.kind === "stage" ? hop.stage : hop.task_id;
  await setXhighJobContent(
    job.job_id,
    `direct_continue:${stampKind}:${stampId}:${Date.now()}:n${hop.nextN}`,
  ).catch(() => undefined);

  const jobId = job.job_id;
  after(async () => {
    try {
      if (hop.kind === "stage") {
        const { runFinalDeliveryStage } = await import("@/lib/poju/final-delivery-job-runner");
        await runFinalDeliveryStage(jobId, hop.stage);
        return;
      }
      const { runDeliveryTaskDirect } = await import("@/lib/poju/delivery-task-direct");
      await runDeliveryTaskDirect(jobId, hop.task_id);
    } catch (e) {
      console.error("[final-delivery-status] direct hop failed", e);
    }
  });
  console.warn("[final-delivery-status] unattached hop — direct", {
    job_id: jobId,
    kind: hop.kind,
    target: stampId,
    age_ms: age,
    n: hop.nextN,
  });
  const ready = await loadAllDeliverySegmentReady(jobId).catch(() => []);
  const streamed_segments = streamedSegmentsFromReady(ready);
  return NextResponse.json({
    ok: true,
    job_id: jobId,
    status: "running",
    current_stage: currentStage,
    progress_label: STAGE_PROGRESS_ZH[currentStage ?? ""] ?? "正在逐段撰写…",
    streamed_segments: streamed_segments.length ? streamed_segments : undefined,
  });
}

/**
 * Dead invoke / wall timeout: if pages are already checkpointed, pause for Continue
 * (retryable interrupted). Only hard-STOP when the book is still empty.
 */
async function stopDeadJob(
  job_id: string,
  session_id: string | null,
  current_stage: string | null,
  reason: "stale_running" | "job_abandoned" | "job_time_budget_exhausted" | "job_continue_budget_exhausted",
  errorMsg: string,
  error_detail?: Record<string, unknown>,
): Promise<{ paused: boolean; ready_count: number }> {
  const ready = await loadAllDeliverySegmentReady(job_id).catch(() => []);
  const paused = ready.length > 0;
  if (paused) {
    const pauseMsg = `INTERRUPTED at ${current_stage ?? "unknown"}: ${reason} (keeping ${ready.length} ready page(s))`;
    console.warn("[final-delivery-INTERRUPTED]", {
      job_id,
      stage: current_stage,
      reason,
      ready_count: ready.length,
      message: pauseMsg,
    });
    await failXhighJob(job_id, pauseMsg, {
      retryable: true,
      failure_reason: "interrupted",
      current_stage: current_stage ?? undefined,
      error_detail: error_detail
        ? JSON.stringify({
            ...error_detail,
            stop_reason: reason,
            resumable: true,
            ready_count: ready.length,
          })
        : JSON.stringify({ stop_reason: reason, resumable: true, ready_count: ready.length }),
      accumulated_content: `interrupted:${reason}:${current_stage ?? "?"}`.slice(0, 500),
    }).catch(() => undefined);
  } else {
    console.error("[final-delivery-STOP]", {
      job_id,
      stage: current_stage,
      reason,
      message: errorMsg,
    });
    await failXhighJob(job_id, errorMsg, {
      retryable: false,
      // Typed failure_reason stays on known union; stop_reason carries the precise fuse.
      failure_reason:
        reason === "job_time_budget_exhausted" || reason === "job_continue_budget_exhausted"
          ? "job_abandoned"
          : reason,
      current_stage: current_stage ?? undefined,
      error_detail: error_detail
        ? JSON.stringify({ ...error_detail, stop_reason: reason })
        : JSON.stringify({ stop_reason: reason }),
      accumulated_content: `failed:${reason}:${current_stage ?? "?"}`.slice(0, 500),
    }).catch(() => undefined);
  }
  if (session_id) {
    await releaseXhighSessionLock("final_delivery", session_id).catch(() => undefined);
  }
  return { paused, ready_count: ready.length };
}

export async function GET(req: NextRequest) {
  try {
    return await readFinalDeliveryStatus(req);
  } catch (e) {
    if (!isKvStoreOutage(e)) throw e;
    const job_id = req.nextUrl.searchParams.get("job_id")?.trim() || "";
    console.warn("[final-delivery-status] store unavailable", e);
    // 200 + failed so the poller stops. A 500 is treated as a network blip and retried forever.
    return NextResponse.json({
      ok: false,
      job_id,
      status: "failed",
      retryable: true,
      interrupted: false,
      reason: "kv_unavailable",
      error: "delivery status store unavailable — retry the book",
    });
  }
}

async function readFinalDeliveryStatus(req: NextRequest) {
  const job_id = req.nextUrl.searchParams.get("job_id")?.trim();
  if (!job_id) {
    return NextResponse.json({ error: "missing job_id" }, { status: 400 });
  }

  const job = await getXhighJob(job_id);
  if (!job || job.phase !== "final_delivery") {
    return NextResponse.json({ error: "job_not_found" }, { status: 404 });
  }

  const age_ms = Date.now() - job.created_at;
  const current_stage = job.current_stage ?? null;
  const session_id = isFinalDeliveryJobInput(job.input) ? job.input.session_id : job.session_id;

  // Quiet steady /status polls — they drown step logs in Vercel Live.
  // Only speak on terminal / interesting transitions.
  if (job.status !== "running") {
    console.info("[final-delivery-status]", {
      job_id: job.job_id,
      status: job.status,
      current_stage,
      has_result: Boolean(job.result),
      age_ms,
      updated_at: job.updated_at,
      deploy_generation: job.deploy_generation ?? null,
      error: job.status === "failed" ? (job.error ?? null) : null,
      error_detail: job.status === "failed" ? (job.error_detail ?? null) : null,
      accumulated_content:
        job.status === "failed" || job.status === "pending"
          ? (job.accumulated_content ?? null)
          : null,
    });
  }

  // Redeploy kill-switch: prior-deploy in-flight jobs stop without more LLM.
  if (
    (job.status === "running" || job.status === "pending") &&
    !isDeliveryJobFromCurrentDeploy(job)
  ) {
    console.warn("[final-delivery-status] supersede prior-deploy job", {
      job_id: job.job_id,
      stamped: job.deploy_generation ?? null,
      current: currentDeliveryDeployGeneration(),
    });
    await failXhighJob(job.job_id, "STOP: superseded by redeploy", {
      retryable: false,
      failure_reason: "superseded_by_deploy",
      current_stage: current_stage ?? undefined,
      accumulated_content: "failed:superseded_by_deploy",
    }).catch(() => undefined);
    await forceReleaseDeliveryContinueLease(job.job_id).catch(() => undefined);
    if (session_id) {
      await releaseXhighSessionLock("final_delivery", session_id).catch(() => undefined);
    }
    const ready = await loadAllDeliverySegmentReady(job.job_id).catch(() => []);
    const streamed_segments = streamedSegmentsFromReady(ready);
    return NextResponse.json({
      ok: false,
      job_id: job.job_id,
      status: "failed",
      current_stage,
      retryable: false,
      reason: "superseded_by_deploy",
      interrupted: false,
      error: "STOP: superseded by redeploy — tap Regenerate to start a new report",
      streamed_segments: streamed_segments.length ? streamed_segments : undefined,
    });
  }

  // Absolute wall-clock / continue-hop fuse even with a live heartbeat.
  if (job.status === "running" || job.status === "pending") {
    const continueHops = await loadDeliveryJobContinueHops(job.job_id).catch(() => 0);
    const wallFuse = await resolveDeliveryWallFuse({
      job_id: job.job_id,
      created_at: job.created_at,
      stage: current_stage,
    });
    const wallMax = Math.max(MAX_JOB_AGE_MS, wallFuse.limit_ms, activeDeliveryJobMaxWallMs());
    const hopTripped = isDeliveryJobContinueHopExceeded(continueHops);
    if (wallFuse.tripped || hopTripped) {
      const reason = hopTripped
        ? "job_continue_budget_exhausted"
        : "job_time_budget_exhausted";
      const errorMsg = hopTripped
        ? `STOP: delivery exceeded max continue hops (${continueHops}/${DELIVERY_JOB_MAX_CONTINUE_HOPS}) — tap Regenerate for a new report`
        : `STOP: delivery exceeded max wall duration (${wallMax / 60_000}m) — tap Regenerate for a new report`;
      const stopped = await stopDeadJob(
        job.job_id,
        session_id,
        current_stage,
        reason,
        errorMsg,
        { continue_hops: continueHops, stop_reason: reason },
      );
      const ready = await loadAllDeliverySegmentReady(job.job_id).catch(() => []);
      const streamed_segments = streamedSegmentsFromReady(ready);
      return NextResponse.json({
        ok: false,
        job_id: job.job_id,
        status: "failed",
        current_stage,
        retryable: true,
        reason,
        interrupted: stopped.paused || ready.length > 0,
        error: errorMsg,
        streamed_segments: streamed_segments.length ? streamed_segments : undefined,
      });
    }
  }

  const rescued = await rescueUnattachedRunningJob(job, current_stage);
  if (rescued) return rescued;

  // Dead invoke (Vercel kill / dropped after) — heartbeat stale.
  // Dispatch mode: workers park the /continue invoke but keep job alive via task heartbeats.
  // Never false-STOP while DAG still has live running tasks (assign/write can take minutes).
  // Unattached publishes and silent dispatch_task / v3_step heartbeats are rescued above.
  // This STOP is for a hop that died without those stamps, or a rescue that already capped.
  if (
    (job.status === "running" || job.status === "pending") &&
    Date.now() - job.updated_at > STALE_RUNNING_MS
  ) {
    const { loadDeliveryDispatchDag } = await import(
      "@/lib/llm/pro/delivery/dispatch/task-store"
    );
    const dag = await loadDeliveryDispatchDag(job.job_id).catch(() => null);
    const liveDispatch = dag
      ? Object.values(dag.tasks).filter(
          (t) =>
            t.status === "running" &&
            Date.now() - (t.updated_at || 0) < 330_000,
        )
      : [];
    if (liveDispatch.length > 0) {
      console.info("[final-delivery-status] dispatch workers live — skip stale_running", {
        job_id: job.job_id,
        tasks: liveDispatch.map((t) => t.id),
        stale_ms: Date.now() - job.updated_at,
      });
      await setXhighJobContent(
        job.job_id,
        `dispatch_inflight:${liveDispatch.map((t) => t.id).join(",")}:${Date.now()}`,
      ).catch(() => undefined);
      // Fall through as still running (re-read happens only on next poll; return running now).
      const readyLive = await loadAllDeliverySegmentReady(job.job_id).catch(() => []);
      const streamed_segments = streamedSegmentsFromReady(readyLive);
      return NextResponse.json({
        ok: true,
        job_id: job.job_id,
        status: "running",
        current_stage,
        progress_label: STAGE_PROGRESS_ZH[current_stage ?? ""] ?? "正在逐段撰写…",
        streamed_segments: streamed_segments.length ? streamed_segments : undefined,
      });
    }

    const lease = await loadDeliveryContinueLease(job.job_id);
    if (lease) {
      console.warn("[final-delivery-status] lease held but heartbeat stale — treating as dead", {
        job_id: job.job_id,
        stage: current_stage,
        stale_ms: Date.now() - job.updated_at,
        lease_stage: lease.stage,
        lease_expires_at: lease.expires_at,
      });
    }

    // Worker has not entered the stage yet. Killing here makes Inngest skip a still-valid job.
    const ageMs = Date.now() - job.created_at;
    if (job.status === "pending" && ageMs < PENDING_WORKER_GRACE_MS) {
      const wakeStage =
        current_stage === "segments" || current_stage === "assemble" || current_stage === "finalize"
          ? current_stage
          : "finalize";
      const prior = job.accumulated_content ?? "";
      const rearmMatch = prior.match(/^await_worker:[^:]+:\d+:n(\d+)$/);
      const rearms = rearmMatch ? Number(rearmMatch[1]) : prior.startsWith("await_worker:") ? 1 : 0;
      const nextRearm = rearms + 1;
      const alreadyDirect = prior.startsWith("direct_continue:");
      const escalate =
        !alreadyDirect &&
        rearms >= 1 &&
        (nextRearm >= 2 || ageMs >= PENDING_DIRECT_AFTER_MS);
      if (escalate) {
        await setXhighJobContent(
          job.job_id,
          `direct_continue:${wakeStage}:${Date.now()}`,
        ).catch(() => undefined);
        const { runFinalDeliveryJob } = await import("@/lib/poju/final-delivery-job-runner");
        after(async () => {
          try {
            await runFinalDeliveryJob(job.job_id);
          } catch (e) {
            console.error("[final-delivery-status] direct continue failed", e);
          }
        });
        console.warn("[final-delivery-status] pending await_worker — direct continue", {
          job_id: job.job_id,
          stage: wakeStage,
          age_ms: ageMs,
          rearms,
        });
      } else if (!alreadyDirect) {
        await setXhighJobContent(
          job.job_id,
          `await_worker:${wakeStage}:${Date.now()}:n${nextRearm}`,
        ).catch(() => undefined);
        const { publishContinueViaInngest, shouldDispatchContinueViaInngest } = await import(
          "@/lib/poju/delivery-continue-dispatch"
        );
        if (shouldDispatchContinueViaInngest()) {
          await publishContinueViaInngest(job.job_id, wakeStage).catch(() => undefined);
        }
        console.info("[final-delivery-status] pending before worker heartbeat — rearm continue", {
          job_id: job.job_id,
          stage: wakeStage,
          age_ms: ageMs,
          stale_ms: Date.now() - job.updated_at,
          rearms: nextRearm,
        });
      } else {
        await setXhighJobContent(
          job.job_id,
          `direct_continue:${wakeStage}:${Date.now()}`,
        ).catch(() => undefined);
      }
      return NextResponse.json({
        ok: true,
        job_id: job.job_id,
        status: "pending",
        current_stage: wakeStage,
        progress_label: STAGE_PROGRESS_ZH[wakeStage] ?? STAGE_PROGRESS_ZH.finalize,
      });
    }

    const errorMsg = `STOP at ${current_stage ?? "unknown"}: stale_running (no heartbeat >${STALE_RUNNING_MS}ms; no auto-resume)`;
    const stopped = await stopDeadJob(job.job_id, session_id, current_stage, "stale_running", errorMsg, {
      stage: current_stage,
      updated_at: job.updated_at,
      stale_ms: Date.now() - job.updated_at,
      was_status: job.status,
      lease_ignored: Boolean(lease),
    });
    const ready = await loadAllDeliverySegmentReady(job.job_id).catch(() => []);
    const streamed_segments = streamedSegmentsFromReady(ready);
    return NextResponse.json({
      ok: false,
      job_id: job.job_id,
      status: "failed",
      current_stage,
      retryable: stopped.paused,
      reason: stopped.paused ? "interrupted" : "stale_running",
      interrupted: stopped.paused,
      error: errorMsg,
      streamed_segments: streamed_segments.length ? streamed_segments : undefined,
    });
  }

  if (job.status === "completed" && isFinalDeliveryJobResult(job.result)) {
    return NextResponse.json({
      ok: true,
      job_id: job.job_id,
      status: job.status,
      current_stage: "completed",
      progress_label: STAGE_PROGRESS_ZH.completed,
      full_text: job.result.full_text,
      actions: job.result.actions,
      model: job.result.model ?? job.model,
      tokens_used: job.result.tokens_used ?? job.tokens_used ?? 0,
      llm_debug: job.result.llm_debug ?? job.llm_debug,
      timings: job.result.timings,
      cost_usd: 0,
    });
  }

  if (job.status === "completed" && !isFinalDeliveryJobResult(job.result)) {
    const ready = await loadAllDeliverySegmentReady(job.job_id).catch(() => []);
    const streamed_segments = streamedSegmentsFromReady(ready);
    const canPause = streamed_segments.length > 0;
    return NextResponse.json({
      ok: false,
      job_id: job.job_id,
      status: "failed",
      current_stage,
      retryable: canPause,
      reason: canPause ? "interrupted" : "completed_without_result",
      interrupted: canPause,
      error: "job completed but delivery result missing",
      streamed_segments: streamed_segments.length ? streamed_segments : undefined,
    });
  }

  if (job.status === "failed") {
    // Always surface ready pages — even hard STOPs may leave segment:ready checkpoints.
    const ready = await loadAllDeliverySegmentReady(job.job_id);
    const streamed_segments = streamedSegmentsFromReady(ready);
    const hasReady = streamed_segments.length > 0;
    const userCancelled = job.failure_reason === "user_cancelled";
    const v3Closed = isProductionV3ClosedFailure(job.failure_reason);
    // Heal sticky hard-fail so user Continue can re-arm the same job.
    // Never heal user Stop — client cleared pending and must not auto-resume.
    // Never heal v3_step_failed — that close must not resume onto the legacy DAG.
    let retryable =
      !userCancelled &&
      !v3Closed &&
      (job.retryable === true || job.failure_reason === "interrupted" || hasReady);
    let interrupted =
      !userCancelled &&
      !v3Closed &&
      (hasReady || (retryable && job.failure_reason === "interrupted"));
    if (
      !userCancelled &&
      !v3Closed &&
      hasReady &&
      !(job.retryable === true || job.failure_reason === "interrupted")
    ) {
      await updateXhighJobStatus(job.job_id, "failed", {
        retryable: true,
        failure_reason: "interrupted",
        accumulated_content: `interrupted:heal_ready:${job.failure_reason ?? "transport_error"}`.slice(
          0,
          500,
        ),
      }).catch(() => undefined);
      retryable = true;
      interrupted = true;
    }
    return NextResponse.json({
      ok: false,
      job_id: job.job_id,
      status: "failed",
      current_stage,
      retryable,
      reason: userCancelled
        ? "user_cancelled"
        : interrupted
          ? "interrupted"
          : (job.failure_reason ?? "transport_error"),
      interrupted,
      error: job.error ?? "final delivery failed",
      error_detail: job.error_detail ?? null,
      accumulated_content: job.accumulated_content ?? null,
      streamed_segments: streamed_segments.length ? streamed_segments : undefined,
    });
  }

  const stageKey = current_stage ?? "finalize";
  // Stream only from segment:ready (not stage-local task checkpoints).
  const ready = await loadAllDeliverySegmentReady(job.job_id);
  const streamed_segments = streamedSegmentsFromReady(ready);

  const zh = isFinalDeliveryJobInput(job.input)
    ? job.input.locale.startsWith("zh")
    : true;
  const progress_label =
    streamed_segments.length > 0
      ? zh
        ? `已完成 ${streamed_segments.length} 段…`
        : `${streamed_segments.length} section(s) ready…`
      : (STAGE_PROGRESS_ZH[stageKey] ?? stageKey);

  return NextResponse.json({
    ok: true,
    job_id: job.job_id,
    status: job.status,
    current_stage: stageKey,
    progress_label,
    accumulated_content: job.accumulated_content,
    streamed_segments,
  });
}
