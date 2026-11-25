import { inngest } from "@/lib/inngest/client";
import { REPORT_BATCH2_EVENTS } from "@/lib/llm/pro/delivery/decision-report-v2/batch2/events";
import { runReportBatch3Recovery } from "@/lib/llm/pro/delivery/decision-report-v2/batch3/recovery";

/**
 * Shared Recovery step body (Unit D).
 * Failures throw Error so Inngest retries apply; never return {ok:false} as success.
 */
export async function runReportPageRecoveryInngestStep(input: {
  event: { data: Record<string, unknown> };
}): Promise<
  | { skipped: true; reason: string }
  | {
      recovery_id: string;
      actions: unknown[];
      stopped_reason?: string;
    }
> {
  const report_id = String(input.event.data.report_id ?? "").trim();
  const generation_id = String(input.event.data.generation_id ?? "").trim();
  const generation_epoch = Number(input.event.data.generation_epoch);
  const locale = String(input.event.data.locale ?? "en");
  if (!report_id || !generation_id || !Number.isFinite(generation_epoch)) {
    return { skipped: true, reason: "invalid_recover_event" };
  }
  const result = await runReportBatch3Recovery({
    report_id,
    generation_id,
    generation_epoch,
    locale,
  });
  if (!result.ok) {
    throw new Error(
      `batch3_recovery_failed:${result.code}:${result.detail}`,
    );
  }
  return result.value;
}

export const reportPageRecovery = inngest.createFunction(
  {
    id: "report-page-recovery",
    retries: 1,
    concurrency: [{ limit: 4, key: "event.data.report_id" }, { limit: 8 }],
    triggers: [{ event: REPORT_BATCH2_EVENTS.RECOVER }],
  },
  async ({ event, step }) => {
    return await step.run("recover", async () =>
      runReportPageRecoveryInngestStep({ event }),
    );
  },
);
