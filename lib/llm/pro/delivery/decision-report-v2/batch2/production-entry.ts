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
import { isReportBatch2InngestConfigured } from "./dispatch";
import {
  isReportBatch2SharedStoreAvailable,
  loadJob,
} from "./job-store";
import { startReportBatch2Production } from "./orchestrator";
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

export async function readReportBatch2ActivePointer(
  job_id: string,
): Promise<ReportBatch2ActivePointer | null> {
  try {
    return (await durableKv().get<ReportBatch2ActivePointer>(activePointerKey(job_id))) ?? null;
  } catch {
    return null;
  }
}

async function writeActivePointer(
  job_id: string,
  pointer: ReportBatch2ActivePointer,
): Promise<void> {
  await durableKv().set(activePointerKey(job_id), pointer, {
    ex: KV_TTL.REPORT_BATCH2_JOB,
  });
}

export async function startFinalDeliveryReportBatch2(
  job_id: string,
  input: FinalDeliveryJobInput,
): Promise<
  | { ok: true; generation_id: string }
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

  const lab = await loadDeliveryLab(productionV3LabId(job_id)).catch(() => null);
  const built = buildBatch2InputsFromFinalDelivery(job_id, input, lab);
  if (!built.ok) return built;

  const generation_id = `${job_id}:batch2`;
  const started = await startReportBatch2Production({
    report_id: job_id,
    generation_id,
    locale: input.locale,
    inputs: built.inputs,
  });
  if (!started.ok) return started;

  await writeActivePointer(job_id, {
    report_id: job_id,
    generation_id,
    started_at: new Date().toISOString(),
  });

  return { ok: true, generation_id };
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

  for (const key of FACE_DELIVERY_PAGE_KEYS) {
    const out = batch2Job.page_outputs[key as keyof typeof batch2Job.page_outputs];
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
  if (!ptr) return { phase: "not_started" };

  const loaded = await loadJob(ptr.report_id, ptr.generation_id);
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