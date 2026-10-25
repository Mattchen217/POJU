/**
 * Background fill: report-completed (or manual) event → up to 15 pair LLM calls.
 * Each step = 1–2 days. Drip remains companion-drip-tick (separate).
 */

import {
  fillCompanionJobPair,
  runCompanionBatchGateOnJob,
} from "@/lib/companion/drip-advance";
import { getCompanionJob, saveCompanionJob } from "@/lib/companion/job-store";
import type { CompanionJob } from "@/lib/companion/types";
import { inngest } from "@/lib/inngest/client";

/** 30 days / 2 per pair = 15 pair calls max. */
const MAX_PAIR_STEPS = 15;

export type CompanionFillEvent = {
  name: "poju/companion.fill";
  data: {
    job_id: string;
    session_id?: string;
  };
};

export const companionBatchFill = inngest.createFunction(
  {
    id: "companion-batch-fill",
    retries: 2,
    concurrency: { limit: 1, key: "event.data.job_id" },
    triggers: [{ event: "poju/companion.fill" }],
  },
  async ({ event, step }) => {
    const job_id = String(event.data.job_id ?? "").trim();
    if (!job_id) return { skipped: true, reason: "missing_job_id" };

    let filled = 0;
    for (let i = 0; i < MAX_PAIR_STEPS; i++) {
      const outcome = await step.run(`pair-${i}`, async () => {
        const job = await getCompanionJob(job_id);
        if (!job || job.purged_at) {
          return { done: true as const, reason: "missing" };
        }
        if (job.batch_status === "ready" || job.batch_status === "failed") {
          return { done: true as const, reason: job.batch_status };
        }

        const updated: CompanionJob = await fillCompanionJobPair(job, {
          pair_size: 2,
        });

        if (updated.batch_status === "ready" || updated.batch_status === "failed") {
          return { done: true as const, reason: updated.batch_status, filled: 1 };
        }

        if (
          updated.batch_status === "filling" &&
          updated.days.every((d) => d.cards != null || d.status === "failed")
        ) {
          const gated = await runCompanionBatchGateOnJob(updated);
          await saveCompanionJob(gated);
          return {
            done: true as const,
            reason: gated.batch_status,
            filled: 1,
          };
        }

        return { done: false as const, filled: 1 };
      });

      if ("filled" in outcome && outcome.filled) filled += outcome.filled;
      if (outcome.done) {
        return { job_id, filled, status: outcome.reason ?? "done" };
      }
    }

    return { job_id, filled, status: "max_pairs" };
  },
);
