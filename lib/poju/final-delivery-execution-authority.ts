/**
 * M2.2-R5 — Final Delivery execution fencing (generation token).
 *
 * Regenerate atomically bumps a session-scoped fence generation, persists the
 * prior job as superseded, and only then may a replacement job be authorized.
 * Stage commits / checkpoints / continue / write-back / formal completion must
 * CAS-validate the same generation at the write boundary — read-check then
 * independent write is not an acceptable fence.
 */
import {
  authorizeFdExecutionFence,
  bumpFdExecutionFence,
  commitXhighJobUnderExecutionFence,
  getFdExecutionFence,
  getXhighJob,
  persistSupersededFinalDeliveryJob,
  releaseXhighSessionLock,
  type CommitUnderFenceResult,
} from "@/lib/poju/xhigh-job-store";
import {
  isFinalDeliveryJobInput,
  type PojuXhighJob,
  type PojuXhighJobFailureReason,
} from "@/lib/poju/xhigh-job-types";

export const SUPERSEDED_BY_REGENERATE: PojuXhighJobFailureReason =
  "superseded_by_regenerate";

export class DeliveryExecutionRevokedError extends Error {
  readonly code = "DELIVERY_EXECUTION_REVOKED";
  readonly job_id: string;
  readonly status: string | null;
  readonly failure_reason: string | null;
  readonly expected_generation: number | null;

  constructor(input: {
    job_id: string;
    status?: string | null;
    failure_reason?: string | null;
    expected_generation?: number | null;
    message?: string;
  }) {
    super(
      input.message ??
        `delivery execution revoked for ${input.job_id}` +
          (input.failure_reason ? ` (${input.failure_reason})` : ""),
    );
    this.name = "DeliveryExecutionRevokedError";
    this.job_id = input.job_id;
    this.status = input.status ?? null;
    this.failure_reason = input.failure_reason ?? null;
    this.expected_generation = input.expected_generation ?? null;
  }
}

export class SupersedePersistenceError extends Error {
  readonly code = "SUPERSEDE_PERSISTENCE_FAILED";
  readonly job_id: string;
  constructor(job_id: string, cause?: unknown) {
    super(
      `Failed to persist superseded state for ${job_id}` +
        (cause instanceof Error ? `: ${cause.message}` : cause ? `: ${String(cause)}` : ""),
    );
    this.name = "SupersedePersistenceError";
    this.job_id = job_id;
  }
}

/** Terminal or explicitly superseded — worker must stop and must not commit. */
export function isDeliveryExecutionRevoked(job: PojuXhighJob): boolean {
  if (job.status === "completed") return true;
  if (job.status === "failed") return true;
  const reason = job.failure_reason;
  if (
    reason === "superseded_by_regenerate" ||
    reason === "superseded_by_deploy" ||
    reason === "user_cancelled"
  ) {
    return true;
  }
  const acc = String(job.accumulated_content ?? "");
  if (
    acc.includes("superseded_by_regenerate") ||
    acc.includes("superseded_by_deploy") ||
    acc.includes("user_cancelled")
  ) {
    return true;
  }
  return false;
}

/**
 * Soft authority probe (read). Prefer commitUnderDeliveryExecutionFence for writes.
 */
export async function assertDeliveryExecutionAuthority(
  job_id: string,
  expected_generation?: number,
): Promise<PojuXhighJob> {
  const job = await getXhighJob(job_id);
  if (!job) {
    throw new DeliveryExecutionRevokedError({
      job_id,
      status: null,
      message: `delivery job missing: ${job_id}`,
    });
  }
  if (isDeliveryExecutionRevoked(job)) {
    throw new DeliveryExecutionRevokedError({
      job_id,
      status: job.status,
      failure_reason: job.failure_reason ?? null,
      expected_generation: expected_generation ?? job.execution_generation ?? null,
    });
  }
  const gen =
    typeof expected_generation === "number"
      ? expected_generation
      : job.execution_generation;
  if (typeof gen === "number") {
    const fence = await getFdExecutionFence(job.session_id);
    if (
      !fence ||
      fence.generation !== gen ||
      fence.authorized_job_id !== job_id ||
      job.execution_generation !== gen
    ) {
      throw new DeliveryExecutionRevokedError({
        job_id,
        status: job.status,
        failure_reason: "superseded_by_regenerate",
        expected_generation: gen,
        message: `delivery fence generation mismatch for ${job_id}`,
      });
    }
  }
  return job;
}

/**
 * Commit a job mutation at the fencing boundary (CAS on generation).
 * Returns false when revoked / CAS conflict — caller must stop without overwrite.
 */
export async function commitUnderDeliveryExecutionFence(
  job_id: string,
  expected_generation: number,
  mutate: (job: PojuXhighJob) => PojuXhighJob,
): Promise<CommitUnderFenceResult> {
  return commitXhighJobUnderExecutionFence(job_id, expected_generation, mutate);
}

/**
 * Gate checkpoint / stage commits: refuse when fence generation is gone.
 * Returns false when revoked (caller must stop without overwriting).
 */
