/**
 * Phase-4 atomic DAG task via Inngest (one OpenRouter call per invoke).
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
import { DELIVERY_SINGLE_CALL_TIMEOUT_MS } from "@/lib/llm/pro/delivery/delivery-tasks";
import { logDeliveryStep } from "@/lib/llm/pro/delivery/delivery-step-log";
import {
  currentDeliveryDeployGeneration,
  isDeliveryJobFromCurrentDeploy,
} from "@/lib/poju/delivery-deploy-generation";
import {
  dispatchDeliveryContinue,
  publishDeliveryTask,
} from "@/lib/poju/delivery-continue-dispatch";
import { inngest } from "@/lib/inngest/client";
import {
  failXhighJob,
  getXhighJob,
  releaseXhighSessionLock,
  setXhighJobContent,
} from "@/lib/poju/xhigh-job-store";
import { isFinalDeliveryJobInput } from "@/lib/poju/xhigh-job-types";
import {
  isProductionV3Task,
  runProductionV3Task,
  settleProductionV3Task,
} from "@/lib/llm/pro/delivery/pipeline-v3/production-run";

function continueSecret(job_id: string): string {
  const seed =
    process.env.POJU_INTERNAL_STAGE_SECRET?.trim() ||
    process.env.OPS_SESSION_SECRET?.trim() ||
    process.env.OPENROUTER_API_KEY?.trim() ||
    "poju-delivery-stage";
  return `fdstage:${job_id}:${seed.slice(0, 24)}`;
}

export type PojuFinalDeliveryTaskEvent = {
  name: "poju/final-delivery.task";
  data: {
    job_id: string;
    task_id: string;
  };
};

export const pojuFinalDeliveryTask = inngest.createFunction(
  {
    id: "poju-final-delivery-task",
    retries: 2,
    concurrency: [
      { limit: 4, key: "event.data.job_id" },
      { limit: 16 },
    ],
    triggers: [{ event: "poju/final-delivery.task" }],
  },
  async ({ event, step }) => {
    const job_id = String(event.data.job_id ?? "").trim();
    const task_id = String(event.data.task_id ?? "").trim();
    if (!job_id || !task_id) {
      return { skipped: true, reason: "invalid_job_or_task" };
    }

    return await step.run(`task-${task_id}`, async () => {
      const job = await getXhighJob(job_id);
      if (!job || job.phase !== "final_delivery") {
        return { skipped: true, reason: "job_not_found" };
      }
      if (job.status === "completed" || job.status === "failed") {
        return { skipped: true, status: job.status };
      }
      if (!isFinalDeliveryJobInput(job.input)) {
        return { skipped: true, reason: "invalid_input" };
      }
      const jobInput = job.input;
      if (!isDeliveryJobFromCurrentDeploy(job)) {
        return {
          skipped: true,
          reason: "redeploy",
          stamped: job.deploy_generation ?? null,
          current: currentDeliveryDeployGeneration(),
        };
      }

      const leased = await tryAcquireDispatchTaskLease(job_id, task_id);
      if (!leased) {
        return { skipped: true, reason: "lease_busy" };
      }

      let heartbeats = true;
      const heartbeat = setInterval(() => {
        if (!heartbeats) return;
        void setXhighJobContent(job_id, `dispatch_task:${task_id}:${Date.now()}`).catch(
          () => undefined,
        );
      }, 12_000);
      await setXhighJobContent(job_id, `dispatch_task:${task_id}:start`).catch(() => undefined);

      const taskAbort = new AbortController();
      let leaseReleased = false;
      const prekillMs = DELIVERY_SINGLE_CALL_TIMEOUT_MS + 5_000;
      const prekillTimer = setTimeout(() => {
        console.warn("[inngest/poju-final-delivery-task] pre-kill abort", {
          job_id,
          task_id,
          prekill_ms: prekillMs,
        });
        taskAbort.abort();
      }, prekillMs);

      try {
        if (isProductionV3Task(task_id)) {
          const outcome = await runProductionV3Task({ job_id, jobInput });
          heartbeats = false;
          clearTimeout(prekillTimer);
          clearInterval(heartbeat);
          await releaseDispatchTaskLease(job_id, task_id).catch(() => undefined);
          leaseReleased = true;
          await settleProductionV3Task({
            job_id,
            session_id: jobInput.session_id,
            outcome,
            republish: () => publishDeliveryTask(job_id, task_id, continueSecret(job_id)),
            wakeSegments: () =>
              dispatchDeliveryContinue(job_id, "segments", continueSecret(job_id)),
          });
          return { ok: outcome.ok, next: outcome.ok ? outcome.next : outcome.reason };
        }

        await executeDeliveryDispatchTask({
          job_id,
          task_id,
          job_input: jobInput,
          signal: taskAbort.signal,
        });

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
          return { interrupted: true, reason };
        }

        if (dag && assembleIsOk(dag)) {
          await dispatchDeliveryContinue(job_id, "assemble", continueSecret(job_id));
          return { ok: true, next: "assemble" };
        }

        await runDeliveryDispatchSchedulerTick({
          job_id,
          publishTask: (tid) => publishDeliveryTask(job_id, tid, continueSecret(job_id)),
        });
        await setXhighJobContent(job_id, `dispatch_scheduled:${Date.now()}`).catch(
          () => undefined,
        );
        return { ok: true, job_id, task_id };
      } finally {
        heartbeats = false;
        clearTimeout(prekillTimer);
        clearInterval(heartbeat);
        if (!leaseReleased) {
          await releaseDispatchTaskLease(job_id, task_id).catch(() => undefined);
        }
      }
    });
  },
);
