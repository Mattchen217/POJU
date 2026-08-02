import { NextRequest, NextResponse } from "next/server";

import {
  loadAllDeliverySegmentReady,
  loadDeliveryContinueLease,
} from "@/lib/llm/pro/delivery/delivery-stage-store";
import {
  failXhighJob,
  getXhighJob,
  releaseXhighSessionLock,
} from "@/lib/poju/xhigh-job-store";
import { isFinalDeliveryJobInput, isFinalDeliveryJobResult } from "@/lib/poju/xhigh-job-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Heartbeat ~12s while a task runs.
 * If pending/running with no heartbeat and no continue lease → FAIL and stop.
 * No stale-resume / auto-retry — one chain, one chance.
 */
const STALE_RUNNING_MS = 45_000;
const MAX_JOB_AGE_MS = 5_400_000;

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

async function stopDeadJob(
  job_id: string,
  session_id: string | null,
  current_stage: string | null,
  reason: "stale_running" | "job_abandoned",
  errorMsg: string,
  error_detail?: Record<string, unknown>,
): Promise<void> {
  console.error("[final-delivery-STOP]", {
    job_id,
    stage: current_stage,
    reason,
    message: errorMsg,
  });
  await failXhighJob(job_id, errorMsg, {
    retryable: false,
    failure_reason: reason,
    current_stage: current_stage ?? undefined,
    error_detail: error_detail ? JSON.stringify(error_detail) : undefined,
    accumulated_content: `failed:${reason}:${current_stage ?? "?"}`.slice(0, 500),
  }).catch(() => undefined);
  if (session_id) {
    await releaseXhighSessionLock("final_delivery", session_id).catch(() => undefined);
  }
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

  console.info("[final-delivery-status]", {
    job_id: job.job_id,
    status: job.status,
    current_stage,
    has_result: Boolean(job.result),
    age_ms,
    updated_at: job.updated_at,
    error: job.status === "failed" ? (job.error ?? null) : null,
    error_detail: job.status === "failed" ? (job.error_detail ?? null) : null,
    accumulated_content:
      job.status === "failed" || job.status === "running" || job.status === "pending"
        ? (job.accumulated_content ?? null)
        : null,
  });

  if (
    (job.status === "running" || job.status === "pending") &&
    age_ms > MAX_JOB_AGE_MS
  ) {
    const errorMsg = "STOP: background job exceeded max wall duration";
    await stopDeadJob(job.job_id, session_id, current_stage, "job_abandoned", errorMsg);
    return NextResponse.json({
      ok: false,
      job_id: job.job_id,
      status: "failed",
      current_stage,
      retryable: false,
      reason: "job_abandoned",
      error: errorMsg,
    });
  }

  // Dead invoke (Vercel kill / dropped after) — fail, do not resume.
  if (
    (job.status === "running" || job.status === "pending") &&
    Date.now() - job.updated_at > STALE_RUNNING_MS
  ) {
    const lease = await loadDeliveryContinueLease(job.job_id);
    if (lease) {
      return NextResponse.json({
        ok: true,
        job_id: job.job_id,
        status: "running",
        current_stage: current_stage ?? lease.stage,
        progress_label: STAGE_PROGRESS_ZH[lease.stage] ?? lease.stage,
        accumulated_content: job.accumulated_content,
        lease_held: true,
      });
    }

    const errorMsg = `STOP at ${current_stage ?? "unknown"}: stale_running (no heartbeat >${STALE_RUNNING_MS}ms; no auto-resume)`;
    await stopDeadJob(job.job_id, session_id, current_stage, "stale_running", errorMsg, {
      stage: current_stage,
      updated_at: job.updated_at,
      stale_ms: Date.now() - job.updated_at,
      was_status: job.status,
    });
    return NextResponse.json({
      ok: false,
      job_id: job.job_id,
      status: "failed",
      current_stage,
      retryable: false,
      reason: "stale_running",
      error: errorMsg,
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
    return NextResponse.json({
      ok: false,
      job_id: job.job_id,
      status: "failed",
      current_stage,
      retryable: false,
      reason: "completed_without_result",
      error: "job completed but delivery result missing",
    });
  }

  if (job.status === "failed") {
    return NextResponse.json({
      ok: false,
      job_id: job.job_id,
      status: "failed",
      current_stage,
      retryable: false,
      reason: job.failure_reason ?? "transport_error",
      error: job.error ?? "final delivery failed",
      error_detail: job.error_detail ?? null,
      accumulated_content: job.accumulated_content ?? null,
    });
  }

  const stageKey = current_stage ?? "finalize";
  // Stream only from segment:ready (not stage-local task checkpoints).
  const ready = await loadAllDeliverySegmentReady(job.job_id);
  const streamed_segments = ready.map((s) => ({
    key: s.key,
    heading: s.heading,
    body: s.body_markdown,
    evidence: s.evidence_markdown,
    interleaved: s.interleaved_markdown ?? "",
    evidence_ready: s.evidence_ready,
  }));

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
