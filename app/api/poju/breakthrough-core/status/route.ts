import { NextRequest, NextResponse } from "next/server";

import { failXhighJob, getXhighJob } from "@/lib/poju/xhigh-job-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** No updated_at refresh for this long while status=running → treat as zombie. */
export const STALE_RUNNING_MS = 90_000;

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
  console.info("[xhigh-status]", {
    job_id: job.job_id,
    status: job.status,
    has_result,
    has_core,
    has_agenda,
    agenda_len: has_agenda ? job.result!.investigation_agenda.length : 0,
    updated_at: job.updated_at,
  });

  // Fix B — running too long without updates = zombie → terminal fail (don't spin poll).
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

  // completed but no result must fail visibly (never look like pending).
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
