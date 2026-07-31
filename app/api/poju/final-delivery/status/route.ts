import { NextRequest, NextResponse } from "next/server";

import { failXhighJob, getXhighJob } from "@/lib/poju/xhigh-job-store";
import { isFinalDeliveryJobResult } from "@/lib/poju/xhigh-job-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Heartbeat is 15s; allow a few missed ticks before declaring stall. */
const STALE_RUNNING_MS = 120_000;
/** Multi-task book (≈11 LLM calls) — align with route maxDuration buffer. */
const MAX_JOB_AGE_MS = 480_000;

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
  console.info("[final-delivery-status]", {
    job_id: job.job_id,
    status: job.status,
    has_result: Boolean(job.result),
    age_ms,
    updated_at: job.updated_at,
  });

  if (job.status === "running" && age_ms > MAX_JOB_AGE_MS) {
    await failXhighJob(job.job_id, "background job exceeded max duration and was terminated", {
      retryable: true,
      failure_reason: "job_abandoned",
    }).catch(() => undefined);
    return NextResponse.json({
      ok: false,
      job_id: job.job_id,
      status: "failed",
      retryable: true,
      reason: "job_abandoned",
      error: "background job exceeded max duration and was terminated",
    });
  }

  if (job.status === "running" && Date.now() - job.updated_at > STALE_RUNNING_MS) {
    await failXhighJob(job.job_id, "job stalled without updates", {
      retryable: true,
      failure_reason: "stale_running",
    }).catch(() => undefined);
    return NextResponse.json({
      ok: false,
      job_id: job.job_id,
      status: "failed",
      retryable: true,
      reason: "stale_running",
      error: "job stalled without updates",
    });
  }

  if (job.status === "completed" && isFinalDeliveryJobResult(job.result)) {
    return NextResponse.json({
      ok: true,
      job_id: job.job_id,
      status: job.status,
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
      retryable: job.retryable ?? true,
      reason: job.failure_reason ?? "transport_error",
      error: job.error ?? "final delivery failed",
    });
  }

  return NextResponse.json({
    ok: true,
    job_id: job.job_id,
    status: job.status,
    accumulated_content: job.accumulated_content,
  });
}
