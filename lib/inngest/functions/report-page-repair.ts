import { inngest } from "@/lib/inngest/client";
import {
  REPORT_BATCH2_EVENTS,
  runReportPageRepairInngestStep,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch2";

export const reportPageRepair = inngest.createFunction(
  {
    id: "report-page-repair",
    retries: 2,
    concurrency: [
      { limit: 4, key: "event.data.report_id" },
      { limit: 16 },
    ],
    triggers: [{ event: REPORT_BATCH2_EVENTS.REPAIR }],
  },
  async ({ event, step }) => {
    const page_id = String(event.data.page_id ?? "").trim() || "page";
    return await step.run(`repair-${page_id}`, async () =>
      runReportPageRepairInngestStep({ event }),
    );
  },
);