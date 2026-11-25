import { inngest } from "@/lib/inngest/client";
import {
  REPORT_BATCH2_EVENTS,
  runReportPageGenerateInngestStep,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch2";

export const reportPageGenerate = inngest.createFunction(
  {
    id: "report-page-generate",
    retries: 2,
    concurrency: [
      { limit: 4, key: "event.data.report_id" },
      { limit: 16 },
    ],
    triggers: [{ event: REPORT_BATCH2_EVENTS.GENERATE }],
  },
  async ({ event, step }) => {
  const page_id = String(event.data.page_id ?? "").trim() || "page";
    return await step.run(`generate-${page_id}`, async () =>
      runReportPageGenerateInngestStep({ event }),
    );
  },
);