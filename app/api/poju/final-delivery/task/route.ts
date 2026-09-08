import { after, NextResponse } from "next/server";

import {
  assembleIsOk,
  dagHasFailed,
  executeDeliveryDispatchTask,
  loadDeliveryDispatchDag,
  releaseDispatchTaskLease,
  tryAcquireDispatchTaskLease,
} from "@/lib/llm/pro/delivery/dispatch";
import { runDeliveryDispatchSchedulerTick } from "@/lib/llm/pro/delivery/dispatch/scheduler";
import { logDeliveryStep } from "@/lib/llm/pro/delivery/delivery-step-log";
import {
  currentDeliveryDeployGeneration,
  isDeliveryJobFromCurrentDeploy,
} from "@/lib/poju/delivery-deploy-generation";
import {
  dispatchDeliveryContinue,
  publishDeliveryTask,
} from "@/lib/poju/delivery-continue-dispatch";
import { verifyDeliveryContinueSecret } from "@/lib/poju/final-delivery-stage-runner";
import {
  failXhighJob,
  getXhighJob,
  releaseXhighSessionLock,
  setXhighJobContent,
  updateXhighJobStatus,
} from "@/lib/poju/xhigh-job-store";
import { isFinalDeliveryJobInput } from "@/lib/poju/xhigh-job-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function continueSecret(job_id: string): string {
  const seed =
    process.env.POJU_INTERNAL_STAGE_SECRET?.trim() ||
    process.env.OPS_SESSION_SECRET?.trim() ||
    process.env.OPENROUTER_API_KEY?.trim() ||
    "poju-delivery-stage";
  return `fdstage:${job_id}:${seed.slice(0, 24)}`;
}

async function interruptDispatchJob(
  job_id: string,
  session_id: string,
  task_id: string,
  reason: string,
): Promise<void> {
  const where = `segments/${task_id}`;
  logDeliveryStep({
    job_id,
    level: "warn",
    step: "paused — tap Continue",
    detail: `${where}: ${reason}`.slice(0, 200),
  });
  await failXhighJob(job_id, `INTERRUPTED at ${where}: ${reason}`, {
    retryable: true,
    failure_reason: "interrupted",
    current_stage: "segments",
    error_detail: JSON.stringify({
      stage: "segments",
      task: task_id,
      where,
      reason,
      resumable: true,
    }),
    accumulated_content: `interrupted:${where}:${reason}`.slice(0, 500),
  });
  await releaseXhighSessionLock("final_delivery", session_id);
}

/**
 * Atomic delivery worker — one DAG task per invoke (~300s).
 * Auth: x-poju-delivery-continue (same as /continue).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      job_id?: unknown;
      task_id?: unknown;
    };
    const job_id = typeof body.job_id === "string" ? body.job_id.trim() : "";
    const task_id = typeof body.task_id === "string" ? body.task_id.trim() : "";
    if (!job_id || !task_id) {
      return NextResponse.json({ ok: false, error: "invalid_job_or_task" }, { status: 400 });
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
    if (!isFinalDeliveryJobInput(job.input)) {
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
    }
    const jobInput = job.input;
    if (!isDeliveryJobFromCurrentDeploy(job)) {
      console.warn("[final-delivery/task] skip — superseded by redeploy", {
        job_id,
        task_id,
        stamped: job.deploy_generation ?? null,
        current: currentDeliveryDeployGeneration(),
      });
      return NextResponse.json({ ok: true, skipped: true, reason: "redeploy" });
    }

    const leased = await tryAcquireDispatchTaskLease(job_id, task_id);
    if (!leased) {
      console.info("[final-delivery/task] lease busy — skip", { job_id, task_id });
      return NextResponse.json({ ok: true, skipped: true, reason: "lease_busy" });
    }

    after(async () => {
      const heartbeat = setInterval(() => {
        void setXhighJobContent(
          job_id,
          `dispatch_task:${task_id}:${Date.now()}`,
        ).catch(() => undefined);
      }, 12_000);
      // Immediate touch so status never sees a 45s gap after park.
      await setXhighJobContent(job_id, `dispatch_task:${task_id}:start`).catch(() => undefined);

      try {
        const result = await executeDeliveryDispatchTask({
          job_id,
          task_id,
          job_input: jobInput,
        });
        void result;

        const dag = await loadDeliveryDispatchDag(job_id);
        if (dag && dagHasFailed(dag)) {
          const failed = Object.values(dag.tasks).find((t) => t.status === "failed");
          await interruptDispatchJob(
            job_id,
            jobInput.session_id,
            failed?.id ?? task_id,
            failed?.error ?? `task_failed:${task_id}`,
          );
          return;
        }

        if (dag && assembleIsOk(dag)) {
          // Book merge stage — one counted continue hop is OK.
          await dispatchDeliveryContinue(job_id, "assemble", continueSecret(job_id));
          return;
        }

        // Kick next ready tasks only — do NOT /continue segments (burns hop fuse).
        await runDeliveryDispatchSchedulerTick({
          job_id,
          publishTask: (tid) => publishDeliveryTask(job_id, tid, continueSecret(job_id)),
        });
        await setXhighJobContent(job_id, `dispatch_scheduled:${Date.now()}`).catch(() => undefined);
      } catch (e) {
        console.error("[final-delivery/task] worker error", { job_id, task_id, e });
      } finally {
        clearInterval(heartbeat);
        await releaseDispatchTaskLease(job_id, task_id).catch(() => undefined);
      }
    });

    return NextResponse.json({ ok: true, accepted: true, job_id, task_id }, { status: 202 });
  } catch (e) {
    console.error("[final-delivery/task] POST error", e);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}
