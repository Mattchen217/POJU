import { randomUUID } from "node:crypto";
import { NonRetriableError } from "inngest";

import {
  buildOrchestratePayload,
  buildRecoverPayload,
  buildRepairPayload,
  getReportBatch2EventSenderForTests,
  isReportBatch2InngestConfigured,
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

function finiteEpoch(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** True when Recovery can actually be scheduled (Inngest or test sender). */
function hasBatch2EventBus(): boolean {
  return (
    !!getReportBatch2EventSenderForTests() || isReportBatch2InngestConfigured()
  );
}

async function triggerRecoverOrThrow(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  locale: string;
  prior: string;
}): Promise<void> {
  const recover = await sendReportBatch2Events([
    buildRecoverPayload({
      report_id: input.report_id,
      generation_id: input.generation_id,
      generation_epoch: input.generation_epoch,
      locale: input.locale,
    }),
  ]);
  if (!recover.ok) {
    throw new Error(
      `${input.prior}; recover_trigger_failed:${recover.code}:${recover.detail}`,
    );
  }
}

/**
 * After Generate/Repair/Applicability: continue DAG via ORCHESTRATE.
 * On send failure with a valid epoch, trigger RECOVER (Unit D).
 */
async function maybeContinueOrchestration(
  report_id: string,
  generation_id: string,
  locale: string,
  generation_epoch?: number,
): Promise<void> {
  const loaded = await loadJob(report_id, generation_id);
  const epoch =
    finiteEpoch(generation_epoch) ??
    (loaded.ok && loaded.value
      ? finiteEpoch(loaded.value.generation_epoch)
      : undefined);

  if (!loaded.ok || !loaded.value) {
    if (epoch === undefined) return;
    // Job read failed but caller has epoch — still attempt follow-up / Recovery.
  }

  const send = await sendReportBatch2Events([
    buildOrchestratePayload({
      report_id,
      generation_id,
      locale,
      generation_epoch: epoch,
    }),
  ]);
  if (send.ok) return;

  // No event bus → cannot schedule Recovery (MEMORY_KV unit tests without sender).
  if (!hasBatch2EventBus()) return;

  const prior = `orchestrate_followup_failed:${send.code}:${send.detail}`;
  if (epoch === undefined) {
    throw new Error(prior);
  }
  await triggerRecoverOrThrow({
    report_id,
    generation_id,
    generation_epoch: epoch,
    locale,
    prior,
  });
}

export async function handleOrchestrateEvent(
  data: ReportBatch2OrchestrateEventData,
): Promise<{
  ok: boolean;
  dispatched_count: number;
  detail?: string;
  recovery_triggered?: boolean;
}> {
  const tick = await runReportBatch2OrchestratorTick({
    report_id: data.report_id,
    generation_id: data.generation_id,
  });
  if (!tick.ok) {
    const epoch = finiteEpoch(data.generation_epoch);
    if (epoch === undefined || !hasBatch2EventBus()) {
      return { ok: false, dispatched_count: 0, detail: tick.detail };
    }
    await triggerRecoverOrThrow({
      report_id: data.report_id,
      generation_id: data.generation_id,
      generation_epoch: epoch,
      locale: data.locale,
      prior: `orchestrate_tick_failed:${tick.detail}`,
    });
    return {
      ok: false,
      dispatched_count: 0,
      detail: tick.detail,
      recovery_triggered: true,
    };
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
      const sent = await sendReportBatch2Events([
        buildRepairPayload({
          report_id: data.report_id,
          generation_id: data.generation_id,
          page_id: data.page_id,
          locale: data.locale,
          input_fingerprint: pending.input_fingerprint,
          generation_epoch: data.generation_epoch,
        }),
      ]);
      if (!sent.ok) {
        // Pending + handoff already durable — trigger Recovery to resend REPAIR.
        if (hasBatch2EventBus()) {
          const epoch = finiteEpoch(data.generation_epoch);
          const prior = `repair_dispatch_failed:${sent.code}:${sent.detail}`;
          if (epoch === undefined) {
            throw new Error(prior);
          }
          await triggerRecoverOrThrow({
            report_id: data.report_id,
            generation_id: data.generation_id,
            generation_epoch: epoch,
            locale: data.locale,
            prior,
          });
        }
      }
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
      data.generation_epoch,
    );
    throwForBatch2WorkerFailure("generate", result);
  }

  if (result.status === "completed" || result.status === "skipped") {
    await maybeContinueOrchestration(
      data.report_id,
      data.generation_id,
      data.locale,
      data.generation_epoch,
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
      data.generation_epoch,
    );
    throwForBatch2WorkerFailure("repair", result);
  }

  await maybeContinueOrchestration(
    data.report_id,
    data.generation_id,
    data.locale,
    data.generation_epoch,
  );
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

  await maybeContinueOrchestration(
    data.report_id,
    data.generation_id,
    data.locale,
    data.generation_epoch,
  );
  return {
    ok: true,
    status: result.status,
    continued: true,
  };
}

