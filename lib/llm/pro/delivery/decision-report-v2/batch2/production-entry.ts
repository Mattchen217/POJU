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

export async function mergeReportBatch2IntoV3Lab(
  job_id: string,
  input: FinalDeliveryJobInput,
  batch2Job: ReportBatch2JobRecord,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const lab_id = productionV3LabId(job_id);
  const lab = await loadDeliveryLab(lab_id);
  if (!lab) {
    return { ok: false, reason: "v3_lab_missing_for_batch2_merge" };
  }

  // Final delivery gate: never trust caller page_outputs alone when Batch3 epoch is set.
  const epoch = batch2Job.generation_epoch;
  if (typeof epoch !== "number") {
    return {
      ok: false,
      reason: "batch2_merge_requires_generation_epoch_for_authority_gate",
    };
  }

  const {
    assertGenerationActive,
    readAuthorityGatedPage,
  } = await import("../batch3");
  const {
    loadJobRawBlobs,
  } = await import("./job-store");

  const stillActive = await assertGenerationActive({
    report_id: batch2Job.report_id,
    generation_id: batch2Job.generation_id,
    generation_epoch: epoch,
  });
  if (!stillActive.ok) {
    return {
      ok: false,
      reason: `merge_generation_not_active:${stillActive.code}:${stillActive.detail}`,
    };
  }

  const raw = await loadJobRawBlobs(
    batch2Job.report_id,
    batch2Job.generation_id,
  );
  if (!raw.ok) {
    return { ok: false, reason: `merge_job_read_failed:${raw.code}` };
  }
  if (!raw.value) {
    return { ok: false, reason: "merge_job_missing" };
  }

  const authoritativeOutputs: Record<string, unknown> = {};
  const { REPORT_PAGE_IDS } = await import("../orchestration");
  const reportPageSet = new Set<string>(REPORT_PAGE_IDS);

  for (const key of FACE_DELIVERY_PAGE_KEYS) {
    // Glossary (03) is derived — not a Batch3 fenced model page.
    if (!reportPageSet.has(key)) continue;
    const page_id = key as import("../orchestration/types").ReportPageId;
    const blob = raw.value.pages.get(page_id) ?? null;
    const callerOut =
      batch2Job.page_outputs[page_id as keyof typeof batch2Job.page_outputs];
    const st = batch2Job.page_states.find((s) => s.page_id === page_id);

    // Nothing claimed for this face page — skip (optional pages / not yet done).
    if (!callerOut && !blob?.output && st?.outcome !== "completed") continue;

    // Caller or raw blob claims output → must pass authority; forged Job rejected.
    const gated = await readAuthorityGatedPage({
      report_id: batch2Job.report_id,
      generation_id: batch2Job.generation_id,
      generation_epoch: epoch,
      page_id,
      blob:
        blob ??
        (callerOut
          ? {
              rev: 0,
              state: {
                page_id,
                outcome: "completed" as const,
                output_fingerprint: st?.output_fingerprint ?? undefined,
              },
              output: callerOut,
            }
          : null),
    });
    if (gated.verdict === "unavailable") {
      return {
        ok: false,
        reason: `merge_page_${key}_authority_unavailable:${gated.detail}`,
      };
    }
    if (gated.verdict !== "valid" || !gated.authority_output) {
      return {
        ok: false,
        reason: `merge_page_${key}_authority_${gated.verdict}:${gated.detail}`,
      };
    }
    authoritativeOutputs[key] = gated.authority_output.output;
  }

  // Page07 conditional terminals: if Job claims a terminal gate outcome, require authority.
  {
    const st07 = batch2Job.page_states.find((s) => s.page_id === "07");
    const blob07 = raw.value.pages.get("07") ?? null;
    if (
      st07 &&
      (st07.outcome === "completed" ||
        st07.outcome === "skipped_not_applicable" ||
        st07.outcome === "insufficient_information")
    ) {
      const gated07 = await readAuthorityGatedPage({
        report_id: batch2Job.report_id,
        generation_id: batch2Job.generation_id,
        generation_epoch: epoch,
        page_id: "07",
        blob:
          blob07 ??
          ({
            rev: 0,
            state: st07,
            output: batch2Job.page_outputs["07"],
          } as const),
      });
      if (gated07.verdict === "unavailable") {
        return {
          ok: false,
          reason: `merge_page07_authority_unavailable:${gated07.detail}`,
        };
      }
      if (gated07.verdict !== "valid") {
        return {
          ok: false,
          reason: `merge_page07_authority_${gated07.verdict}:${gated07.detail}`,
        };
      }
    }
  }

  // Re-check generation still active after per-page reads (invalidation race).
  const stillActive2 = await assertGenerationActive({
    report_id: batch2Job.report_id,
    generation_id: batch2Job.generation_id,
    generation_epoch: epoch,
  });
  if (!stillActive2.ok) {
    return {
      ok: false,
      reason: `merge_generation_superseded_before_lab_write:${stillActive2.code}`,
    };
  }

  for (const key of FACE_DELIVERY_PAGE_KEYS) {
    const out = authoritativeOutputs[key];
    if (!out) continue;
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
