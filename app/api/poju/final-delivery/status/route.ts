import { NextRequest, NextResponse } from "next/server";

import {
  forceReleaseDeliveryContinueLease,
  loadAllDeliverySegmentReady,
  loadDeliveryContinueLease,
  loadDeliveryJobContinueHops,
} from "@/lib/llm/pro/delivery/delivery-stage-store";
import type { DeliverySegmentReady } from "@/lib/llm/pro/delivery/run-segment-chain";
import {
  DELIVERY_JOB_MAX_CONTINUE_HOPS,
  DELIVERY_JOB_MAX_WALL_MS,
  isDeliveryJobContinueHopExceeded,
  isDeliveryJobWallExceeded,
} from "@/lib/llm/pro/delivery/delivery-retry-policy";
import {
  currentDeliveryDeployGeneration,
  isDeliveryJobFromCurrentDeploy,
} from "@/lib/poju/delivery-deploy-generation";
import {
  failXhighJob,
  getXhighJob,
  releaseXhighSessionLock,
  updateXhighJobStatus,
} from "@/lib/poju/xhigh-job-store";
import { isFinalDeliveryJobInput, isFinalDeliveryJobResult } from "@/lib/poju/xhigh-job-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Heartbeat ~12s while a task runs.
 * If pending/running with no heartbeat → pause (or STOP).
 * Sticky continue leases do not override a stale heartbeat.
 * When segment:ready pages already exist, always pause for Continue — never wipe the book.
 */
const STALE_RUNNING_MS = 45_000;
/** Align status poll abandon with job-level fuse (40m), not the old 90m soft wall. */
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
    const wallTripped = isDeliveryJobWallExceeded(job.created_at) || age_ms > MAX_JOB_AGE_MS;
    const hopTripped = isDeliveryJobContinueHopExceeded(continueHops);
    if (wallTripped || hopTripped) {
      const reason = hopTripped
        ? "job_continue_budget_exhausted"
        : "job_time_budget_exhausted";
      const errorMsg = hopTripped
        ? `STOP: delivery exceeded max continue hops (${continueHops}/${DELIVERY_JOB_MAX_CONTINUE_HOPS}) — tap Regenerate for a new report`
        : `STOP: delivery exceeded max wall duration (${DELIVERY_JOB_MAX_WALL_MS / 60_000}m) — tap Regenerate for a new report`;
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

  // Dead invoke (Vercel kill / dropped after) — heartbeat stale.
  if (
    (job.status === "running" || job.status === "pending") &&
    Date.now() - job.updated_at > STALE_RUNNING_MS
  ) {
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
    // Heal sticky hard-fail so user Continue can re-arm the same job.
    // Never heal user Stop — client cleared pending and must not auto-resume.
    let retryable =
      !userCancelled &&
      (job.retryable === true || job.failure_reason === "interrupted" || hasReady);
    let interrupted =
      !userCancelled &&
      (hasReady || (retryable && job.failure_reason === "interrupted"));
    if (
      !userCancelled &&
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
