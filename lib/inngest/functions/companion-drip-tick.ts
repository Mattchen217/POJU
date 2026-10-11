/**
 * Hourly tick: advance active companion jobs (day-ahead generate + optional email).
 */

import { advanceCompanionJob } from "@/lib/companion/drip-advance";
import { listActiveCompanionJobs } from "@/lib/companion/job-store";
import type { CompanionDayRecord, CompanionJob } from "@/lib/companion/types";
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
    let advanced = 0;
    for (const job of jobs) {
      const pending = job.days.some(
        (d: CompanionDayRecord) => d.status === "pending" || d.status === "failed",
      );
      if (!pending) continue;
      await step.run(`advance-${job.id}`, async () => {
        await advanceCompanionJob(job);
      });
      advanced += 1;
    }
    return { jobs: jobs.length, advanced };
  },
);
