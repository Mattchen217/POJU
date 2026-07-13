import { NextRequest, NextResponse } from "next/server";

import { getXhighJob } from "@/lib/poju/xhigh-job-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const job_id = req.nextUrl.searchParams.get("job_id")?.trim();
  if (!job_id) {
    return NextResponse.json({ error: "missing job_id" }, { status: 400 });
  }

  const job = await getXhighJob(job_id);
  if (!job) {
    return NextResponse.json({ error: "job_not_found" }, { status: 404 });
  }

  if (job.status === "completed" && job.result) {
    return NextResponse.json({
      ok: true,
      job_id: job.job_id,
      status: job.status,
      accumulated_content: job.accumulated_content,
      breakthrough_core: job.result.breakthrough_core,
      investigation_agenda: job.result.investigation_agenda,
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
