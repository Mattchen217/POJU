/**
 * Unit D R2 — Batch2-authoritative DI2 Status (read-only).
 *
 * For jobs that carry batch2_identity_binding, Status must report Batch2/Batch3
 * production state. Never judges Batch2 health by the legacy DI2 continue lease,
 * never falls back to the old Runner when binding is present-but-invalid, and
 * never sends RECOVER / ORCHESTRATE or mutates production state.
 */

import { loadJob } from "@/lib/llm/pro/delivery/decision-report-v2/batch2/job-store";
import type { ReportBatch2JobStatus } from "@/lib/llm/pro/delivery/decision-report-v2/batch2/types";
import { readGeneration } from "@/lib/llm/pro/delivery/decision-report-v2/batch3/generation-store";
import type { GenerationStatus } from "@/lib/llm/pro/delivery/decision-report-v2/batch3/types";
import type { ReportPageRuntimeState } from "@/lib/llm/pro/delivery/decision-report-v2/orchestration/types";
import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import type { PojuXhighJob } from "@/lib/poju/xhigh-job-types";
import { evaluateExistingDi2Batch2Binding } from "./decision-report-batch2-identity";
import {
  isDecisionReportJobInput,
  type DecisionReportBatch2ProductionSnapshot,
  type DecisionReportJobInput,
  type DecisionReportPageRecord,
  type DecisionReportStatusPayload,
} from "./decision-report-types";

export type DecisionReportStatusPayloadWithBatch2 = DecisionReportStatusPayload;

function basePayload(
  job: PojuXhighJob,
  ji: DecisionReportJobInput,
): Omit<
  DecisionReportStatusPayloadWithBatch2,
  "ok" | "status" | "current_stage" | "pages" | "retryable" | "failure_reason" | "error" | "worker" | "batch2_production"
> {
  return {
    job_id: job.job_id,
    session_id: job.session_id,
    execution_generation: job.execution_generation ?? null,
    freeze_id: ji.freeze_id,
    context_hash: ji.context_hash,
    report_job_id: ji.report_job_id,
    profile_hash: ji.profile_hash,
    analysis: {
      status: "missing",
      analysis_id: null,
      attempts: 0,
      error: null,
      record: null,
    },
    result: null,
  };
}

function identityErrorPayload(
  job: PojuXhighJob,
  ji: DecisionReportJobInput,
  failure_reason: string,
  error: string,
): DecisionReportStatusPayloadWithBatch2 {
  return {
    ...basePayload(job, ji),
    ok: false,
    status: "failed",
    current_stage: null,
    pages: [],
    retryable: false,
    failure_reason,
    error,
    worker: null,
    batch2_production: null,
  };
}

function mapPageOutcomeToDi2Status(
  outcome: string,
): DecisionReportPageRecord["status"] {
  if (
    outcome === "completed" ||
    outcome === "skipped_not_applicable" ||
    outcome === "insufficient_information"
  ) {
    return "completed";
  }
  if (outcome === "failed") return "failed";
  return "pending";
}

function mapPages(
  job: PojuXhighJob,
  ji: DecisionReportJobInput,
  page_states: ReportPageRuntimeState[],
): DecisionReportPageRecord[] {
  return page_states.map((st) => ({
    page_id: st.page_id as DecisionPageId,
    status: mapPageOutcomeToDi2Status(st.outcome),
    applicability:
      st.applicability_status === "not_applicable" ? "not_applicable" : "applies",
    // Status is not Final Delivery — do not invent DI2 Report Store markdown.
    content_markdown: "",
    structured: null,
    job_id: job.job_id,
    execution_generation:
      typeof job.execution_generation === "number" ? job.execution_generation : 0,
    freeze_id: ji.freeze_id,
    context_hash: ji.context_hash,
    report_schema_version: ji.report_schema_version,
    analysis_id: "",
    attempts: 0,
    generated_at: null,
    error: null,
  }));
}