export async function runReportPageOrchestrateInngestStep(input: {
  event: { data: Record<string, unknown> };
}): Promise<{
  ok: boolean;
  dispatched_count: number;
  detail?: string;
  skipped?: boolean;
  reason?: string;
  recovery_triggered?: boolean;
}> {
  const report_id = String(input.event.data.report_id ?? "").trim();
  const generation_id = String(input.event.data.generation_id ?? "").trim();
  if (!report_id || !generation_id) {
    return { ok: true, dispatched_count: 0, skipped: true, reason: "missing_job_ids" };
  }
  const epochRaw = input.event.data.generation_epoch;
  const generation_epoch =
    typeof epochRaw === "number"
      ? epochRaw
      : typeof epochRaw === "string" && epochRaw.trim() !== ""
        ? Number(epochRaw)
        : undefined;
  return handleOrchestrateEvent({
    report_id,
    generation_id,
    locale: String(input.event.data.locale ?? "en"),
    generation_epoch: finiteEpoch(generation_epoch),
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
  const epochRaw = input.event.data.generation_epoch;
  const generation_epoch =
    typeof epochRaw === "number"
      ? epochRaw
      : typeof epochRaw === "string" && epochRaw.trim() !== ""
        ? Number(epochRaw)
        : undefined;
  return handleGenerateEvent({
    report_id,
    generation_id,
    page_id: page_id as ReportBatch2GenerateEventData["page_id"],
    locale: String(input.event.data.locale ?? "en"),
    input_fingerprint: String(input.event.data.input_fingerprint ?? ""),
    upstream_output_fingerprints:
      (input.event.data.upstream_output_fingerprints as ReportBatch2GenerateEventData["upstream_output_fingerprints"]) ??
      {},
    generation_epoch: finiteEpoch(generation_epoch),
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
  const epochRaw = input.event.data.generation_epoch;
  const generation_epoch =
    typeof epochRaw === "number"
      ? epochRaw
      : typeof epochRaw === "string" && epochRaw.trim() !== ""
        ? Number(epochRaw)
        : undefined;
  return handleRepairEvent({
    report_id,
    generation_id,
    page_id: page_id as ReportBatch2RepairEventData["page_id"],
    locale: String(input.event.data.locale ?? "en"),
    input_fingerprint: String(input.event.data.input_fingerprint ?? ""),
    generation_epoch: finiteEpoch(generation_epoch),
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
  const epochRaw = input.event.data.generation_epoch;
  const generation_epoch =
    typeof epochRaw === "number"
      ? epochRaw
      : typeof epochRaw === "string" && epochRaw.trim() !== ""
        ? Number(epochRaw)
        : undefined;
  return handleApplicabilityEvent({
    report_id,
    generation_id,
    page_id: "07",
    locale: String(input.event.data.locale ?? "en"),
    upstream_output_fingerprints:
      (input.event.data.upstream_output_fingerprints as ReportBatch2ApplicabilityEventData["upstream_output_fingerprints"]) ??
      {},
    generation_epoch: finiteEpoch(generation_epoch),
  });
}
