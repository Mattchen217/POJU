import { randomUUID } from "node:crypto";

import {
  buildOrchestratePayload,
  buildRepairPayload,
  sendReportBatch2Events,
} from "./dispatch";
import { runReportBatch2OrchestratorTick } from "./orchestrator";
import { runReportPage07ApplicabilityGate } from "./page07-gate";
import { runReportPageGenerateOnce } from "./page-generate";
import { runReportPageRepairOnce } from "./page-repair";
import { getJob } from "./job-store";
import type {
  ReportBatch2ApplicabilityEventData,
  ReportBatch2GenerateEventData,
  ReportBatch2OrchestrateEventData,
  ReportBatch2RepairEventData,
} from "./types";

async function maybeContinueOrchestration(
  report_id: string,
  generation_id: string,
  locale: string,
): Promise<void> {
  const job = getJob(report_id, generation_id);
  if (!job) return;
  await sendReportBatch2Events([
    buildOrchestratePayload({ report_id, generation_id, locale }),
  ]);
}

export async function handleOrchestrateEvent(
  data: ReportBatch2OrchestrateEventData,
): Promise<{ ok: boolean; dispatched_count: number; detail?: string }> {
  const tick = await runReportBatch2OrchestratorTick({
    report_id: data.report_id,
    generation_id: data.generation_id,
  });
  if (!tick.ok) {
    return { ok: false, dispatched_count: 0, detail: tick.detail };
  }
  return { ok: true, dispatched_count: tick.dispatched.length };
}

export async function handleGenerateEvent(data: ReportBatch2GenerateEventData): Promise<{
  ok: boolean;
  status: string;
  continued: boolean;
}> {
  const invocation_id = randomUUID();
  const result = await runReportPageGenerateOnce({
    event: data,
    invocation_id,
    worker_id: "report-page-generate",
  });

  if (result.status === "needs_repair") {
    const job = getJob(data.report_id, data.generation_id);
    const pending = job?.repair_pending[data.page_id];
    if (pending) {
      await sendReportBatch2Events([
        buildRepairPayload({
          report_id: data.report_id,
          generation_id: data.generation_id,
          page_id: data.page_id,
          locale: data.locale,
          input_fingerprint: pending.input_fingerprint,
        }),
      ]);
    }
    return { ok: true, status: "needs_repair", continued: false };
  }

  // Deferred Page02 (awaiting Page01): leave pending. Do NOT re-orchestrate
  // here — that would re-dispatch Page02 in a loop. Page01 completion will
  // trigger orchestrate and unlock Page02.
  if (result.status === "deferred") {
    return { ok: true, status: "deferred", continued: false };
  }

  const terminal =
    result.status === "completed" ||
    result.status === "failed" ||
    result.status === "skipped";
  if (terminal) {
    await maybeContinueOrchestration(data.report_id, data.generation_id, data.locale);
    return { ok: true, status: result.status, continued: true };
  }

  return { ok: true, status: result.status, continued: false };
}

export async function handleRepairEvent(data: ReportBatch2RepairEventData): Promise<{
  ok: boolean;
  status: string;
  continued: boolean;
}> {
  const invocation_id = randomUUID();
  const result = await runReportPageRepairOnce({
    event: data,
    invocation_id,
    worker_id: "report-page-repair",
  });

  await maybeContinueOrchestration(data.report_id, data.generation_id, data.locale);
  return {
    ok: result.status !== "failed" || "code" in result,
    status: result.status,
    continued: true,
  };
}

export async function handleApplicabilityEvent(
  data: ReportBatch2ApplicabilityEventData,
): Promise<{ ok: boolean; status: string; continued: boolean }> {
  const invocation_id = randomUUID();
  const result = await runReportPage07ApplicabilityGate({
    event: data,
    invocation_id,
    worker_id: "report-page-applicability",
  });

  if (result.status === "failed") {
    return { ok: false, status: "failed", continued: false };
  }

  await maybeContinueOrchestration(data.report_id, data.generation_id, data.locale);
  return {
    ok: true,
    status: result.status,
    continued: true,
  };
}