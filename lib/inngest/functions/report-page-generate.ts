import { inngest } from "@/lib/inngest/client";
import {
  handleGenerateEvent,
  REPORT_BATCH2_EVENTS,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch2";
import { isReportPageId } from "@/lib/llm/pro/delivery/decision-report-v2/orchestration";

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
    const report_id = String(event.data.report_id ?? "").trim();
    const generation_id = String(event.data.generation_id ?? "").trim();
    const page_id = String(event.data.page_id ?? "").trim();
    if (!report_id || !generation_id || !isReportPageId(page_id)) {
      return { skipped: true, reason: "invalid_generate_event" };
    }
    return await step.run(`generate-${page_id}`, async () =>
      handleGenerateEvent({
        report_id,
        generation_id,
        page_id,
        locale: String(event.data.locale ?? "en"),
        input_fingerprint: String(event.data.input_fingerprint ?? ""),
        upstream_output_fingerprints:
          (event.data.upstream_output_fingerprints as Record<string, string>) ?? {},
      }),
    );
  },
);