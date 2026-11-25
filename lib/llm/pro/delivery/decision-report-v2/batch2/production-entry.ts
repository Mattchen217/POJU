/**
 * Wire Batch2 into production final-delivery V3 eight-page V2 path (not DI2).
 */

import { durableKv, KV_TTL } from "@/lib/kv/client";
import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import { loadDeliveryLab, saveDeliveryLab } from "@/lib/llm/pro/delivery/lab/store";
import type { DeliveryLabSession } from "@/lib/llm/pro/delivery/lab/types";
import { productionDeliveryUsesV3 } from "@/lib/llm/pro/delivery/pipeline-v3/flag";
import {
  persistProductionV3Book,
  productionV3LabId,
} from "@/lib/llm/pro/delivery/pipeline-v3/production-run";
import { FACE_DELIVERY_PAGE_KEYS } from "@/lib/llm/pro/delivery/segment-key-alias";
import type { FinalDeliveryJobInput } from "@/lib/poju/xhigh-job-types";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import {
  buildOrchestratePayload,
  isReportBatch2InngestConfigured,
  sendReportBatch2Events,
} from "./dispatch";
import {
  createJobAndPersist,
  isReportBatch2SharedStoreAvailable,
  loadJob,
  updateJobStatus,
} from "./job-store";
import type { ReportBatch2JobInputs, ReportBatch2JobRecord } from "./types";

const ACTIVE_POINTER_PREFIX = "report-batch2-active:";

function activePointerKey(job_id: string): string {
  return `${ACTIVE_POINTER_PREFIX}${job_id.trim()}`;
}

export type ReportBatch2ActivePointer = {
  report_id: string;
  generation_id: string;
  started_at: string;
};

export type ActivePointerRead =
  | { status: "found"; pointer: ReportBatch2ActivePointer }
  | { status: "not_found" }
  | { status: "read_failed"; detail: string };

/**
 * Batch2 is the production path for face V2 when V3 delivery is active
 * and a frozen decision-context snapshot exists.
 */
export function shouldRunReportBatch2ForFinalDelivery(
  input: FinalDeliveryJobInput,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!productionDeliveryUsesV3(env)) return false;
  if (!input.decision_context_snapshot) return false;
  return true;
}

function buildBatch2InputsFromFinalDelivery(
  job_id: string,
  input: FinalDeliveryJobInput,
  lab: DeliveryLabSession | null,
): { ok: true; inputs: ReportBatch2JobInputs } | { ok: false; code: string; detail: string } {
  const dc = input.decision_context_snapshot as DecisionContext | null | undefined;
  if (!dc) {
    return {
      ok: false,
      code: "missing_decision_context",
      detail: "Final delivery missing decision_context_snapshot for Batch2 V2 faces",
    };
  }
  const pack =
    (lab?.artifacts?.book_judgment_pack as BookJudgmentPack | null | undefined) ??
    null;
  const prealloc = lab?.artifacts?.prealloc as { chart_fact_pack?: string } | undefined;
  const chart_fact_pack = prealloc?.chart_fact_pack?.trim() ?? null;

  return {
    ok: true,
    inputs: {
      report_id: job_id,
      dc,
      pack,
      chart_fact_pack,
      bazi_available: Boolean(chart_fact_pack),
      authorized_partner_profile: Boolean(input.partner_bazi),
    },
  };
}

