import { inngest } from "@/lib/inngest/client";
import { REPORT_BATCH2_EVENTS } from "@/lib/llm/pro/delivery/decision-report-v2/batch2/events";
import { runReportBatch3Recovery } from "@/lib/llm/pro/delivery/decision-report-v2/batch3/recovery";

export const reportPageRecovery = inngest.createFunction(
  {
    id: "report-page-recovery",
    retries: 1,
    concurrency: [{ limit: 4, key: "event.data.report_id" }, { limit: 8 }],
    triggers: [{ event: REPORT_BATCH2_EVENTS.RECOVER }],
  },
  async ({ event, step }) => {
    return await step.run("recover", async () => {
      const report_id = String(event.data.report_id ?? "").trim();
      const generation_id = String(event.data.generation_id ?? "").trim();
      const generation_epoch = Number(event.data.generation_epoch);
      const locale = String(event.data.locale ?? "en");
      if (!report_id || !generation_id || !Number.isFinite(generation_epoch)) {
        return { skipped: true, reason: "invalid_recover_event" };
      }
      return runReportBatch3Recovery({
        report_id,
        generation_id,
        generation_epoch,
        locale,
      });
    });
  },
);
