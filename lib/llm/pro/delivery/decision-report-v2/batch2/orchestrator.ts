import { randomUUID } from "node:crypto";

import { resolveReportReadyState } from "../orchestration";
import type { ReportPageId } from "../orchestration/types";
import {
  appendDispatchLog,
  createJob,
  getJob,
  saveJob,
  updatePageState,
} from "./job-store";
import {
  buildApplicabilityPayload,
  buildGeneratePayload,
  buildOrchestratePayload,
  getReportBatch2EventSenderForTests,
  isReportBatch2InngestConfigured,
  sendReportBatch2Events,
} from "./dispatch";
import { REPORT_BATCH2_EVENTS, type ReportBatch2EventPayload } from "./events";
import {
  buildPageProductionPrep,
  collectOutputFingerprints,
  computePageInputFingerprintForJob,
  upstreamFingerprintsForPage,
} from "./page-prep";
import type { ReportBatch2JobInputs } from "./types";

const DISPATCH_GUARD = new Set([
  "queued",
  "running",
  "validating",
  "repair_queued",
  "completed",
  "skipped_not_applicable",
  "insufficient_information",
  "failed",
  "cancelled",
]);

function isTerminalOutcome(outcome: string): boolean {
  return (
    outcome === "completed" ||
    outcome === "skipped_not_applicable" ||
    outcome === "insufficient_information" ||
    outcome === "failed" ||
    outcome === "cancelled"
  );
}

function refreshJobStatus(job: ReturnType<typeof getJob>): void {
  if (!job) return;
  const states = job.page_states;
  const allTerminal = states.every((s) => isTerminalOutcome(s.outcome));
  const anyFailed = states.some((s) => s.outcome === "failed");
  if (allTerminal) {
    job.status = anyFailed ? "failed" : "completed";
  } else {
    job.status = "running";
  }
}

export async function runReportBatch2OrchestratorTick(input: {
  report_id: string;
  generation_id: string;
}): Promise<
  | { ok: true; dispatched: ReportBatch2EventPayload[] }
  | { ok: false; code: string; detail: string }
> {
  const job = getJob(input.report_id, input.generation_id);
  if (!job) {
    return { ok: false, code: "job_not_found", detail: "batch2 job missing" };
  }

  const ready = resolveReportReadyState(job.page_states);
  const dispatched: ReportBatch2EventPayload[] = [];
  const upstreamAll = collectOutputFingerprints(job);
  const pendingSend: ReportBatch2EventPayload[] = [];

  for (const page_id of ready.ready_applicability_gates) {
    const st = job.page_states.find((s) => s.page_id === page_id);
    if (st && DISPATCH_GUARD.has(st.outcome)) continue;
    const payload = buildApplicabilityPayload({
      report_id: job.report_id,
      generation_id: job.generation_id,
      locale: job.locale,
      upstream_output_fingerprints: upstreamAll,
    });
    pendingSend.push(payload);
    updatePageState(job, page_id, { outcome: "queued" });
    appendDispatchLog(job, {
      at: new Date().toISOString(),
      event_name: REPORT_BATCH2_EVENTS.APPLICABILITY,
      page_id,
      upstream_output_fingerprints: upstreamAll,
      detail: "dispatched applicability gate",
    });
    dispatched.push(payload);
  }

  // Collect all model-ready pages first (e.g. Page01∥Page02), then send once —
  // never wait for Page01 completion before enqueueing Page02.
  for (const page_id of ready.ready_model_generations) {
    const st = job.page_states.find((s) => s.page_id === page_id);
    if (st && DISPATCH_GUARD.has(st.outcome)) continue;

    const prep = buildPageProductionPrep(job, page_id);
    if (prep.build_fail) {
      updatePageState(job, page_id, { outcome: "failed" });
      continue;
    }
    const fp = computePageInputFingerprintForJob(job, page_id, prep);
    if (!fp.ok) {
      updatePageState(job, page_id, { outcome: "failed" });
      continue;
    }
    const upstream = upstreamFingerprintsForPage(job, page_id, prep.ctx);
    const payload = buildGeneratePayload({
      report_id: job.report_id,
      generation_id: job.generation_id,
      page_id,
      locale: job.locale,
      input_fingerprint: fp.result.fingerprint,
      upstream_output_fingerprints: upstream,
    });
    pendingSend.push(payload);
    updatePageState(job, page_id, {
      outcome: "queued",
      input_fingerprint: fp.result.fingerprint,
    });
    appendDispatchLog(job, {
      at: new Date().toISOString(),
      event_name: REPORT_BATCH2_EVENTS.GENERATE,
      page_id,
      input_fingerprint: fp.result.fingerprint,
      upstream_output_fingerprints: upstream,
      detail: "dispatched model generation",
    });
    dispatched.push(payload);
  }

  if (pendingSend.length) {
    const send = await sendReportBatch2Events(pendingSend);
    if (!send.ok) {
      return send;
    }
  }

  job.status = "orchestrating";
  refreshJobStatus(job);
  saveJob(job);
  return { ok: true, dispatched };
}

export async function startReportBatch2Production(input: {
  report_id: string;
  generation_id?: string;
  locale: string;
  inputs: ReportBatch2JobInputs;
  persist_kv?: boolean;
}): Promise<
  | { ok: true; report_id: string; generation_id: string }
  | { ok: false; code: string; detail: string }
> {
  if (!isReportBatch2InngestConfigured() && !getReportBatch2EventSenderForTests()) {
    return {
      ok: false,
      code: "inngest_unavailable",
      detail:
        "Batch2 requires Inngest (INNGEST_EVENT_KEY) or a test event sender — no V3 fallback",
    };
  }

  const generation_id = (input.generation_id?.trim() || randomUUID()).trim();
  const report_id = input.report_id.trim();
  createJob({
    report_id,
    generation_id,
    locale: input.locale,
    inputs: input.inputs,
    persist_kv: input.persist_kv,
  });

  const payload = buildOrchestratePayload({
    report_id,
    generation_id,
    locale: input.locale,
  });
  const send = await sendReportBatch2Events([payload]);
  if (!send.ok) {
    return send;
  }

  const job = getJob(report_id, generation_id);
  if (job) {
    job.status = "orchestrating";
    saveJob(job);
  }

  return { ok: true, report_id, generation_id };
}

export function pageIdsFromDispatched(
  dispatched: ReportBatch2EventPayload[],
): ReportPageId[] {
  return dispatched
    .map((d) =>
      "page_id" in d.data ? (d.data.page_id as ReportPageId) : null,
    )
    .filter((x): x is ReportPageId => !!x);
}