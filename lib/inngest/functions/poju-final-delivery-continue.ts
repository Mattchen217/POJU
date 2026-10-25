/**
 * Phase-4 stage hop via Inngest (replaces QStash → /continue on Vercel).
 * One invoke = one stage budget (≤ Vercel 300s).
 */

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
  DELIVERY_PIPELINE_STAGES,
  runFinalDeliveryStage,
  type DeliveryPipelineStage,
} from "@/lib/poju/final-delivery-stage-runner";
import { inngest } from "@/lib/inngest/client";
import { failXhighJob, getXhighJob, releaseXhighSessionLock } from "@/lib/poju/xhigh-job-store";
import { isFinalDeliveryJobInput } from "@/lib/poju/xhigh-job-types";

function isStage(x: unknown): x is DeliveryPipelineStage {
  return typeof x === "string" && (DELIVERY_PIPELINE_STAGES as readonly string[]).includes(x);
}

export type PojuFinalDeliveryContinueEvent = {
  name: "poju/final-delivery.continue";
  data: {
    job_id: string;
    stage: DeliveryPipelineStage;
  };
};

export const pojuFinalDeliveryContinue = inngest.createFunction(
  {
    id: "poju-final-delivery-continue",
    retries: 2,
    concurrency: [
      { limit: 1, key: "event.data.job_id" },
      { limit: 8 },
    ],
    triggers: [{ event: "poju/final-delivery.continue" }],
  },
  async ({ event, step }) => {
    const job_id = String(event.data.job_id ?? "").trim();
    const stage = event.data.stage;
    if (!job_id || !isStage(stage)) {
      return { skipped: true, reason: "invalid_job_or_stage" };
    }

    return await step.run(`continue-${stage}`, async () => {
      const job = await getXhighJob(job_id);
      if (!job || job.phase !== "final_delivery") {
        return { skipped: true, reason: "job_not_found" };
      }
      if (job.status === "completed" || job.status === "failed") {
        return { skipped: true, status: job.status };
      }

      {
        const {
          DELIVERY_JOB_MAX_CONTINUE_HOPS,
          DELIVERY_JOB_MAX_WALL_MS,
          isDeliveryJobContinueHopExceeded,
          isDeliveryJobWallExceeded,
        } = await import("@/lib/llm/pro/delivery/delivery-retry-policy");
        const { loadDeliveryJobContinueHops } = await import(
          "@/lib/llm/pro/delivery/delivery-stage-store"
        );
        const hops = await loadDeliveryJobContinueHops(job_id).catch(() => 0);
        const wall = isDeliveryJobWallExceeded(job.created_at);
        const hopCap = isDeliveryJobContinueHopExceeded(hops);
        if (wall || hopCap) {
          const reason = hopCap
            ? `job_continue_budget_exhausted:hops=${hops}:max=${DELIVERY_JOB_MAX_CONTINUE_HOPS}`
            : `job_time_budget_exhausted:age_ms=${Date.now() - job.created_at}:max_ms=${DELIVERY_JOB_MAX_WALL_MS}`;
          await failXhighJob(job_id, `STOP: ${reason}`, {
            retryable: true,
            failure_reason: "interrupted",
            current_stage: stage,
            error_detail: JSON.stringify({ stop_reason: reason, continue_hops: hops }),
            accumulated_content: `failed:${reason}`.slice(0, 500),
          }).catch(() => undefined);
          await forceReleaseDeliveryContinueLease(job_id).catch(() => undefined);
          if (isFinalDeliveryJobInput(job.input)) {
            await releaseXhighSessionLock("final_delivery", job.input.session_id).catch(
              () => undefined,
            );
          }
          return { skipped: true, reason };
        }
      }

      if (!isDeliveryJobFromCurrentDeploy(job)) {
        await failXhighJob(job_id, "STOP: superseded by redeploy", {
          retryable: false,
          failure_reason: "superseded_by_deploy",
          current_stage: stage,
          accumulated_content: "failed:superseded_by_deploy",
        }).catch(() => undefined);
        await forceReleaseDeliveryContinueLease(job_id).catch(() => undefined);
        if (isFinalDeliveryJobInput(job.input)) {
          await releaseXhighSessionLock("final_delivery", job.input.session_id).catch(
            () => undefined,
          );
        }
        return {
          skipped: true,
          reason: "superseded_by_deploy",
          stamped: job.deploy_generation ?? null,
          current: currentDeliveryDeployGeneration(),
        };
      }

      const acquired = await tryAcquireDeliveryContinueLease(job_id, stage);
      if (!acquired.ok) {
        return {
          skipped: true,
          reason: "continue_lease_busy",
          holder_stage: acquired.lease.stage,
        };
      }

      await writeDeliveryContinueAck(job_id, stage, acquired.token);

      try {
        await runFinalDeliveryStage(job_id, stage, { lease_token: acquired.token });
        return { ok: true, job_id, stage };
      } catch (e) {
        console.error("[inngest/poju-final-delivery-continue] stage failed", e);
        if (isFinalDeliveryJobInput(job.input)) {
          await releaseXhighSessionLock("final_delivery", job.input.session_id).catch(
            () => undefined,
          );
        }
        throw e;
      }
    });
  },
);