export async function tryCommitUnderDeliveryAuthority(
  job_id: string,
  expected_generation?: number,
): Promise<boolean> {
  try {
    await assertDeliveryExecutionAuthority(job_id, expected_generation);
    return true;
  } catch (e) {
    if (e instanceof DeliveryExecutionRevokedError) return false;
    throw e;
  }
}

/** @internal test hook — force supersede persistence to fail closed. */
let __testFailSupersedePersist = false;
export function __setSupersedePersistFailForTests(v: boolean): void {
  __testFailSupersedePersist = v;
}

export type SupersedeFinalDeliveryResult = {
  revoked_job_id: string | null;
  /** New session fence generation after atomic revoke (authorized_job_id cleared). */
  new_generation: number;
  prior_generation: number | null;
};

/**
 * Production Regenerate takeover:
 * 1) Atomically bump session fence generation (revokes prior generation).
 * 2) Persist old job as superseded — failures PROPAGATE (no swallow).
 * 3) Strip leases/locks for takeover.
 *
 * Does NOT touch M2.2 claim tokens (caller releases with owner token CAS).
 * Does NOT create a replacement job — caller must authorize the new job
 * with authorizeFinalDeliveryExecution after create.
 *
 * If atomic revocation cannot be confirmed, throws — caller must fail closed
 * and must NOT start a replacement generator.
 */
export async function supersedeFinalDeliveryJobForRegenerate(
  job_id: string,
): Promise<SupersedeFinalDeliveryResult> {
  const job = await getXhighJob(job_id);
  if (!job) {
    throw new SupersedePersistenceError(job_id, "job missing at supersede");
  }

  const session_id = isFinalDeliveryJobInput(job.input)
    ? job.input.session_id
    : job.session_id;

  const prior_generation =
    typeof job.execution_generation === "number" ? job.execution_generation : null;

  // Idempotent: already superseded — do not bump fence again.
  if (job.failure_reason === SUPERSEDED_BY_REGENERATE) {
    const cur = await getFdExecutionFence(session_id);
    if (!cur) {
      throw new SupersedePersistenceError(
        job_id,
        "already superseded but session fence missing",
      );
    }
    return {
      revoked_job_id: job_id,
      new_generation: cur.generation,
      prior_generation,
    };
  }

  // 1) Atomic fence bump — prior generation is revoked immediately.
  let fence;
  try {
    fence = await bumpFdExecutionFence(session_id);
  } catch (e) {
    throw new SupersedePersistenceError(job_id, e);
  }

  // 2) Persist superseded — MUST succeed; never swallow.
  if (__testFailSupersedePersist) {
    throw new SupersedePersistenceError(
      job_id,
      "injected supersede persistence failure",
    );
  }
  try {
    await persistSupersededFinalDeliveryJob(job_id, {
      error: "STOP: superseded by regenerate",
      failure_reason: SUPERSEDED_BY_REGENERATE,
      current_stage: job.current_stage,
      accumulated_content: "failed:superseded_by_regenerate",
    });
  } catch (e) {
    throw new SupersedePersistenceError(job_id, e);
  }

  // Confirm persisted authority is revoked.
  const after = await getXhighJob(job_id);
  if (
    !after ||
    after.failure_reason !== SUPERSEDED_BY_REGENERATE ||
    (after.status !== "failed" && after.status !== "completed")
  ) {
    // completed+superseded stamp is rare; require failed or stamped reason.
    if (!after || after.failure_reason !== SUPERSEDED_BY_REGENERATE) {
      throw new SupersedePersistenceError(
        job_id,
        "superseded state not confirmed after persist",
      );
    }
  }

  // 3) Best-effort lease/lock strip AFTER confirmed revocation.
  try {
    const { forceReleaseDeliveryContinueLease } = await import(
      "@/lib/llm/pro/delivery/delivery-stage-store"
    );
    await forceReleaseDeliveryContinueLease(job_id);
  } catch {
    /* lease module optional in some test isolates */
  }
  await releaseXhighSessionLock("final_delivery", session_id).catch(() => undefined);

  return {
    revoked_job_id: job_id,
    new_generation: fence.generation,
    prior_generation,
  };
}

/**
 * After createXhighJob with stamped execution_generation, bind the fence to
 * that job_id. Fail closed if generation was raced away.
 */
export async function authorizeFinalDeliveryExecution(
  session_id: string,
  generation: number,
  job_id: string,
): Promise<void> {
  await authorizeFdExecutionFence(session_id, generation, job_id);
}

/**
 * Ensure a session fence exists for first-time delivery create (no prior job).
 * Returns the generation to stamp on the new job (bumps if none / unowned).
 */
export async function allocateFinalDeliveryExecutionGeneration(
  session_id: string,
): Promise<number> {
  const cur = await getFdExecutionFence(session_id);
  if (!cur) {
    const bumped = await bumpFdExecutionFence(session_id);
    return bumped.generation;
  }
  // If a generation is authorized to a live job, caller should supersede first.
  // For idle fence (authorized_job_id null), reuse current generation.
  if (!cur.authorized_job_id) return cur.generation;
  const bumped = await bumpFdExecutionFence(session_id);
  return bumped.generation;
}