/** Three-state pointer read — never maps KV failure to not_found. */
export async function readReportBatch2ActivePointer(
  job_id: string,
): Promise<ActivePointerRead> {
  try {
    const raw = await durableKv().get<ReportBatch2ActivePointer>(
      activePointerKey(job_id),
    );
    if (!raw?.report_id?.trim() || !raw?.generation_id?.trim()) {
      return { status: "not_found" };
    }
    return { status: "found", pointer: raw };
  } catch (err) {
    return {
      status: "read_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function writeActivePointer(
  job_id: string,
  pointer: ReportBatch2ActivePointer,
): Promise<{ ok: true } | { ok: false; code: string; detail: string }> {
  try {
    await durableKv().set(activePointerKey(job_id), pointer, {
      ex: KV_TTL.REPORT_BATCH2_JOB,
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      code: "pointer_write_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function startFinalDeliveryReportBatch2(
  job_id: string,
  input: FinalDeliveryJobInput,
): Promise<
  | { ok: true; generation_id: string; generation_epoch?: number; reused?: boolean }
  | { ok: false; code: string; detail: string }
> {
  if (!shouldRunReportBatch2ForFinalDelivery(input)) {
    return { ok: false, code: "batch2_not_applicable", detail: "Batch2 path not selected" };
  }
  if (!isReportBatch2SharedStoreAvailable()) {
    return {
      ok: false,
      code: "kv_unavailable",
      detail: "Batch2 production requires shared KV — no V3 face fallback",
    };
  }
  if (!isReportBatch2InngestConfigured()) {
    return {
      ok: false,
      code: "inngest_unavailable",
      detail: "Batch2 production requires Inngest — no V3 face fallback",
    };
  }

  const existing = await readReportBatch2ActivePointer(job_id);
  if (existing.status === "read_failed") {
    return {
      ok: false,
      code: "pointer_read_failed",
      detail: existing.detail,
    };
  }
  const generation_id = `${job_id}:batch2`;
  if (existing.status === "found") {
    if (existing.pointer.generation_id === generation_id) {
      // Same generation already started — do not recreate Job or re-dispatch.
      return { ok: true, generation_id, reused: true };
    }
    return {
      ok: false,
      code: "pointer_generation_conflict",
      detail: `active pointer generation ${existing.pointer.generation_id} != ${generation_id}`,
    };
  }

  const lab = await loadDeliveryLab(productionV3LabId(job_id)).catch(() => null);
  const built = buildBatch2InputsFromFinalDelivery(job_id, input, lab);
  if (!built.ok) return built;

  // Batch3: allocate epoch + activate (also writes Batch2 pointer), then Job, then event.
  const { allocateGeneration, activateGeneration } = await import("../batch3/generation-store");
  const allocated = await allocateGeneration({
    report_id: job_id,
    locale: input.locale,
    generation_id,
  });
  if (!allocated.ok) {
    return { ok: false, code: allocated.code, detail: allocated.detail };
  }
  const activated = await activateGeneration({
    record: allocated.value,
    job_id,
  });
  if (!activated.ok) {
    return { ok: false, code: activated.code, detail: activated.detail };
  }
  const generation_epoch = allocated.value.generation_epoch;
  const gid = allocated.value.generation_id;

  const created = await createJobAndPersist({
    report_id: job_id,
    generation_id: gid,
    locale: input.locale,
    inputs: built.inputs,
    status: "orchestrating",
    generation_epoch,
  });
  if (!created.ok) {
    return { ok: false, code: created.code, detail: created.detail };
  }

  // Mirror Batch2 pointer (activateGeneration already wrote; reinforce for readers)
  const ptrWrite = await writeActivePointer(job_id, {
    report_id: job_id,
    generation_id: gid,
    started_at: new Date().toISOString(),
  });
  if (!ptrWrite.ok) {
    await updateJobStatus(job_id, gid, "failed").catch(() => undefined);
    return ptrWrite;
  }

  const payload = buildOrchestratePayload({
    report_id: job_id,
    generation_id: gid,
    locale: input.locale,
    generation_epoch,
  });
  const { enqueueDispatchIntent, markIntentFailed, markIntentSent } = await import(
    "../batch3/dispatch-intent"
  );
  const intent = await enqueueDispatchIntent({
    report_id: job_id,
    generation_id: gid,
    generation_epoch,
    event_name: payload.name,
    payload: { ...payload.data },
  });
  if (!intent.ok) {
    await updateJobStatus(job_id, gid, "failed").catch(() => undefined);
    return { ok: false, code: intent.code, detail: intent.detail };
  }
  const send = await sendReportBatch2Events([payload]);
  if (!send.ok) {
    await markIntentFailed(intent.value, send.detail);
    await updateJobStatus(job_id, gid, "failed").catch(() => undefined);
    return {
      ok: false,
      code: send.code,
      detail: `${send.detail} (pointer retained; job status=failed; intent retained)`,
    };
  }
  await markIntentSent(intent.value);

  return { ok: true, generation_id: gid, generation_epoch };
}

/** Test hook: run between authority reads and finalization claim (TOCTOU inject). */
let mergeBeforeClaimHook: (() => Promise<void> | void) | null = null;

export function setMergeBeforeFinalizationClaimHookForTests(
  hook: (() => Promise<void> | void) | null,
): void {
  mergeBeforeClaimHook = hook;
}

/**
 * Final delivery merge — never trusts caller Job fields.
 * Persisted meta + raw blobs + authority + atomic finalization claim gate.
 */
export async function mergeReportBatch2IntoV3Lab(
  job_id: string,
  input: FinalDeliveryJobInput,
  batch2Job: ReportBatch2JobRecord,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  // Identity from caller is only used as KV lookup key — never trust status/outputs.
  const report_id = batch2Job.report_id.trim();
  const generation_id = batch2Job.generation_id.trim();
  const epochHint = batch2Job.generation_epoch;

  const lab_id = productionV3LabId(job_id);
  const lab = await loadDeliveryLab(lab_id);
  if (!lab) {
    return { ok: false, reason: "v3_lab_missing_for_batch2_merge" };
  }

  const { claimFinalization, readAuthorityGatedPage } = await import("../batch3");
  const { loadJobRawBlobs } = await import("./job-store");
  const {
    REPORT_PAGE_IDS,
    REPORT_UPSTREAM_SATISFYING_OUTCOMES,
    resolveReportReadyState,
  } = await import("../orchestration");
  type FinalizationPageBinding =
    import("../batch3/finalization").FinalizationPageBinding;
  type ReportPageRuntimeState =
    import("../orchestration/types").ReportPageRuntimeState;
  type ReportPageOutcome = import("../orchestration/types").ReportPageOutcome;

  const raw = await loadJobRawBlobs(report_id, generation_id);
  if (!raw.ok) {
    return { ok: false, reason: `merge_job_read_failed:${raw.code}` };
  }
  if (!raw.value) {
    return { ok: false, reason: "merge_job_missing" };
  }

  const meta = raw.value.meta;
  const epoch =
    typeof meta.generation_epoch === "number"
      ? meta.generation_epoch
      : typeof epochHint === "number"
        ? epochHint
        : null;
  if (typeof epoch !== "number") {
    return {
      ok: false,
      reason: "batch2_merge_requires_generation_epoch_for_authority_gate",
    };
  }
  if (meta.report_id !== report_id || meta.generation_id !== generation_id) {
    return { ok: false, reason: "merge_persisted_meta_identity_mismatch" };
  }
  if (meta.status !== "completed") {
    return {
      ok: false,
      reason: `merge_persisted_meta_not_completed:status=${meta.status}`,
    };
  }

  // Validate every required DAG page from persisted blobs — no caller skip.
  const bindings: FinalizationPageBinding[] = [];
  const authorityStates: ReportPageRuntimeState[] = [];

  for (const page_id of REPORT_PAGE_IDS) {
    const blob = raw.value.pages.get(page_id) ?? null;
    if (!blob) {
      return {
        ok: false,
        reason: `merge_required_page_blob_missing:${page_id}`,
      };
    }
    const gated = await readAuthorityGatedPage({
      report_id,
      generation_id,
      generation_epoch: epoch,
      page_id,
      blob,
    });
    if (gated.verdict === "unavailable") {
      return {
        ok: false,
        reason: `merge_page_${page_id}_authority_unavailable:${gated.detail}`,
      };
    }
    if (gated.verdict !== "valid" || !gated.authority_output || !gated.fence || !gated.provenance) {
      return {
        ok: false,
        reason: `merge_page_${page_id}_authority_${gated.verdict}:${gated.detail}`,
      };
    }

    const outcome = gated.state?.outcome ?? blob.state.outcome;
    if (
      !(REPORT_UPSTREAM_SATISFYING_OUTCOMES as readonly string[]).includes(
        outcome,
      )
    ) {
      return {
        ok: false,
        reason: `merge_page_${page_id}_not_terminal:outcome=${outcome}`,
      };
    }

    // Page07: require a real conditional terminal (applicable completed or skip states).
    if (page_id === "07") {
      if (
        outcome !== "completed" &&
        outcome !== "skipped_not_applicable" &&
        outcome !== "insufficient_information"
      ) {
        return {
          ok: false,
          reason: `merge_page07_invalid_terminal:outcome=${outcome}`,
        };
      }
      if (
        outcome === "completed" &&
        gated.authority_output.output == null
      ) {
        return { ok: false, reason: "merge_page07_applicable_missing_output" };
      }
    } else if (outcome !== "completed" || gated.authority_output.output == null) {
      return {
        ok: false,
        reason: `merge_page_${page_id}_requires_completed_output`,
      };
    }

    authorityStates.push({
      page_id,
      outcome: outcome as ReportPageOutcome,
      output_fingerprint: gated.authority_output.output_fingerprint,
      input_fingerprint: gated.provenance.input_fingerprint,
      applicability_status: gated.state?.applicability_status,
    });

    bindings.push({
      page_id,
      generation_id,
      generation_epoch: epoch,
      validity_rev: gated.fence.validity_rev,
      attempt_id: gated.fence.attempt_id!,
      task_key: gated.fence.task_key!,
      output_fingerprint: gated.fence.output_fingerprint!,
      input_fingerprint: gated.fence.input_fingerprint!,
      sealed_output: gated.authority_output.output,
      outcome,
    });
  }

  const ready = resolveReportReadyState(authorityStates);
  if (
    ready.ready_model_generations.length > 0 ||
    ready.ready_applicability_gates.length > 0
  ) {
    return {
      ok: false,
      reason: `merge_dag_incomplete:ready_model=${ready.ready_model_generations.join(",")} ready_gate=${ready.ready_applicability_gates.join(",")}`,
    };
  }
  if (ready.blocked.length > 0 || ready.blocked_derived.length > 0) {
    return {
      ok: false,
      reason: `merge_dag_blocked:${[...ready.blocked, ...ready.blocked_derived].map((b) => b.page_id).join(",")}`,
    };
  }

  if (mergeBeforeClaimHook) {
    await mergeBeforeClaimHook();
  }

  const { randomUUID } = await import("node:crypto");
  const claimed = await claimFinalization({
    report_id,
    generation_id,
    generation_epoch: epoch,
    claim_id: randomUUID(),
    pages: bindings,
  });
  if (!claimed.ok) {
    return {
      ok: false,
      reason: `merge_finalization_refused:${claimed.code}:${claimed.detail}`,
    };
  }

  // Deliver only sealed outputs from the successful claim (immutable bindings).
  const reportPageSet = new Set<string>(REPORT_PAGE_IDS);
  for (const key of FACE_DELIVERY_PAGE_KEYS) {
    if (!reportPageSet.has(key)) continue; // glossary 03 derived
    const binding = claimed.value.pages.find((p) => p.page_id === key);
    if (!binding) {
      return { ok: false, reason: `merge_claim_missing_page:${key}` };
    }
    const out = binding.sealed_output;
    if (out == null) {
      return { ok: false, reason: `merge_claim_empty_output:${key}` };
    }
    const byPage = lab.artifacts.by_page ?? {};
    byPage[key] = { ...byPage[key], page_schema: out };
    lab.artifacts.by_page = byPage;
    const bodyKey = `${key}.content.body`;
    const step = lab.steps[bodyKey];
    if (step) {
      lab.steps[bodyKey] = { ...step, status: "approved" };
    }
  }

  const assemble = lab.steps["book.assemble"];
  if (assemble) {
    lab.steps["book.assemble"] = { ...assemble, status: "approved" };
  }
  lab.updated_at = Date.now();
  await saveDeliveryLab(lab);

  const saved = await persistProductionV3Book(job_id, lab, input.locale);
  if (!saved.ok) return { ok: false, reason: saved.reason };
  return { ok: true };
}

export async function pollFinalDeliveryReportBatch2(
  job_id: string,
  input: FinalDeliveryJobInput,
): Promise<
  | { phase: "not_started" }
  | { phase: "running" }
  | { phase: "completed"; job: ReportBatch2JobRecord }
  | { phase: "failed"; reason: string }
> {
  const ptr = await readReportBatch2ActivePointer(job_id);
  if (ptr.status === "read_failed") {
    return { phase: "failed", reason: `pointer_read_failed:${ptr.detail}` };
  }
  if (ptr.status === "not_found") return { phase: "not_started" };

  const loaded = await loadJob(ptr.pointer.report_id, ptr.pointer.generation_id);
  if (!loaded.ok) {
    return { phase: "failed", reason: loaded.code };
  }
  const job = loaded.value;
  if (!job) {
    return { phase: "failed", reason: "job_not_found" };
  }
  if (job.status === "completed") {
    const merged = await mergeReportBatch2IntoV3Lab(job_id, input, job);
    if (!merged.ok) {
      return { phase: "failed", reason: merged.reason };
    }
    return { phase: "completed", job };
  }
  if (job.status === "failed") {
    return { phase: "failed", reason: "report_batch2_failed" };
  }
  return { phase: "running" };
}
