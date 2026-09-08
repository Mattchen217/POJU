import { NextResponse } from "next/server";

import { forceReleaseDeliveryContinueLease } from "@/lib/llm/pro/delivery/delivery-stage-store";
import { logDeliveryStep } from "@/lib/llm/pro/delivery/delivery-step-log";
import {
  failXhighJob,
  getXhighJob,
  releaseXhighSessionLock,
} from "@/lib/poju/xhigh-job-store";
import { isFinalDeliveryJobInput } from "@/lib/poju/xhigh-job-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * User Stop — mark job failed so in-flight invoke aborts on next heartbeat
 * and /continue will not re-arm LLM work.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      job_id?: unknown;
      session_id?: unknown;
    };
    const job_id = typeof body.job_id === "string" ? body.job_id.trim() : "";
    const session_id =
      typeof body.session_id === "string" ? body.session_id.trim() : "";
    if (!job_id) {
      return NextResponse.json({ ok: false, error: "missing_job_id" }, { status: 400 });
    }

    const job = await getXhighJob(job_id);
    if (!job || job.phase !== "final_delivery") {
      return NextResponse.json({ ok: false, error: "job_not_found" }, { status: 404 });
    }

    const jobSession = isFinalDeliveryJobInput(job.input)
      ? job.input.session_id
      : job.session_id;
    if (session_id && jobSession && session_id !== jobSession) {
      return NextResponse.json({ ok: false, error: "session_mismatch" }, { status: 403 });
    }

    if (job.status === "completed") {
      return NextResponse.json({
        ok: true,
        job_id,
        status: "completed",
        stopped: false,
        already_complete: true,
      });
    }

    if (job.status === "failed" && job.failure_reason === "user_cancelled") {
      return NextResponse.json({
        ok: true,
        job_id,
        status: "failed",
        stopped: true,
        already_stopped: true,
      });
    }

    await failXhighJob(job_id, "STOP: user cancelled delivery", {
      retryable: false,
      failure_reason: "user_cancelled",
      current_stage: job.current_stage,
      accumulated_content: "failed:user_cancelled",
    });
    await forceReleaseDeliveryContinueLease(job_id).catch(() => undefined);
    if (jobSession) {
      await releaseXhighSessionLock("final_delivery", jobSession).catch(() => undefined);
    }

    logDeliveryStep({
      job_id,
      level: "stop",
      step: "user Stop",
      detail: "cancelled",
    });

    return NextResponse.json({
      ok: true,
      job_id,
      status: "failed",
      stopped: true,
    });
  } catch (e) {
    console.error("[final-delivery/cancel]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "cancel failed" },
      { status: 500 },
    );
  }
}
