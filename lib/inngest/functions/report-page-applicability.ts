import { inngest } from "@/lib/inngest/client";
import {
  handleApplicabilityEvent,
  REPORT_BATCH2_EVENTS,
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
    const report_id = String(event.data.report_id ?? "").trim();
    const generation_id = String(event.data.generation_id ?? "").trim();
    if (!report_id || !generation_id) {
      return { skipped: true, reason: "invalid_applicability_event" };
    }
    return await step.run("applicability-07", async () =>
      handleApplicabilityEvent({
        report_id,
        generation_id,
        page_id: "07",
        locale: String(event.data.locale ?? "en"),
        upstream_output_fingerprints:
          (event.data.upstream_output_fingerprints as Record<string, string>) ?? {},
      }),
    );
  },
);