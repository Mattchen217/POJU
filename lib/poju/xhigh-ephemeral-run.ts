import {
  failXhighJob,
  getXhighJob,
  runWithEphemeralXhighKv,
} from "@/lib/poju/xhigh-job-store";
import type { PojuXhighJob } from "@/lib/poju/xhigh-job-types";

/**
 * Run one xhigh job against process-local memory instead of Upstash.
 * Used when the fixed plan is rejecting commands. The caller must return the
 * terminal job in the same HTTP response — a later isolate cannot see this store.
 */
export async function runEphemeralXhighJob(
  create: () => Promise<{ job_id: string }>,
  run: (job_id: string) => Promise<void>,
): Promise<PojuXhighJob | null> {
  return runWithEphemeralXhighKv(async () => {
    const created = await create();
    try {
      await run(created.job_id);
    } catch (e) {
      const current = await getXhighJob(created.job_id);
      if (current && (current.status === "pending" || current.status === "running")) {
        await failXhighJob(created.job_id, e instanceof Error ? e.message : String(e), {
          retryable: true,
          failure_reason: "parse_failed",
          accumulated_content: current.accumulated_content,
        }).catch(() => undefined);
      }
    }
    let done = await getXhighJob(created.job_id);
    if (done && done.status !== "completed" && done.status !== "failed") {
      await failXhighJob(done.job_id, "inline segment2 ended without a terminal status", {
        retryable: true,
        failure_reason: "parse_failed",
        accumulated_content: done.accumulated_content,
      }).catch(() => undefined);
      done = await getXhighJob(created.job_id);
    }
    return done;
  });
}
