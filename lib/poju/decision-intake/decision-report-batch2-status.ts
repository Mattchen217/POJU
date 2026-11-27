/**
 * Unit D R2/R3 — Batch2-authoritative DI2 Status (read-only).
 *
 * For jobs that carry batch2_identity_binding, Status must report Batch2/Batch3
 * production state. Never judges Batch2 health by the legacy DI2 continue lease,
 * never falls back to the old Runner when binding is present-but-invalid, and
 * never sends RECOVER / ORCHESTRATE or mutates production state.
 *
 * R3: Delivery Authorization is enforced by the Status caller before this adapter
 * returns page outcomes. DI2-bound Batch2 Jobs must carry a strict generation_epoch.
 * Terminal Generations still surface readable Batch2 page state when present.
 */

import { loadJobRawBlobs } from "@/lib/llm/pro/delivery/decision-report-v2/batch2/job-store";
import type { ReportBatch2JobStatus } from "@/lib/llm/pro/delivery/decision-report-v2/batch2/types";
import { readGeneration } from "@/lib/llm/pro/delivery/decision-report-v2/batch3/generation-store";
import type { GenerationStatus } from "@/lib/llm/pro/delivery/decision-report-v2/batch3/types";
import { REPORT_PAGE_IDS } from "@/lib/llm/pro/delivery/decision-report-v2/orchestration";
import type { ReportPageRuntimeState } from "@/lib/llm/pro/delivery/decision-report-v2/orchestration/types";
import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import type { PojuXhighJob } from "@/lib/poju/xhigh-job-types";
import {
  evaluateExistingDi2Batch2Binding,
  type Di2Batch2IdentityBinding,
} from "./decision-report-batch2-identity";
import {
  isDecisionReportJobInput,
  type DecisionReportBatch2ProductionSnapshot,
  type DecisionReportJobInput,
  type DecisionReportPageRecord,
  type DecisionReportStatusPayload,
} from "./decision-report-types";

export type DecisionReportStatusPayloadWithBatch2 = DecisionReportStatusPayload;

const TERMINAL_GENERATION = new Set<GenerationStatus>([
  "completed",
  "finalizing",
  "delivery_failed",
  "superseded",
  "failed",
  "cancelled",
]);

function basePayload(
  job: PojuXhighJob,
  ji: DecisionReportJobInput,
): Omit<
  DecisionReportStatusPayloadWithBatch2,
  | "ok"
  | "status"
  | "current_stage"
  | "pages"
  | "retryable"
  | "failure_reason"
  | "error"
  | "worker"
  | "batch2_production"
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
 * DI2-bound Batch2 Jobs must carry a finite positive integer epoch equal to the
 * binding's batch3_generation_epoch. Missing / non-number / invalid → fail closed.
 */
export function assertDi2BoundBatch2JobEpoch(
  epoch: unknown,
  expected: number,
): { ok: true; epoch: number } | { ok: false; detail: string } {
  if (typeof epoch !== "number") {
    return {
      ok: false,
      detail: `Batch2 Job generation_epoch missing or not a number (${String(epoch)})`,
    };
  }
  if (!Number.isFinite(epoch) || !Number.isInteger(epoch) || epoch < 1) {
    return {
      ok: false,
      detail: `Batch2 Job generation_epoch invalid (${String(epoch)})`,
    };
  }
  if (epoch !== expected) {
    return {
      ok: false,
      detail: `Batch2 Job generation_epoch ≠ binding epoch (${epoch} ≠ ${expected})`,
    };
  }
  return { ok: true, epoch };
}

/**
 * True when the DI2 job carries any batch2_identity_binding field value.
 * Presence alone routes Status into the Batch2-authoritative branch — even when
 * the binding is corrupted — so we never fall back to legacy lease stale-fail.
 */
export function di2JobHasBatch2IdentityBindingField(job: PojuXhighJob): boolean {
  return job.batch2_identity_binding != null;
}

type LoadedBatch2Pages = {
  batch2_job_status: ReportBatch2JobStatus;
  page_states: ReportPageRuntimeState[];
  page_outcomes: DecisionReportBatch2ProductionSnapshot["page_outcomes"];
};

function pageStatesFromRawBlobs(
  pages: Map<string, { state: ReportPageRuntimeState }>,
): ReportPageRuntimeState[] {
  const out: ReportPageRuntimeState[] = [];
  for (const page_id of REPORT_PAGE_IDS) {
    const blob = pages.get(page_id);
    if (blob?.state) {
      out.push(blob.state);
    } else {
      out.push({ page_id, outcome: "pending" });
    }
  }
  return out;
}

/**
 * Load + identity/epoch validate the bound Batch2 Job via raw blobs (no authority
 * demotion — Status must retain recorded page outcomes on terminal Generations).
 */
