import { NextRequest, NextResponse } from "next/server";

import {
  findLatestCompletedDeliveryStage,
  nextDeliveryStage,
} from "@/lib/llm/pro/delivery/delivery-stage-store";
import {
  scheduleDeliveryStageContinue,
  type DeliveryPipelineStage,
} from "@/lib/poju/final-delivery-stage-runner";
import { failXhighJob, getXhighJob, updateXhighJobStatus } from "@/lib/poju/xhigh-job-store";
import { isFinalDeliveryJobResult } from "@/lib/poju/xhigh-job-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Heartbeat ~12s while a task runs. After task ends, continue self-fetch can fail
 * (ECONNRESET) — resume quickly so we don't idle ~90s between 2s model calls.
 */
const STALE_RUNNING_MS = 25_000;
/**
 * Wall clock across stage + per-task relays.
 * ~9 tasks × 4 fan-out stages × ~90s + assemble; leave headroom.
 */
const MAX_JOB_AGE_MS = 5_400_000;

const STAGE_PROGRESS_ZH: Record<string, string> = {
  finalize: "正在定稿结构…",
  narrative: "正在撰写正文…",
  evidence: "正在生成依据…",
  mark: "正在打标与润色…",
  assemble: "正在组装报告…",
  completed: "交付完成",
};

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
  console.info("[final-delivery-status]", {
    job_id: job.job_id,
    status: job.status,
    current_stage,
    has_result: Boolean(job.result),
    age_ms,
    updated_at: job.updated_at,
  });

  if (job.status === "running" && age_ms > MAX_JOB_AGE_MS) {
    await failXhighJob(job.job_id, "background job exceeded max wall duration", {
      retryable: true,
      failure_reason: "job_abandoned",
    }).catch(() => undefined);
    return NextResponse.json({
      ok: false,
      job_id: job.job_id,
      status: "failed",
      current_stage,
      retryable: true,
      reason: "job_abandoned",
      error: "background job exceeded max wall duration",
    });
  }

  // Stale mid-pipeline → resume from next incomplete stage (don't fail immediately).
  if (job.status === "running" && Date.now() - job.updated_at > STALE_RUNNING_MS) {
    const latest = await findLatestCompletedDeliveryStage(job.job_id);
    const resumeStage: DeliveryPipelineStage =
      nextDeliveryStage(latest) ?? (latest === "assemble" ? "assemble" : "finalize");
    await updateXhighJobStatus(job.job_id, "running", {
      current_stage: resumeStage,
      accumulated_content: `stage_resume:${resumeStage}:${Date.now()}`,
    }).catch(() => undefined);
    scheduleDeliveryStageContinue(job.job_id, resumeStage);
    return NextResponse.json({
      ok: true,
      job_id: job.job_id,
      status: "running",
      current_stage: resumeStage,
      resumed: true,
      progress_label: STAGE_PROGRESS_ZH[resumeStage] ?? resumeStage,
      accumulated_content: job.accumulated_content,
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
      retryable: true,
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
      retryable: job.retryable ?? true,
      reason: job.failure_reason ?? "transport_error",
      error: job.error ?? "final delivery failed",
    });
  }

  const stageKey = current_stage ?? "finalize";
  return NextResponse.json({
    ok: true,
    job_id: job.job_id,
    status: job.status,
    current_stage: stageKey,
    progress_label: STAGE_PROGRESS_ZH[stageKey] ?? stageKey,
    accumulated_content: job.accumulated_content,
  });
}
