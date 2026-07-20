import { NextRequest, NextResponse } from "next/server";

import { getJob } from "@/lib/base-analysis/job-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const job_id = req.nextUrl.searchParams.get("job_id")?.trim();

  if (!job_id) {
    return NextResponse.json({ error: "missing job_id" }, { status: 400 });
  }

  const job = await getJob(job_id);
  if (!job) {
    return NextResponse.json({ error: "job_not_found" }, { status: 404 });
  }

  return NextResponse.json({
    job_id: job.job_id,
    profile_id: job.profile_id,
    status: job.status,
    accumulated_content: job.accumulated_content,
    progress_stage: job.progress_stage ?? null,
    progress_updated_at: job.progress_updated_at ?? null,
    meta: job.meta,
    error: job.error,
    error_detail: job.error_detail,
    updated_at: job.updated_at,
    completed_at: job.completed_at,
  });
}
