import { randomUUID } from "node:crypto";

import { resolveReportReadyState } from "../orchestration";
import type { ReportPageId } from "../orchestration/types";
import {
  appendDispatchLog,
  createJobAndPersist,
  isReportBatch2SharedStoreAvailable,
  loadJob,
  saveJob,
  updateJobStatus,
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
import type { ReportBatch2JobInputs, ReportBatch2JobRecord } from "./types";

/** Outcomes that mean work is done or in-flight — but NOT bare "queued"
 * (queued without a durable Intent is an orphan that Recovery must re-dispatch). */
const DISPATCH_GUARD = new Set([
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

function refreshJobStatus(job: ReportBatch2JobRecord): void {
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
  // loadJob authority-gates terminal page blobs when generation_epoch is set —
  // stale/missing/mismatch pages arrive as pending and cannot unlock downstream.
  const loaded = await loadJob(input.report_id, input.generation_id);
  if (!loaded.ok) {
    return { ok: false, code: loaded.code, detail: loaded.detail };
  }
  const job = loaded.value;
  if (!job) {
    return { ok: false, code: "job_not_found", detail: "batch2 job missing" };
  }

  // Batch3: refuse dispatch from superseded / inactive generations.
  if (typeof job.generation_epoch === "number") {
    const { assertGenerationActive } = await import("../batch3/generation-store");
    const fence = await assertGenerationActive({
      report_id: job.report_id,
      generation_id: job.generation_id,
      generation_epoch: job.generation_epoch,
    });
    if (!fence.ok) {
      return { ok: false, code: fence.code, detail: fence.detail };
    }
  }

  const ready = resolveReportReadyState(job.page_states);
  const dispatched: ReportBatch2EventPayload[] = [];
  const upstreamAll = collectOutputFingerprints(job);
  const pendingSend: ReportBatch2EventPayload[] = [];

  for (const page_id of ready.ready_applicability_gates) {
    const st = job.page_states.find((s) => s.page_id === page_id);
    if (st && DISPATCH_GUARD.has(st.outcome)) continue;
    if (st?.outcome === "queued" && typeof job.generation_epoch === "number") {
      const { hasActiveDispatchIntent } = await import("../batch3/dispatch-intent");
      const has = await hasActiveDispatchIntent({
        report_id: job.report_id,
        generation_id: job.generation_id,
        page_id,
      });
      if (has.ok && has.value) continue;
    }
    const payload = buildApplicabilityPayload({
      report_id: job.report_id,
      generation_id: job.generation_id,
      locale: job.locale,
      upstream_output_fingerprints: upstreamAll,
      generation_epoch: job.generation_epoch,
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

  for (const page_id of ready.ready_model_generations) {
    const st = job.page_states.find((s) => s.page_id === page_id);
    if (st && DISPATCH_GUARD.has(st.outcome)) continue;
    if (st?.outcome === "queued" && typeof job.generation_epoch === "number") {
      const { hasActiveDispatchIntent } = await import("../batch3/dispatch-intent");
      const has = await hasActiveDispatchIntent({
        report_id: job.report_id,
        generation_id: job.generation_id,
        page_id,
      });
      if (has.ok && has.value) continue;
    }

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
      generation_epoch: job.generation_epoch,
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

  job.status = "orchestrating";
  refreshJobStatus(job);

  // Persist Intent BEFORE saveJob(queued) so crash after queued cannot orphan.
  // Intent ID binds real TaskKey (incl. validity_rev) — never reuse across revs.
  const intents = [];
  if (pendingSend.length && typeof job.generation_epoch === "number") {
    const { enqueueDispatchIntent, markIntentFailed, markIntentSent } =
      await import("../batch3/dispatch-intent");
    const { computeTaskKey } = await import("../batch3/task-identity");
    const { ensurePageFence } = await import("../batch3/page-fence");
    const { reportPageDefinition } = await import("../orchestration");
    for (const payload of pendingSend) {
      const page_id =
        "page_id" in payload.data ? payload.data.page_id : null;
      const input_fingerprint =
        "input_fingerprint" in payload.data
          ? String(payload.data.input_fingerprint ?? "")
          : null;
      let task_key: string | null = null;
      if (page_id) {
        const fence = await ensurePageFence({
          report_id: job.report_id,
          generation_id: job.generation_id,
          generation_epoch: job.generation_epoch,
          page_id,
        });
        if (!fence.ok) {
          return { ok: false, code: fence.code, detail: fence.detail };
        }
        const def = reportPageDefinition(page_id);
        const upstream =
          "upstream_output_fingerprints" in payload.data
            ? (payload.data.upstream_output_fingerprints as Record<
                string,
                string
              >) ?? {}
            : {};
        const task_type =
          payload.name.includes("repair")
            ? ("repair" as const)
            : payload.name.includes("applicability")
              ? ("applicability" as const)
              : ("generate" as const);
        task_key = computeTaskKey({
          report_id: job.report_id,
          generation_id: job.generation_id,
          generation_epoch: job.generation_epoch,
          page_id,
          validity_rev: fence.value.validity_rev,
          input_fingerprint: input_fingerprint ?? "",
          upstream_output_fingerprints: upstream,
          page_contract_version: def.production_version,
          prompt_version: def.prompt_version,
          validator_version: def.validator_version,
          task_type,
        });
      }
      const intent = await enqueueDispatchIntent({
        report_id: job.report_id,
        generation_id: job.generation_id,
        generation_epoch: job.generation_epoch,
        event_name: payload.name,
        page_id,
        task_key,
        input_fingerprint,
        payload: { ...payload.data },
      });
      if (!intent.ok) {
        return { ok: false, code: intent.code, detail: intent.detail };
      }
      intents.push(intent.value);
    }
  }

  const preSend = await saveJob(job);
  if (!preSend.ok) {
    return { ok: false, code: preSend.code, detail: preSend.detail };
  }

  if (pendingSend.length) {
    if (typeof job.generation_epoch === "number") {
      const { markIntentFailed, markIntentSent } = await import(
        "../batch3/dispatch-intent"
      );
      const send = await sendReportBatch2Events(pendingSend);
      if (!send.ok) {
        for (const intent of intents) {
          await markIntentFailed(intent, send.detail);
        }
        return send;
      }
      for (const intent of intents) {
        await markIntentSent(intent);
      }
    } else {
      const send = await sendReportBatch2Events(pendingSend);
      if (!send.ok) {
        return send;
      }
    }
  }

  return { ok: true, dispatched };
}

export async function startReportBatch2Production(input: {
  report_id: string;
  generation_id?: string;
  locale: string;
  inputs: ReportBatch2JobInputs;
  persist_kv?: boolean;
}): Promise<
  | { ok: true; report_id: string; generation_id: string; generation_epoch?: number }
  | { ok: false; code: string; detail: string }
> {
  void input.persist_kv;
  if (!isReportBatch2SharedStoreAvailable()) {
    return {
      ok: false,
      code: "kv_unavailable",
      detail:
        "Batch2 requires shared durable KV (Upstash/KV env) — no V3 face fallback",
    };
  }
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

  // Batch3 fencing: allocate monotonic epoch and activate before events.
  const { allocateGeneration, activateGeneration } = await import("../batch3/generation-store");
  const allocated = await allocateGeneration({
    report_id,
    locale: input.locale,
    generation_id,
  });
  if (!allocated.ok) {
    return { ok: false, code: allocated.code, detail: allocated.detail };
  }
  const generation_epoch = allocated.value.generation_epoch;
  const gid = allocated.value.generation_id;

  const activated = await activateGeneration({
    record: allocated.value,
    job_id: report_id,
  });
  if (!activated.ok) {
    return { ok: false, code: activated.code, detail: activated.detail };
  }

  // Persist full initial Job (incl. orchestrating) BEFORE any event — never
  // write a stale create-time snapshot after workers may have started.
  const created = await createJobAndPersist({
    report_id,
    generation_id: gid,
    locale: input.locale,
    inputs: input.inputs,
    status: "orchestrating",
    generation_epoch,
  });
  if (!created.ok) {
    return { ok: false, code: created.code, detail: created.detail };
  }

  const payload = buildOrchestratePayload({
    report_id,
    generation_id: gid,
    locale: input.locale,
    generation_epoch,
  });
  const { enqueueDispatchIntent, markIntentFailed, markIntentSent } = await import(
    "../batch3/dispatch-intent"
  );
  const intent = await enqueueDispatchIntent({
    report_id,
    generation_id: gid,
    generation_epoch,
    event_name: payload.name,
    payload: { ...payload.data },
  });
  if (!intent.ok) {
    await updateJobStatus(report_id, gid, "failed").catch(() => undefined);
    return { ok: false, code: intent.code, detail: intent.detail };
  }
  const send = await sendReportBatch2Events([payload]);
  if (!send.ok) {
    await markIntentFailed(intent.value, send.detail);
    // Unit D: durable Job + failed Intent → trigger Recovery (do not fail production).
    const { buildRecoverPayload } = await import("./dispatch");
    const recover = await sendReportBatch2Events([
      buildRecoverPayload({
        report_id,
        generation_id: gid,
        generation_epoch,
        locale: input.locale,
      }),
    ]);
    if (recover.ok) {
      return { ok: true, report_id, generation_id: gid, generation_epoch };
    }
    throw new Error(
      `orchestrate_dispatch_failed:${send.code}:${send.detail}; recover_trigger_failed:${recover.code}:${recover.detail}`,
    );
  }
  await markIntentSent(intent.value);

  return { ok: true, report_id, generation_id: gid, generation_epoch };
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