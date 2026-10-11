/**
 * Hourly tick: deliver due days for batch-ready jobs, then wipe that day.
 * Does not generate — generation is companion-batch-fill.
 */

import { deliverDueCompanionDay } from "@/lib/companion/drip-advance";
import { listActiveCompanionJobs } from "@/lib/companion/job-store";
import type { CompanionJob } from "@/lib/companion/types";
import { inngest } from "@/lib/inngest/client";

export const companionDripTick = inngest.createFunction(
  {
    id: "companion-drip-tick",
    retries: 1,
    triggers: [{ cron: "0 * * * *" }],
  },
  async ({ step }) => {
    const jobs = await step.run("list-jobs", async (): Promise<CompanionJob[]> =>
      listActiveCompanionJobs(40),
    );
    let delivered = 0;
    for (const job of jobs) {
      if (job.purged_at) continue;
      if (job.batch_status !== "ready") continue;
      await step.run(`deliver-${job.id}`, async () => {
        await deliverDueCompanionDay(job);
      });
      delivered += 1;
    }
    return { jobs: jobs.length, delivered };
  },
);
