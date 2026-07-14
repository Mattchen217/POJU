import { NextRequest, NextResponse } from "next/server";

import { failXhighJob, getXhighJob } from "@/lib/poju/xhigh-job-store";

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

  const has_result = Boolean(job.result);
  const has_core = Boolean(job.result?.breakthrough_core);
  const has_agenda = Array.isArray(job.result?.investigation_agenda);
  const age_ms = Date.now() - job.created_at;
  console.info("[xhigh-status]", {
    job_id: job.job_id,
    status: job.status,
    has_result,
    has_core,
    has_agenda,
    agenda_len: has_agenda ? job.result!.investigation_agenda.length : 0,
    updated_at: job.updated_at,
    created_at: job.created_at,
    age_ms,
  });

  // Age guard — heartbeat cannot fool this.
  if (job.status === "running" && age_ms > MAX_JOB_AGE_MS) {
    console.warn("[xhigh-status] abandoned running job (age)", {
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

  // updated_at stopped (no heartbeat) → stale.
  if (job.status === "running" && Date.now() - job.updated_at > STALE_RUNNING_MS) {
    console.warn("[xhigh-status] stale running job", {
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

  if (job.status === "completed" && !job.result) {
    return NextResponse.json({
      ok: false,
      job_id: job.job_id,
      status: "failed",
      retryable: true,
      reason: "completed_without_result",
      error: "job completed but result missing",
      accumulated_content: job.accumulated_content,
      updated_at: job.updated_at,
      completed_at: job.completed_at,
    });
  }

  if (job.status === "completed" && job.result) {
    const agenda = Array.isArray(job.result.investigation_agenda)
      ? job.result.investigation_agenda
      : [];
    return NextResponse.json({
      ok: true,
      job_id: job.job_id,
      status: job.status,
      accumulated_content: job.accumulated_content,
      breakthrough_core: job.result.breakthrough_core,
      investigation_agenda: agenda,
      model: job.model,
      tokens_used: job.tokens_used,
      llm_debug: job.llm_debug,
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
      error: job.error ?? "segment2 job failed",
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
