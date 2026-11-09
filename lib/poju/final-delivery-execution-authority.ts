/**
 * M2.2-R4 — Final Delivery execution authority (cancel / supersede takeover).
 *
 * Regenerate must not rely solely on failXhighJob() flipping DB status.
 * In-flight workers re-check authority before advancing stages, committing
 * checkpoints/results, write-back, and formal completion. A superseded job
 * must not advance or overwrite a newer job's outcomes.
 */
import {
  failXhighJob,
  getXhighJob,
  releaseXhighSessionLock,
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

  constructor(input: {
    job_id: string;
    status?: string | null;
    failure_reason?: string | null;
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
 * Reload job and throw if this worker no longer holds execution authority.
 * Call before continuing stages, committing stage results, write-back, and complete.
 */
export async function assertDeliveryExecutionAuthority(
  job_id: string,
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
    });
  }
  return job;
}

/**
 * Production Regenerate takeover: mark prior job superseded and strip leases/locks.
 * Does NOT touch M2.2 claim tokens (caller releases with owner token CAS).
 */
export async function supersedeFinalDeliveryJobForRegenerate(
  job_id: string,
): Promise<void> {
  const job = await getXhighJob(job_id);
  if (!job) return;
  if (job.status === "completed" || job.status === "failed") {
    // Already terminal — still ensure leases are clear for takeover.
  } else {
    await failXhighJob(job_id, "STOP: superseded by regenerate", {
      retryable: false,
      failure_reason: SUPERSEDED_BY_REGENERATE,
      current_stage: job.current_stage,
      accumulated_content: "failed:superseded_by_regenerate",
    }).catch(() => undefined);
  }
  try {
    const { forceReleaseDeliveryContinueLease } = await import(
      "@/lib/llm/pro/delivery/delivery-stage-store"
    );
    await forceReleaseDeliveryContinueLease(job_id).catch(() => undefined);
  } catch {
    /* ignore */
  }
  if (isFinalDeliveryJobInput(job.input)) {
    await releaseXhighSessionLock("final_delivery", job.input.session_id).catch(
      () => undefined,
    );
  } else {
    await releaseXhighSessionLock("final_delivery", job.session_id).catch(
      () => undefined,
    );
  }
}

/**
 * Gate checkpoint / stage commits: refuse when authority is gone.
 * Returns false when revoked (caller must stop without overwriting).
 */
export async function tryCommitUnderDeliveryAuthority(
  job_id: string,
): Promise<boolean> {
  try {
    await assertDeliveryExecutionAuthority(job_id);
    return true;
  } catch (e) {
    if (e instanceof DeliveryExecutionRevokedError) return false;
    throw e;
  }
}
