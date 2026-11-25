import { inngest } from "@/lib/inngest/client";
import type { ReportPageId, ReportUpstreamOutputFingerprints } from "../orchestration/types";
import { REPORT_BATCH2_EVENTS } from "./events";
import type { ReportBatch2EventPayload } from "./events";
import type {
  ReportBatch2ApplicabilityEventData,
  ReportBatch2GenerateEventData,
  ReportBatch2OrchestrateEventData,
  ReportBatch2RepairEventData,
} from "./types";

export function isReportBatch2InngestConfigured(): boolean {
  const key = process.env.INNGEST_EVENT_KEY?.trim();
  if (!key) return false;
  if (process.env.REPORT_BATCH2_VIA_INNGEST === "0") return false;
  return true;
}

export type ReportBatch2EventSender = {
  send(
    events: Array<{ name: string; data: Record<string, unknown> }>,
  ): Promise<{ ok: true } | { ok: false; code: string; detail: string }>;
};

let testSender: ReportBatch2EventSender | null = null;

export function setReportBatch2EventSenderForTests(
  sender: ReportBatch2EventSender | null,
): void {
  testSender = sender;
}

export function getReportBatch2EventSenderForTests(): ReportBatch2EventSender | null {
  return testSender;
}

export async function sendReportBatch2Events(
  events: ReportBatch2EventPayload[],
): Promise<{ ok: true } | { ok: false; code: string; detail: string }> {
  const sender = testSender;
  if (sender) {
    return sender.send(
      events.map((e) => ({ name: e.name, data: e.data as Record<string, unknown> })),
    );
  }
  if (!isReportBatch2InngestConfigured()) {
    return {
      ok: false,
      code: "inngest_unavailable",
      detail: "INNGEST_EVENT_KEY missing or REPORT_BATCH2_VIA_INNGEST=0",
    };
  }
  try {
    await inngest.send(
      events.map((e) => ({
        name: e.name,
        data: e.data,
      })),
    );
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      code: "inngest_send_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export function buildOrchestratePayload(input: {
  report_id: string;
  generation_id: string;
  locale: string;
  generation_epoch?: number;
}): { name: typeof REPORT_BATCH2_EVENTS.ORCHESTRATE; data: ReportBatch2OrchestrateEventData } {
  return {
    name: REPORT_BATCH2_EVENTS.ORCHESTRATE,
    data: {
      report_id: input.report_id.trim(),
      generation_id: input.generation_id.trim(),
      locale: input.locale.trim(),
      generation_epoch: input.generation_epoch,
    },
  };
}

export function buildGeneratePayload(input: {
  report_id: string;
  generation_id: string;
  page_id: ReportPageId;
  locale: string;
  input_fingerprint: string;
  upstream_output_fingerprints: ReportUpstreamOutputFingerprints;
  generation_epoch?: number;
}): { name: typeof REPORT_BATCH2_EVENTS.GENERATE; data: ReportBatch2GenerateEventData } {
  return {
    name: REPORT_BATCH2_EVENTS.GENERATE,
    data: {
      report_id: input.report_id.trim(),
      generation_id: input.generation_id.trim(),
      page_id: input.page_id,
      locale: input.locale.trim(),
      input_fingerprint: input.input_fingerprint.trim(),
      upstream_output_fingerprints: input.upstream_output_fingerprints,
      generation_epoch: input.generation_epoch,
    },
  };
}

export function buildRepairPayload(input: {
  report_id: string;
  generation_id: string;
  page_id: ReportPageId;
  locale: string;
  input_fingerprint: string;
  generation_epoch?: number;
}): { name: typeof REPORT_BATCH2_EVENTS.REPAIR; data: ReportBatch2RepairEventData } {
  return {
    name: REPORT_BATCH2_EVENTS.REPAIR,
    data: {
      report_id: input.report_id.trim(),
      generation_id: input.generation_id.trim(),
      page_id: input.page_id,
      locale: input.locale.trim(),
      input_fingerprint: input.input_fingerprint.trim(),
      generation_epoch: input.generation_epoch,
    },
  };
}

export function buildApplicabilityPayload(input: {
  report_id: string;
  generation_id: string;
  locale: string;
  upstream_output_fingerprints: ReportUpstreamOutputFingerprints;
  generation_epoch?: number;
}): {
  name: typeof REPORT_BATCH2_EVENTS.APPLICABILITY;
  data: ReportBatch2ApplicabilityEventData;
} {
  return {
    name: REPORT_BATCH2_EVENTS.APPLICABILITY,
    data: {
      report_id: input.report_id.trim(),
      generation_id: input.generation_id.trim(),
      page_id: "07",
      locale: input.locale.trim(),
      upstream_output_fingerprints: input.upstream_output_fingerprints,
      generation_epoch: input.generation_epoch,
    },
  };
}