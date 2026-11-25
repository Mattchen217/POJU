import { inngest } from "@/lib/inngest/client";
import {
  handleOrchestrateEvent,
  REPORT_BATCH2_EVENTS,
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
    const report_id = String(event.data.report_id ?? "").trim();
    const generation_id = String(event.data.generation_id ?? "").trim();
    if (!report_id || !generation_id) {
      return { skipped: true, reason: "missing_job_ids" };
    }
    return await step.run("orchestrate-tick", async () =>
      handleOrchestrateEvent({
        report_id,
        generation_id,
        locale: String(event.data.locale ?? "en"),
      }),
    );
  },
);