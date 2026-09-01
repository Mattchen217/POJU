import { after, NextResponse } from "next/server";

import {
  forceReleaseDeliveryContinueLease,
  tryAcquireDeliveryContinueLease,
  writeDeliveryContinueAck,
} from "@/lib/llm/pro/delivery/delivery-stage-store";
import {
  currentDeliveryDeployGeneration,
  isDeliveryJobFromCurrentDeploy,
} from "@/lib/poju/delivery-deploy-generation";
import {
  runFinalDeliveryStage,
  verifyDeliveryContinueSecret,
  type DeliveryPipelineStage,
  DELIVERY_PIPELINE_STAGES,
} from "@/lib/poju/final-delivery-stage-runner";
import { failXhighJob, getXhighJob, releaseXhighSessionLock } from "@/lib/poju/xhigh-job-store";
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
 * Lease NX + ACK before 202 so handoff can confirm accept despite fetch blips.
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

    // Redeploy kill-switch: refuse LLM for jobs stamped on a prior deployment.
    if (!isDeliveryJobFromCurrentDeploy(job)) {
      console.warn("[final-delivery/continue] skip — superseded by redeploy", {
        job_id,
        stage,
        stamped: job.deploy_generation ?? null,
        current: currentDeliveryDeployGeneration(),
      });
      await failXhighJob(job_id, "STOP: superseded by redeploy", {
        retryable: false,
        failure_reason: "superseded_by_deploy",
        current_stage: typeof stage === "string" ? stage : job.current_stage,
        accumulated_content: "failed:superseded_by_deploy",
      }).catch(() => undefined);
      await forceReleaseDeliveryContinueLease(job_id).catch(() => undefined);
      if (isFinalDeliveryJobInput(job.input)) {
        await releaseXhighSessionLock("final_delivery", job.input.session_id).catch(
          () => undefined,
        );
      }
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "superseded_by_deploy",
        job_id,
      });
    }

    const acquired = await tryAcquireDeliveryContinueLease(job_id, stage);
    if (!acquired.ok) {
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

    // Prove accept before 202 — scheduler treats ACK as success if fetch resets.
    await writeDeliveryContinueAck(job_id, stage, lease_token);

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
