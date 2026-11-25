import { inngest } from "@/lib/inngest/client";
import {
  REPORT_BATCH2_EVENTS,
  runReportPageOrchestrateInngestStep,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch2";

export const reportPageOrchestrator = inngest.createFunction(
  {
    id: "report-page-orchestrator",
    retries: 2,
    concurrency: [
      {
        limit: 1,
        key: 'event.data.report_id + ":" + event.data.generation_id',
      },
      { limit: 8 },
    ],
    triggers: [{ event: REPORT_BATCH2_EVENTS.ORCHESTRATE }],
  },
  async ({ event, step }) => {
    return await step.run("orchestrate-tick", async () =>
      runReportPageOrchestrateInngestStep({ event }),
    );
  },
);