async function loadValidatedBatch2JobPages(input: {
  binding: Di2Batch2IdentityBinding;
}): Promise<
  | { ok: true; value: LoadedBatch2Pages }
  | { ok: false; code: "missing" | "unreadable" | "identity"; detail: string }
> {
  const { binding } = input;
  const raw = await loadJobRawBlobs(binding.report_id, binding.generation_id);
  if (!raw.ok) {
    return {
      ok: false,
      code: "unreadable",
      detail: `Batch2 Job unreadable: ${raw.detail ?? raw.code}`,
    };
  }
  if (!raw.value) {
    return {
      ok: false,
      code: "missing",
      detail: "Batch2 Job missing — Status refuses to create a replacement",
    };
  }

  const meta = raw.value.meta;
  if (
    meta.report_id !== binding.report_id ||
    meta.generation_id !== binding.generation_id
  ) {
    return {
      ok: false,
      code: "identity",
      detail: "Batch2 Job identity ≠ binding",
    };
  }

  const epochCheck = assertDi2BoundBatch2JobEpoch(
    meta.generation_epoch,
    binding.batch3_generation_epoch,
  );
  if (!epochCheck.ok) {
    return { ok: false, code: "identity", detail: epochCheck.detail };
  }

  const page_states = pageStatesFromRawBlobs(
    raw.value.pages as Map<string, { state: ReportPageRuntimeState }>,
  );
  const page_outcomes = page_states.map((st) => ({
    page_id: st.page_id,
    outcome: st.outcome,
    output_fingerprint: st.output_fingerprint ?? null,
  }));

  return {
    ok: true,
    value: {
      batch2_job_status: meta.status as ReportBatch2JobStatus,
      page_states,
      page_outcomes,
    },
  };
}

function snapshot(input: {
  binding: Di2Batch2IdentityBinding;
  generation_status: GenerationStatus;
  batch2_job_status: ReportBatch2JobStatus | null;
  pages_available: boolean;
  page_outcomes: DecisionReportBatch2ProductionSnapshot["page_outcomes"];
}): DecisionReportBatch2ProductionSnapshot {
  return {
    source: "batch2",
    report_id: input.binding.report_id,
    generation_id: input.binding.generation_id,
    generation_epoch: input.binding.batch3_generation_epoch,
    generation_status: input.generation_status,
    batch2_job_status: input.batch2_job_status,
    pages_available: input.pages_available,
    page_outcomes: input.page_outcomes,
  };
}

/**
 * Read-only Batch2/Batch3 Status for a DI2 decision_report job that carries a
 * binding field. Caller must enforce Delivery Authorization before exposing the
 * returned page outcomes. Does not mutate state and does not send events.
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

  const terminal = TERMINAL_GENERATION.has(gen.value.status);
  const loaded = await loadValidatedBatch2JobPages({ binding });

  if (terminal) {
    const mapped = mapGenerationToStatus({
      generation_status: gen.value.status,
      // Terminal Generation owns overall status; Batch2 job status is informational.
      batch2_job_status: null,
    });

    if (loaded.ok) {
      return {
        ...basePayload(job, ji),
        ...mapped,
        pages: mapPages(job, ji, loaded.value.page_states),
        worker: null,
        batch2_production: snapshot({
          binding,
          generation_status: gen.value.status,
          batch2_job_status: loaded.value.batch2_job_status,
          pages_available: true,
          page_outcomes: loaded.value.page_outcomes,
        }),
      };
    }

    if (loaded.code === "identity") {
      return identityErrorPayload(job, ji, "batch2_identity_error", loaded.detail);
    }

    // missing / unreadable — keep Generation terminal overall status; pages unavailable.
    return {
      ...basePayload(job, ji),
      ...mapped,
      pages: [],
      worker: null,
      batch2_production: snapshot({
        binding,
        generation_status: gen.value.status,
        batch2_job_status: null,
        pages_available: false,
        page_outcomes: [],
      }),
    };
  }

  // Non-terminal: Batch2 Job is required.
  if (!loaded.ok) {
    if (loaded.code === "missing") {
      return identityErrorPayload(job, ji, "batch2_job_missing", loaded.detail);
    }
    if (loaded.code === "unreadable") {
      return identityErrorPayload(job, ji, "batch2_job_unreadable", loaded.detail);
    }
    return identityErrorPayload(job, ji, "batch2_identity_error", loaded.detail);
  }

  const mapped = mapGenerationToStatus({
    generation_status: gen.value.status,
    batch2_job_status: loaded.value.batch2_job_status,
  });

  return {
    ...basePayload(job, ji),
    ...mapped,
    pages: mapPages(job, ji, loaded.value.page_states),
    worker: null,
    batch2_production: snapshot({
      binding,
      generation_status: gen.value.status,
      batch2_job_status: loaded.value.batch2_job_status,
      pages_available: true,
      page_outcomes: loaded.value.page_outcomes,
    }),
  };
}
