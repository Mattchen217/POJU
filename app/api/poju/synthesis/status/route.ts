import { NextRequest, NextResponse } from "next/server";

import { failXhighJob, getXhighJob } from "@/lib/poju/xhigh-job-store";
import { isSynthesisJobResult } from "@/lib/poju/xhigh-job-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** No updated_at refresh for this long while status=running → treat as zombie. */
const STALE_RUNNING_MS = 90_000;
/**
 * Age guard: heartbeat refreshes updated_at, but a killed invocation never writes failed.
 * Past Vercel maxDuration the job is abandoned — status side must declare terminal.
 */
const MAX_JOB_AGE_MS = 300_000;

export async function GET(req: NextRequest) {
  const job_id = req.nextUrl.searchParams.get("job_id")?.trim();
  if (!job_id) {
    return NextResponse.json({ error: "missing job_id" }, { status: 400 });
  }

  const job = await getXhighJob(job_id);
  if (!job) {
    return NextResponse.json({ error: "job_not_found" }, { status: 404 });
  }

  const synResult = isSynthesisJobResult(job.result) ? job.result : null;
  const has_result = Boolean(synResult);
  const age_ms = Date.now() - job.created_at;
  const content_len = job.accumulated_content?.length ?? 0;
  console.info("[synthesis-status]", {
    job_id: job.job_id,
    status: job.status,
    has_result,
    content_len,
    updated_at: job.updated_at,
    created_at: job.created_at,
    age_ms,
  });

  if (job.status === "running" && age_ms > MAX_JOB_AGE_MS) {
    console.warn("[synthesis-status] abandoned running job (age)", {
      job_id: job.job_id,
      age_ms,
    });
    await failXhighJob(job.job_id, "background job exceeded max duration and was terminated", {
      retryable: true,
      failure_reason: "job_abandoned",
      accumulated_content: job.accumulated_content,
    }).catch(() => undefined);
    return NextResponse.json({
      ok: false,
      job_id: job.job_id,
      status: "failed",
      retryable: true,
      reason: "job_abandoned",
      error: "background job exceeded max duration and was terminated",
      accumulated_content: job.accumulated_content,
      updated_at: job.updated_at,
    });
  }

  if (job.status === "running" && Date.now() - job.updated_at > STALE_RUNNING_MS) {
    console.warn("[synthesis-status] stale running job", {
      job_id: job.job_id,
      stale_ms: Date.now() - job.updated_at,
    });
    await failXhighJob(job.job_id, "job stalled without updates", {
      retryable: true,
      failure_reason: "stale_running",
      accumulated_content: job.accumulated_content,
    }).catch(() => undefined);
    return NextResponse.json({
      ok: false,
      job_id: job.job_id,
      status: "failed",
      retryable: true,
      reason: "stale_running",
      error: "job stalled without updates",
      accumulated_content: job.accumulated_content,
      updated_at: job.updated_at,
    });
  }

  if (job.status === "completed") {
    if (synResult) {
      return NextResponse.json({
        ok: true,
        job_id: job.job_id,
        status: job.status,
        phase: job.phase,
        accumulated_content: job.accumulated_content,
        primary_path: synResult.primary_path,
        backup_path: synResult.backup_path,
        action_plan: synResult.action_plan,
        model: job.model,
        tokens_used: job.tokens_used,
        llm_debug: job.llm_debug,
        updated_at: job.updated_at,
        completed_at: job.completed_at,
      });
    }
    console.warn("[synthesis-status] completed without recognizable synthesis result", {
      job_id: job.job_id,
      phase: job.phase,
      has_raw_result: Boolean(job.result),
      content_len,
    });
    return NextResponse.json({
      ok: false,
      job_id: job.job_id,
      status: "failed",
      phase: job.phase,
      retryable: true,
      reason: "completed_without_result",
      error: "job completed but result missing",
      accumulated_content: job.accumulated_content,
      updated_at: job.updated_at,
      completed_at: job.completed_at,
    });
  }

  if (job.status === "failed") {
    return NextResponse.json({
      ok: false,
      job_id: job.job_id,
      status: job.status,
      accumulated_content: job.accumulated_content,
      retryable: job.retryable ?? true,
      reason: job.failure_reason ?? "provider_busy",
      error: job.error ?? "synthesis job failed",
      error_detail: job.error_detail,
      updated_at: job.updated_at,
    });
  }

  return NextResponse.json({
    ok: true,
    job_id: job.job_id,
    status: job.status,
    accumulated_content: job.accumulated_content,
    updated_at: job.updated_at,
  });
}
