import { NextRequest, NextResponse } from "next/server";

import { loadDeliveryContinueLease } from "@/lib/llm/pro/delivery/delivery-stage-store";
import { failXhighJob, getXhighJob } from "@/lib/poju/xhigh-job-store";
import { isFinalDeliveryJobResult } from "@/lib/poju/xhigh-job-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Heartbeat ~12s while a task runs.
 * If `running` with no heartbeat and no continue lease → FAIL and stop.
 * No stale-resume / auto-retry — one chain, one chance (fix then regenerate).
 */
const STALE_RUNNING_MS = 45_000;
/** Hard wall — abandoned jobs must not burn forever. */
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
    error: job.status === "failed" ? (job.error ?? null) : null,
    error_detail: job.status === "failed" ? (job.error_detail ?? null) : null,
    accumulated_content:
      job.status === "failed" || job.status === "running"
        ? (job.accumulated_content ?? null)
        : null,
  });

  if (job.status === "running" && age_ms > MAX_JOB_AGE_MS) {
    await failXhighJob(job.job_id, "STOP: background job exceeded max wall duration", {
      retryable: false,
      failure_reason: "job_abandoned",
      current_stage: current_stage ?? undefined,
    }).catch(() => undefined);
    return NextResponse.json({
      ok: false,
      job_id: job.job_id,
      status: "failed",
      current_stage,
      retryable: false,
      reason: "job_abandoned",
      error: "STOP: background job exceeded max wall duration",
    });
  }

  // Stale = dead invoke (e.g. Vercel 300s kill). Do NOT resume — fail so the STOP is visible.
  if (job.status === "running" && Date.now() - job.updated_at > STALE_RUNNING_MS) {
    const lease = await loadDeliveryContinueLease(job.job_id);
    if (lease) {
      // Another continue hop still holds the lease — wait, do not fail yet.
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
    console.error("[final-delivery-STOP]", {
      job_id: job.job_id,
      stage: current_stage,
      reason: "stale_running",
      message: errorMsg,
    });
    await failXhighJob(job.job_id, errorMsg, {
      retryable: false,
      failure_reason: "stale_running",
      current_stage: current_stage ?? undefined,
      error_detail: JSON.stringify({
        stage: current_stage,
        updated_at: job.updated_at,
        stale_ms: Date.now() - job.updated_at,
      }),
      accumulated_content: `failed:stale_running:${current_stage ?? "?"}`.slice(0, 500),
    }).catch(() => undefined);
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
  return NextResponse.json({
    ok: true,
    job_id: job.job_id,
    status: job.status,
    current_stage: stageKey,
    progress_label: STAGE_PROGRESS_ZH[stageKey] ?? stageKey,
    accumulated_content: job.accumulated_content,
  });
}
