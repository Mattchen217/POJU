import { randomUUID } from "node:crypto";
import { NonRetriableError } from "inngest";

import {
  buildOrchestratePayload,
  buildRepairPayload,
  sendReportBatch2Events,
} from "./dispatch";
import { runReportBatch2OrchestratorTick } from "./orchestrator";
import { runReportPage07ApplicabilityGate } from "./page07-gate";
import { runReportPageGenerateOnce } from "./page-generate";
import { runReportPageRepairOnce } from "./page-repair";
import { loadJob } from "./job-store";
import type {
  ReportBatch2ApplicabilityEventData,
  ReportBatch2GenerateEventData,
  ReportBatch2OrchestrateEventData,
  ReportBatch2RepairEventData,
  ReportBatch2WorkerResult,
} from "./types";

/**
 * Map Worker failed result → Inngest semantics.
 * - retryable: throw Error (platform retries; Claim must already be released)
 * - terminal: NonRetriableError (no infinite retry; state already persisted)
 */
export function throwForBatch2WorkerFailure(
  kind: "generate" | "repair",
  result: Extract<ReportBatch2WorkerResult, { status: "failed" }>,
): never {
  const msg = `batch2_${kind}_failed:${result.code}:${result.detail}`;
  if (result.retryable === true) {
    throw new Error(msg);
  }
  throw new NonRetriableError(msg);
}

async function maybeContinueOrchestration(
  report_id: string,
  generation_id: string,
  locale: string,
): Promise<void> {
  const loaded = await loadJob(report_id, generation_id);
  if (!loaded.ok || !loaded.value) return;
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
    const loaded = await loadJob(data.report_id, data.generation_id);
    const pending =
      loaded.ok && loaded.value
        ? loaded.value.repair_pending[data.page_id]
        : undefined;
    if (pending) {
      await sendReportBatch2Events([
        buildRepairPayload({
          report_id: data.report_id,
          generation_id: data.generation_id,
          page_id: data.page_id,
          locale: data.locale,
          input_fingerprint: pending.input_fingerprint,
          generation_epoch: data.generation_epoch,
        }),
      ]);
    }
    return { ok: true, status: "needs_repair", continued: false };
  }

  if (result.status === "deferred") {
    return { ok: true, status: "deferred", continued: false };
  }

  if (result.status === "failed") {
    // Unit C: do not swallow retryable failures as successful Function results.
    if (result.retryable === true) {
      throwForBatch2WorkerFailure("generate", result);
    }
    await maybeContinueOrchestration(
      data.report_id,
      data.generation_id,
      data.locale,
    );
    throwForBatch2WorkerFailure("generate", result);
  }

  if (result.status === "completed" || result.status === "skipped") {
    await maybeContinueOrchestration(
      data.report_id,
      data.generation_id,
      data.locale,
    );
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

  if (result.status === "failed") {
    if (result.retryable === true) {
      throwForBatch2WorkerFailure("repair", result);
    }
    await maybeContinueOrchestration(
      data.report_id,
      data.generation_id,
      data.locale,
    );
    throwForBatch2WorkerFailure("repair", result);
  }

  await maybeContinueOrchestration(data.report_id, data.generation_id, data.locale);
  return {
    ok: true,
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

export async function runReportPageOrchestrateInngestStep(input: {
  event: { data: Record<string, unknown> };
}): Promise<{ ok: boolean; dispatched_count: number; detail?: string; skipped?: boolean; reason?: string }> {
  const report_id = String(input.event.data.report_id ?? "").trim();
  const generation_id = String(input.event.data.generation_id ?? "").trim();
  if (!report_id || !generation_id) {
    return { ok: true, dispatched_count: 0, skipped: true, reason: "missing_job_ids" };
  }
  return handleOrchestrateEvent({
    report_id,
    generation_id,
    locale: String(input.event.data.locale ?? "en"),
  });
}

export async function runReportPageGenerateInngestStep(input: {
  event: { data: Record<string, unknown> };
}): Promise<Record<string, unknown>> {
  const report_id = String(input.event.data.report_id ?? "").trim();
  const generation_id = String(input.event.data.generation_id ?? "").trim();
  const page_id = String(input.event.data.page_id ?? "").trim();
  if (!report_id || !generation_id || !page_id) {
    return { skipped: true, reason: "invalid_generate_event" };
  }
  return handleGenerateEvent({
    report_id,
    generation_id,
    page_id: page_id as ReportBatch2GenerateEventData["page_id"],
    locale: String(input.event.data.locale ?? "en"),
    input_fingerprint: String(input.event.data.input_fingerprint ?? ""),
    upstream_output_fingerprints:
      (input.event.data.upstream_output_fingerprints as ReportBatch2GenerateEventData["upstream_output_fingerprints"]) ?? {},
  });
}

export async function runReportPageRepairInngestStep(input: {
  event: { data: Record<string, unknown> };
}): Promise<Record<string, unknown>> {
  const report_id = String(input.event.data.report_id ?? "").trim();
  const generation_id = String(input.event.data.generation_id ?? "").trim();
  const page_id = String(input.event.data.page_id ?? "").trim();
  if (!report_id || !generation_id || !page_id) {
    return { skipped: true, reason: "invalid_repair_event" };
  }
  return handleRepairEvent({
    report_id,
    generation_id,
    page_id: page_id as ReportBatch2RepairEventData["page_id"],
    locale: String(input.event.data.locale ?? "en"),
    input_fingerprint: String(input.event.data.input_fingerprint ?? ""),
  });
}

export async function runReportPageApplicabilityInngestStep(input: {
  event: { data: Record<string, unknown> };
}): Promise<Record<string, unknown>> {
  const report_id = String(input.event.data.report_id ?? "").trim();
  const generation_id = String(input.event.data.generation_id ?? "").trim();
  if (!report_id || !generation_id) {
    return { skipped: true, reason: "invalid_applicability_event" };
  }
  return handleApplicabilityEvent({
    report_id,
    generation_id,
    page_id: "07",
    locale: String(input.event.data.locale ?? "en"),
    upstream_output_fingerprints:
      (input.event.data.upstream_output_fingerprints as ReportBatch2ApplicabilityEventData["upstream_output_fingerprints"]) ?? {},
  });
}