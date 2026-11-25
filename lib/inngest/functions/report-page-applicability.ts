import { inngest } from "@/lib/inngest/client";
import {
  REPORT_BATCH2_EVENTS,
  runReportPageApplicabilityInngestStep,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch2";

export const reportPageApplicability = inngest.createFunction(
  {
    id: "report-page-applicability",
    retries: 2,
    concurrency: [
      { limit: 4, key: "event.data.report_id" },
      { limit: 16 },
    ],
    triggers: [{ event: REPORT_BATCH2_EVENTS.APPLICABILITY }],
  },
  async ({ event, step }) => {
    return await step.run("applicability-07", async () =>
      runReportPageApplicabilityInngestStep({ event }),
    );
  },
);