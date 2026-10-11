/**
 * Background fill: 1 invoke = 1–2 days per job per tick, then whole-window gate.
 * Drip is a separate cron (companion-drip-tick) and only runs after batch_status=ready.
 */

import {
  fillCompanionJobPair,
  runCompanionBatchGateOnJob,
} from "@/lib/companion/drip-advance";
import { listActiveCompanionJobs } from "@/lib/companion/job-store";
import type { CompanionJob } from "@/lib/companion/types";
import { inngest } from "@/lib/inngest/client";

export const companionBatchFill = inngest.createFunction(
  {
    id: "companion-batch-fill",
    retries: 1,
    triggers: [{ cron: "*/20 * * * *" }],
  },
  async ({ step }) => {
    const jobs = await step.run("list-jobs", async (): Promise<CompanionJob[]> =>
      listActiveCompanionJobs(30),
    );

    let filled = 0;
    let gated = 0;
    for (const job of jobs) {
      if (job.purged_at) continue;
      if (job.batch_status === "ready" || job.batch_status === "failed") continue;

      const updated = await step.run(`fill-${job.id}`, async () =>
        fillCompanionJobPair(job, { pair_size: 2 }),
      );
      filled += 1;
      if (updated.batch_status === "ready") {
        gated += 1;
      } else if (
        updated.batch_status === "filling" &&
        updated.days.every((d) => d.cards != null || d.status === "failed")
      ) {
        const gatedJob = await step.run(`gate-${job.id}`, async () =>
          runCompanionBatchGateOnJob(updated),
        );
        if (gatedJob.batch_status === "ready" || gatedJob.batch_status === "failed") {
          gated += 1;
        }
      }
    }

    return { jobs: jobs.length, filled, gated };
  },
);
