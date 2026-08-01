import { after, NextResponse } from "next/server";

import {
  tryAcquireDeliveryContinueLease,
} from "@/lib/llm/pro/delivery/delivery-stage-store";
import {
  runFinalDeliveryStage,
  verifyDeliveryContinueSecret,
  type DeliveryPipelineStage,
  DELIVERY_PIPELINE_STAGES,
} from "@/lib/poju/final-delivery-stage-runner";
import { getXhighJob, releaseXhighSessionLock } from "@/lib/poju/xhigh-job-store";
import { isFinalDeliveryJobInput } from "@/lib/poju/xhigh-job-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isStage(x: unknown): x is DeliveryPipelineStage {
  return typeof x === "string" && (DELIVERY_PIPELINE_STAGES as readonly string[]).includes(x);
}

/**
 * Internal stage relay — each POST gets a fresh Vercel 300s budget.
 * Authenticated via x-poju-delivery-continue (not a public client API).
 * Single-flight: continue lease blocks overlapping resumes after a 300s kill.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      job_id?: unknown;
      stage?: unknown;
    };
    const job_id = typeof body.job_id === "string" ? body.job_id.trim() : "";
    const stage = body.stage;
    if (!job_id || !isStage(stage)) {
      return NextResponse.json({ ok: false, error: "invalid_job_or_stage" }, { status: 400 });
    }

    const secret = req.headers.get("x-poju-delivery-continue");
    if (!verifyDeliveryContinueSecret(job_id, secret)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const job = await getXhighJob(job_id);
    if (!job || job.phase !== "final_delivery") {
      return NextResponse.json({ ok: false, error: "job_not_found" }, { status: 404 });
    }
    if (job.status === "completed" || job.status === "failed") {
      return NextResponse.json({ ok: true, skipped: true, status: job.status });
    }

    const acquired = await tryAcquireDeliveryContinueLease(job_id, stage);
    if (!acquired.ok) {
      // Another hop still holds the lease — do not steal / retry. Caller sees STOP via stale fail.
      console.error("[final-delivery-STOP]", {
        job_id,
        stage,
        reason: "continue_lease_busy",
        holder_stage: acquired.lease.stage,
        expires_at: acquired.lease.expires_at,
      });
      return NextResponse.json(
        {
          ok: false,
          skipped: true,
          reason: "continue_lease_busy",
          job_id,
          stage,
        },
        { status: 409 },
      );
    }
    const lease_token = acquired.token;

    after(async () => {
      try {
        await runFinalDeliveryStage(job_id, stage, { lease_token });
      } catch (e) {
        console.error("[final-delivery/continue] stage failed", e);
        if (isFinalDeliveryJobInput(job.input)) {
          await releaseXhighSessionLock("final_delivery", job.input.session_id).catch(
            () => undefined,
          );
        }
      }
    });

    return NextResponse.json(
      { ok: true, accepted: true, job_id, stage },
      { status: 202 },
    );
  } catch (e) {
    console.error("[final-delivery/continue]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "continue failed" },
      { status: 500 },
    );
  }
}