function mapGenerationToStatus(input: {
  generation_status: GenerationStatus;
  batch2_job_status: ReportBatch2JobStatus | null;
}): {
  status: DecisionReportStatusPayload["status"];
  current_stage: string;
  ok: boolean;
  failure_reason: string | null;
  error: string | null;
  retryable: boolean;
} {
  const { generation_status, batch2_job_status } = input;

  if (
    generation_status === "superseded" ||
    generation_status === "failed" ||
    generation_status === "cancelled"
  ) {
    return {
      status: "failed",
      current_stage: `batch2_${generation_status}`,
      ok: false,
      failure_reason: "batch2_generation_terminal",
      error: `Batch3 Generation status=${generation_status}`,
      retryable: false,
    };
  }

  if (generation_status === "delivery_failed") {
    return {
      status: "failed",
      current_stage: "batch2_delivery_failed",
      ok: false,
      failure_reason: "batch2_delivery_failed",
      error: "Batch3 Generation delivery_failed — not a page-generation failure",
      retryable: true,
    };
  }

  if (generation_status === "finalizing") {
    return {
      status: "running",
      current_stage: "batch2_finalizing",
      ok: true,
      failure_reason: null,
      error: null,
      retryable: false,
    };
  }

  if (generation_status === "completed") {
    // Ready for Unit E Final Delivery — not DI2 Report Store completed.
    return {
      status: "running",
      current_stage: "ready_for_delivery",
      ok: true,
      failure_reason: null,
      error: null,
      retryable: false,
    };
  }

  // active / pending Generation → production in flight
  if (batch2_job_status === "failed") {
    return {
      status: "failed",
      current_stage: "batch2_job_failed",
      ok: false,
      failure_reason: "batch2_job_failed",
      error: "Batch2 Job status=failed",
      retryable: false,
    };
  }

  if (batch2_job_status === "completed") {
    return {
      status: "running",
      current_stage: "ready_for_delivery",
      ok: true,
      failure_reason: null,
      error: null,
      retryable: false,
    };
  }

  return {
    status: "running",
    current_stage:
      batch2_job_status === "orchestrating"
        ? "batch2_orchestrating"
        : batch2_job_status === "pending"
          ? "batch2_pending"
          : "batch2_producing",
    ok: true,
    failure_reason: null,
    error: null,
    retryable: false,
  };
}

/**
 * True when the DI2 job carries any batch2_identity_binding field value.
 * Presence alone routes Status into the Batch2-authoritative branch — even when
 * the binding is corrupted — so we never fall back to legacy lease stale-fail.
 */
export function di2JobHasBatch2IdentityBindingField(job: PojuXhighJob): boolean {
  return job.batch2_identity_binding != null;
}

/**
 * Read-only Batch2/Batch3 Status for a DI2 decision_report job that carries a
 * binding field. Does not mutate DI2 / Batch2 / Batch3 state and does not send events.
 */
