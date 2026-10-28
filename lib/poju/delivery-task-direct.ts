/**
 * One delivery task in the current isolate.
 * Used when Inngest/QStash publish does not attach a worker — same body as
 * /api/poju/final-delivery/task, hosted by the status poll's after() so the
 * step gets a fresh 300s budget instead of sitting on await_task_attach.
 */

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
import { isDeliveryJobFromCurrentDeploy } from "@/lib/poju/delivery-deploy-generation";
import {
  dispatchDeliveryContinue,
  publishDeliveryTask,
} from "@/lib/poju/delivery-continue-dispatch";
import {
  isProductionV3Task,
  runProductionV3Task,
  settleProductionV3Task,
} from "@/lib/llm/pro/delivery/pipeline-v3/production-run";
import {
  failXhighJob,
  getXhighJob,
  releaseXhighSessionLock,
  setXhighJobContent,
} from "@/lib/poju/xhigh-job-store";
import { isFinalDeliveryJobInput } from "@/lib/poju/xhigh-job-types";

function continueSecret(job_id: string): string {
  const seed =
    process.env.POJU_INTERNAL_STAGE_SECRET?.trim() ||
    process.env.OPS_SESSION_SECRET?.trim() ||
    process.env.OPENROUTER_API_KEY?.trim() ||
    "poju-delivery-stage";
  return `fdstage:${job_id}:${seed.slice(0, 24)}`;
}

export async function runDeliveryTaskDirect(job_id: string, task_id: string): Promise<void> {
  const job = await getXhighJob(job_id);
  if (!job || job.phase !== "final_delivery") return;
  if (job.status === "completed" || job.status === "failed") return;
  if (!isFinalDeliveryJobInput(job.input)) return;
  if (!isDeliveryJobFromCurrentDeploy(job)) return;
  const jobInput = job.input;

  const leased = await tryAcquireDispatchTaskLease(job_id, task_id);
  if (!leased) {
    console.info("[final-delivery] direct task lease busy — skip", { job_id, task_id });
    return;
  }

  let heartbeats = true;
  const heartbeat = setInterval(() => {
    if (!heartbeats) return;
    void setXhighJobContent(job_id, `dispatch_task:${task_id}:${Date.now()}`).catch(
      () => undefined,
    );
  }, 12_000);
  await setXhighJobContent(job_id, `dispatch_task:${task_id}:start`).catch(() => undefined);

  let leaseReleased = false;
  const releaseLease = async () => {
    if (leaseReleased) return;
    leaseReleased = true;
    await releaseDispatchTaskLease(job_id, task_id).catch(() => undefined);
  };

  try {
    if (isProductionV3Task(task_id)) {
      const outcome = await runProductionV3Task({ job_id, jobInput });
      heartbeats = false;
      clearInterval(heartbeat);
      await releaseLease();
      await settleProductionV3Task({
        job_id,
        session_id: jobInput.session_id,
        outcome,
        republish: () => publishDeliveryTask(job_id, task_id, continueSecret(job_id)),
        wakeSegments: () =>
          dispatchDeliveryContinue(job_id, "segments", continueSecret(job_id)),
      });
      return;
    }

    await executeDeliveryDispatchTask({
      job_id,
      task_id,
      job_input: jobInput,
    });
    heartbeats = false;
    clearInterval(heartbeat);

    const dag = await loadDeliveryDispatchDag(job_id);
    if (dag && dagHasFailed(dag)) {
      const failed = Object.values(dag.tasks).find((t) => t.status === "failed");
      const where = `segments/${failed?.id ?? task_id}`;
      const reason = failed?.error ?? `task_failed:${task_id}`;
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
          task: failed?.id ?? task_id,
          where,
          reason,
          resumable: true,
        }),
        accumulated_content: `interrupted:${where}:${reason}`.slice(0, 500),
      });
      await releaseXhighSessionLock("final_delivery", jobInput.session_id);
      return;
    }

    if (dag && assembleIsOk(dag)) {
      await dispatchDeliveryContinue(job_id, "assemble", continueSecret(job_id));
      return;
    }

    await runDeliveryDispatchSchedulerTick({
      job_id,
      publishTask: (tid) => publishDeliveryTask(job_id, tid, continueSecret(job_id)),
    });
    await setXhighJobContent(job_id, `dispatch_scheduled:${Date.now()}`).catch(() => undefined);
  } catch (e) {
    console.error("[final-delivery] direct task failed", { job_id, task_id, e });
  } finally {
    heartbeats = false;
    clearInterval(heartbeat);
    await releaseLease();
  }
}
