/**
 * Unit B — DI2 ↔ Batch2 job identity binding (persist only; no Start).
 *
 * Maps a DI2 decision_report PojuXhighJob to:
 * - Batch2 report_id (= DI2 report_job_id)
 * - Batch2 generation_id (from Batch3 allocateGeneration — never forged)
 * - DI2 execution_generation at bind time
 *
 * Does not: Start Batch2, activate generation for workers, send Inngest,
 * modify Freeze/Profile/DC, call models, or touch Batch2/3 DAG.
 *
 * Trust notes for Unit C:
 * - Binding proves durable identity linkage, not that Start was authorized.
 * - Batch3 generation_epoch is NOT DI2 execution_generation.
 */

import {
  allocateGeneration,
  readGeneration,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch3/generation-store";
import { kv, KV_TTL } from "@/lib/kv/client";
import {
  commitXhighJobUnderExecutionFence,
  getXhighJob,
} from "@/lib/poju/xhigh-job-store";
import type { PojuXhighJob } from "@/lib/poju/xhigh-job-types";
import {
  isDecisionReportJobInput,
  type DecisionReportJobInput,
} from "@/lib/poju/decision-intake/decision-report-types";

/** NX create-claim so concurrent ensures cannot mint two bindings for one job. */
function batch2IdentityClaimKey(job_id: string): string {
  return `poju-di2:batch2-identity-claim:${job_id.trim()}`;
}

/** Persisted binding object on PojuXhighJob.batch2_identity_binding. */
export type Di2Batch2IdentityBinding = {
  report_id: string;
  generation_id: string;
  di2_execution_generation: number;
  status: "bound";
  /** Audit only — not used for identity equality. */
  created_at: string;
  /**
   * Batch3 fencing token from allocateGeneration.
   * Recorded for traceability; must NOT be treated as DI2 execution_generation.
   */
  batch3_generation_epoch: number;
};

export type Di2Batch2IdentityErrorCode =
  | "missing_job"
  | "wrong_phase"
  | "missing_report_job_id"
  | "missing_execution_generation"
  | "invalid_execution_generation"
  | "report_id_mismatch"
  | "execution_generation_mismatch"
  | "dual_generation_conflict"
  | "generation_allocate_failed"
  | "cas_conflict_unresolved"
  | "cas_unavailable"
  | "job_revoked";

export type Di2Batch2IdentityResult =
  | {
      ok: true;
      binding: Di2Batch2IdentityBinding;
      /** true when this call wrote the binding; false when returned existing. */
      created: boolean;
      job: PojuXhighJob;
    }
  | {
      ok: false;
      code: Di2Batch2IdentityErrorCode;
      detail: string;
    };

/** Deterministic Batch2 generation_id for a DI2 report_job_id (allocate without Start). */
export function di2Batch2GenerationId(report_job_id: string): string {
  return `${report_job_id.trim()}:batch2`;
}

function isBoundBinding(v: unknown): v is Di2Batch2IdentityBinding {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const b = v as Record<string, unknown>;
  return (
    b.status === "bound" &&
    typeof b.report_id === "string" &&
    b.report_id.trim().length > 0 &&
    typeof b.generation_id === "string" &&
    b.generation_id.trim().length > 0 &&
    typeof b.di2_execution_generation === "number" &&
    Number.isFinite(b.di2_execution_generation) &&
    typeof b.created_at === "string" &&
    typeof b.batch3_generation_epoch === "number" &&
    Number.isFinite(b.batch3_generation_epoch)
  );
}

function decisionReportInput(job: PojuXhighJob): DecisionReportJobInput | null {
  return isDecisionReportJobInput(job.input) ? job.input : null;
}

/**
 * Validate an already-persisted binding against the live job.
 * Fail closed on identity drift — never auto-repair by overwrite.
 */
export function evaluateExistingDi2Batch2Binding(
  job: PojuXhighJob,
): Di2Batch2IdentityResult {
  if (job.phase !== "decision_report") {
    return {
      ok: false,
      code: "wrong_phase",
      detail: `expected decision_report, got ${job.phase}`,
    };
  }
  const input = decisionReportInput(job);
  if (!input) {
    return {
      ok: false,
      code: "wrong_phase",
      detail: "job.input is not DecisionReportJobInput",
    };
  }
  const report_job_id = input.report_job_id?.trim() ?? "";
  if (!report_job_id) {
    return {
      ok: false,
      code: "missing_report_job_id",
      detail: "DecisionReportJobInput.report_job_id required",
    };
  }
  if (
    typeof job.execution_generation !== "number" ||
    !Number.isFinite(job.execution_generation) ||
    !Number.isInteger(job.execution_generation) ||
    job.execution_generation < 1
  ) {
    return {
      ok: false,
      code:
        job.execution_generation == null
          ? "missing_execution_generation"
          : "invalid_execution_generation",
      detail: `execution_generation=${String(job.execution_generation)}`,
    };
  }

  const raw = job.batch2_identity_binding;
  if (raw == null) {
    return {
      ok: false,
      code: "missing_job",
      detail: "no batch2_identity_binding on job",
    };
  }
  if (!isBoundBinding(raw)) {
    return {
      ok: false,
      code: "dual_generation_conflict",
      detail: "batch2_identity_binding present but not a valid bound record",
    };
  }

  if (raw.report_id !== report_job_id) {
    return {
      ok: false,
      code: "report_id_mismatch",
      detail: `binding.report_id=${raw.report_id} report_job_id=${report_job_id}`,
    };
  }
  if (raw.di2_execution_generation !== job.execution_generation) {
    return {
      ok: false,
      code: "execution_generation_mismatch",
      detail:
        `binding.di2_execution_generation=${raw.di2_execution_generation} ` +
        `job.execution_generation=${job.execution_generation}`,
    };
  }

  const expectedGid = di2Batch2GenerationId(report_job_id);
  if (raw.generation_id !== expectedGid) {
    return {
      ok: false,
      code: "dual_generation_conflict",
      detail:
        `existing generation_id=${raw.generation_id} expected=${expectedGid} ` +
        `for di2_execution_generation=${job.execution_generation}`,
    };
  }

  return { ok: true, binding: raw, created: false, job };
}

/**
 * Read binding from a persisted job. Fail closed if unbound or identity drift.
 */
export async function readDi2Batch2IdentityBinding(
  job_id: string,
): Promise<Di2Batch2IdentityResult> {
  const job = await getXhighJob(job_id);
  if (!job) {
    return { ok: false, code: "missing_job", detail: `job_id=${job_id}` };
  }
  const evaluated = evaluateExistingDi2Batch2Binding(job);
  if (!evaluated.ok && evaluated.code === "missing_job") {
    return {
      ok: false,
      code: "missing_job",
      detail: "batch2_identity_binding not set (unbound)",
    };
  }
  return evaluated;
}

async function resolveAllocatedGeneration(input: {
  report_id: string;
  locale: string;
  generation_id: string;
}): Promise<
  | {
      ok: true;
      generation_id: string;
      batch3_generation_epoch: number;
    }
  | { ok: false; code: Di2Batch2IdentityErrorCode; detail: string }
> {
  const existing = await readGeneration(input.report_id, input.generation_id);
  if (!existing.ok) {
    return {
      ok: false,
      code: "generation_allocate_failed",
      detail: existing.detail ?? existing.code,
    };
  }
  if (existing.value) {
    return {
      ok: true,
      generation_id: existing.value.generation_id,
      batch3_generation_epoch: existing.value.generation_epoch,
    };
  }

  const allocated = await allocateGeneration({
    report_id: input.report_id,
    locale: input.locale,
    generation_id: input.generation_id,
  });
  if (allocated.ok) {
    return {
      ok: true,
      generation_id: allocated.value.generation_id,
      batch3_generation_epoch: allocated.value.generation_epoch,
    };
  }

  // Concurrent allocate: gen key may already exist — re-read.
  const again = await readGeneration(input.report_id, input.generation_id);
  if (again.ok && again.value) {
    return {
      ok: true,
      generation_id: again.value.generation_id,
      batch3_generation_epoch: again.value.generation_epoch,
    };
  }

  return {
    ok: false,
    code: "generation_allocate_failed",
    detail: allocated.detail ?? allocated.code,
  };
}

/**
 * Idempotently bind DI2 Job → Batch2 report_id/generation_id.
 * Uses Batch3 allocateGeneration for real generation identity; persists on
 * PojuXhighJob via execution-fence CAS. Never starts Batch2.
 */
export async function ensureDi2Batch2IdentityBinding(input: {
  job_id: string;
}): Promise<Di2Batch2IdentityResult> {
  const job_id = input.job_id.trim();
  if (!job_id) {
    return { ok: false, code: "missing_job", detail: "job_id empty" };
  }

  const job = await getXhighJob(job_id);
  if (!job) {
    return { ok: false, code: "missing_job", detail: `job_id=${job_id}` };
  }

  if (job.phase !== "decision_report") {
    return {
      ok: false,
      code: "wrong_phase",
      detail: `expected decision_report, got ${job.phase}`,
    };
  }

  const reportInput = decisionReportInput(job);
  if (!reportInput) {
    return {
      ok: false,
      code: "wrong_phase",
      detail: "job.input is not DecisionReportJobInput",
    };
  }

  const report_job_id = reportInput.report_job_id?.trim() ?? "";
  if (!report_job_id) {
    return {
      ok: false,
      code: "missing_report_job_id",
      detail: "DecisionReportJobInput.report_job_id required",
    };
  }

  if (typeof job.execution_generation !== "number") {
    return {
      ok: false,
      code: "missing_execution_generation",
      detail: "job.execution_generation required",
    };
  }
  if (
    !Number.isFinite(job.execution_generation) ||
    !Number.isInteger(job.execution_generation) ||
    job.execution_generation < 1
  ) {
    return {
      ok: false,
      code: "invalid_execution_generation",
      detail: `execution_generation=${String(job.execution_generation)}`,
    };
  }

  // Already bound → idempotent return or Fail Closed on conflict.
  if (job.batch2_identity_binding != null) {
    return evaluateExistingDi2Batch2Binding(job);
  }

  const generation_id = di2Batch2GenerationId(report_job_id);
  const allocated = await resolveAllocatedGeneration({
    report_id: report_job_id,
    locale: job.locale || reportInput.locale || "en",
    generation_id,
  });
  if (!allocated.ok) return allocated;

  const binding: Di2Batch2IdentityBinding = {
    report_id: report_job_id,
    generation_id: allocated.generation_id,
    di2_execution_generation: job.execution_generation,
    status: "bound",
    created_at: new Date().toISOString(),
    batch3_generation_epoch: allocated.batch3_generation_epoch,
  };

  // NX claim — job fence CAS alone only gates execution_generation, so concurrent
  // unbound writers could otherwise overwrite each other's binding payload.
  const claimKey = batch2IdentityClaimKey(job_id);
  const claimed = await kv.set(claimKey, binding, {
    nx: true,
    ex: KV_TTL.POJU_XHIGH_JOB,
  });

  if (claimed !== "OK") {
    const winner = await kv.get<Di2Batch2IdentityBinding>(claimKey);
    if (isBoundBinding(winner)) {
      if (
        winner.generation_id !== binding.generation_id ||
        winner.report_id !== report_job_id ||
        winner.di2_execution_generation !== job.execution_generation
      ) {
        return {
          ok: false,
          code: "dual_generation_conflict",
          detail:
            `claim holds generation_id=${winner.generation_id} ` +
            `expected=${binding.generation_id}`,
        };
      }
      // Mirror winner onto job if still unbound (winner may have claimed first).
      const mirrored = await persistBindingOnJob({
        job_id,
        execution_generation: job.execution_generation,
        binding: winner,
      });
      if (!mirrored.ok) return mirrored;
      return {
        ok: true,
        binding: mirrored.binding,
        created: false,
        job: mirrored.job,
      };
    }

    const after = await getXhighJob(job_id);
    if (after?.batch2_identity_binding) {
      const evaluated = evaluateExistingDi2Batch2Binding(after);
      if (evaluated.ok) return { ...evaluated, created: false };
      return evaluated;
    }
    return {
      ok: false,
      code: "cas_conflict_unresolved",
      detail: "identity claim lost and no durable binding readable",
    };
  }

  const persisted = await persistBindingOnJob({
    job_id,
    execution_generation: job.execution_generation,
    binding,
  });
  if (!persisted.ok) return persisted;

  return {
    ok: true,
    binding: persisted.binding,
    created: persisted.binding.created_at === binding.created_at,
    job: persisted.job,
  };
}

async function persistBindingOnJob(input: {
  job_id: string;
  execution_generation: number;
  binding: Di2Batch2IdentityBinding;
}): Promise<Di2Batch2IdentityResult> {
  const { job_id, execution_generation, binding } = input;

  const committed = await commitXhighJobUnderExecutionFence(
    job_id,
    execution_generation,
    (current) => {
      if (current.batch2_identity_binding != null) {
        return current;
      }
      return {
        ...current,
        batch2_identity_binding: binding,
      };
    },
  );

  if (!committed.ok) {
    if (committed.reason === "cas_unavailable") {
      return {
        ok: false,
        code: "cas_unavailable",
        detail: "execution-fence CAS unavailable",
      };
    }
    if (committed.reason === "revoked" || committed.reason === "missing") {
      return {
        ok: false,
        code: "job_revoked",
        detail: `fence commit ${committed.reason}`,
      };
    }

    const after = await getXhighJob(job_id);
    if (!after) {
      return {
        ok: false,
        code: "cas_conflict_unresolved",
        detail: "CAS conflict and job missing on re-read",
      };
    }
    if (after.batch2_identity_binding != null) {
      const evaluated = evaluateExistingDi2Batch2Binding(after);
      if (evaluated.ok) return { ...evaluated, created: false };
      return evaluated;
    }
    return {
      ok: false,
      code: "cas_conflict_unresolved",
      detail: "CAS conflict and job still unbound after re-read",
    };
  }

  // Always re-read durable job — fence CAS does not content-lock the whole record.
  const durable = await getXhighJob(job_id);
  if (!durable) {
    return {
      ok: false,
      code: "cas_conflict_unresolved",
      detail: "job missing after binding commit",
    };
  }
  if (durable.batch2_identity_binding == null) {
    // Commit path kept prior empty; stamp from claim authority.
    const forced = await commitXhighJobUnderExecutionFence(
      job_id,
      execution_generation,
      (current) => {
        if (current.batch2_identity_binding != null) return current;
        return { ...current, batch2_identity_binding: binding };
      },
    );
    if (!forced.ok) {
      return {
        ok: false,
        code: "cas_conflict_unresolved",
        detail: "binding claim won but job stamp failed",
      };
    }
    const again = await getXhighJob(job_id);
    if (!again?.batch2_identity_binding) {
      return {
        ok: false,
        code: "cas_conflict_unresolved",
        detail: "binding still absent after stamp retry",
      };
    }
    return evaluateExistingDi2Batch2Binding(again);
  }

  return evaluateExistingDi2Batch2Binding(durable);
}