export async function buildBatch2AuthoritativeDecisionReportStatus(
  job: PojuXhighJob,
): Promise<DecisionReportStatusPayloadWithBatch2> {
  if (!isDecisionReportJobInput(job.input)) {
    return {
      ok: false,
      job_id: job.job_id,
      session_id: job.session_id,
      status: "failed",
      current_stage: null,
      execution_generation: job.execution_generation ?? null,
      freeze_id: null,
      context_hash: null,
      report_job_id: null,
      profile_hash: null,
      analysis: {
        status: "missing",
        analysis_id: null,
        attempts: 0,
        error: null,
        record: null,
      },
      pages: [],
      result: null,
      retryable: false,
      failure_reason: "batch2_identity_error",
      error: "job.input is not DecisionReportJobInput",
      worker: null,
      batch2_production: null,
    };
  }
  const ji = job.input as DecisionReportJobInput;

  const evaluated = evaluateExistingDi2Batch2Binding(job);
  if (!evaluated.ok) {
    return identityErrorPayload(
      job,
      ji,
      "batch2_identity_error",
      `Batch2 identity binding invalid: ${evaluated.code}: ${evaluated.detail}`,
    );
  }
  const binding = evaluated.binding;

  const gen = await readGeneration(binding.report_id, binding.generation_id);
  if (!gen.ok) {
    return identityErrorPayload(
      job,
      ji,
      "batch2_generation_unreadable",
      `Batch3 Generation unreadable: ${gen.detail ?? gen.code}`,
    );
  }
  if (!gen.value) {
    return identityErrorPayload(
      job,
      ji,
      "batch2_generation_missing",
      "Batch3 GenerationRecord missing — Status refuses to allocate",
    );
  }

  if (gen.value.report_id !== binding.report_id) {
    return identityErrorPayload(
      job,
      ji,
      "batch2_identity_error",
      `Generation report_id ≠ binding.report_id`,
    );
  }
  if (gen.value.generation_id !== binding.generation_id) {
    return identityErrorPayload(
      job,
      ji,
      "batch2_identity_error",
      `Generation generation_id ≠ binding.generation_id`,
    );
  }
  if (gen.value.generation_epoch !== binding.batch3_generation_epoch) {
    return identityErrorPayload(
      job,
      ji,
      "batch2_identity_error",
      `generation_epoch mismatch live=${gen.value.generation_epoch} binding=${binding.batch3_generation_epoch}`,
    );
  }

  // Terminal generation states that do not require a live Batch2 Job blob.
  if (
    gen.value.status === "completed" ||
    gen.value.status === "finalizing" ||
    gen.value.status === "delivery_failed" ||
    gen.value.status === "superseded" ||
    gen.value.status === "failed" ||
    gen.value.status === "cancelled"
  ) {
    const mapped = mapGenerationToStatus({
      generation_status: gen.value.status,
      batch2_job_status: null,
    });
    return {
      ...basePayload(job, ji),
      ...mapped,
      pages: [],
      worker: null,
      batch2_production: {
        source: "batch2",
        report_id: binding.report_id,
        generation_id: binding.generation_id,
        generation_epoch: binding.batch3_generation_epoch,
        generation_status: gen.value.status,
        batch2_job_status: null,
        page_outcomes: [],
      },
    };
  }

  const loaded = await loadJob(binding.report_id, binding.generation_id);
  if (!loaded.ok) {
    return identityErrorPayload(
      job,
      ji,
      "batch2_job_unreadable",
      `Batch2 Job unreadable: ${loaded.detail ?? loaded.code}`,
    );
  }
  if (!loaded.value) {
    return identityErrorPayload(
      job,
      ji,
      "batch2_job_missing",
      "Batch2 Job missing — Status refuses to create a replacement",
    );
  }

  const batch2Job = loaded.value;
  if (
    batch2Job.report_id !== binding.report_id ||
    batch2Job.generation_id !== binding.generation_id
  ) {
    return identityErrorPayload(
      job,
      ji,
      "batch2_identity_error",
      "Batch2 Job identity ≠ binding",
    );
  }
  if (
    typeof batch2Job.generation_epoch === "number" &&
    batch2Job.generation_epoch !== binding.batch3_generation_epoch
  ) {
    return identityErrorPayload(
      job,
      ji,
      "batch2_identity_error",
      `Batch2 Job generation_epoch ≠ binding epoch (${batch2Job.generation_epoch} ≠ ${binding.batch3_generation_epoch})`,
    );
  }

  const mapped = mapGenerationToStatus({
    generation_status: gen.value.status,
    batch2_job_status: batch2Job.status,
  });
  const page_outcomes: DecisionReportBatch2ProductionSnapshot["page_outcomes"] =
    batch2Job.page_states.map((st) => ({
      page_id: st.page_id,
      outcome: st.outcome,
      output_fingerprint: st.output_fingerprint ?? null,
    }));

  return {
    ...basePayload(job, ji),
    ...mapped,
    pages: mapPages(job, ji, batch2Job.page_states),
    worker: null,
    batch2_production: {
      source: "batch2",
      report_id: binding.report_id,
      generation_id: binding.generation_id,
      generation_epoch: binding.batch3_generation_epoch,
      generation_status: gen.value.status,
      batch2_job_status: batch2Job.status,
      page_outcomes,
    },
  };
}
