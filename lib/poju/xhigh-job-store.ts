import { kv, KV_TTL, runWithEphemeralKv } from "@/lib/kv/client";
import {
  generateXhighJobId,
  type PojuXhighJob,
  type PojuXhighJobPhase,
  type PojuXhighJobStatus,
  xhighClientTaskKey,
  xhighJobKey,
  xhighSessionLatestKey,
  xhighSessionLockKey,
} from "@/lib/poju/xhigh-job-types";

export { xhighClientTaskKey };

/**
 * One request-scoped memory KV (shared with delivery checkpoints via `kv`).
 * The caller must return the terminal job on this response — another isolate cannot see it.
 */
export function runWithEphemeralXhighKv<T>(
  fn: () => Promise<T>,
  opts?: { deadlineMs?: number },
): Promise<T> {
  return runWithEphemeralKv(fn, opts);
}

export async function createXhighJob(input: {
  phase: PojuXhighJobPhase;
  session_id: string;
  locale: string;
  job_input: PojuXhighJob["input"];
  /** Phase-4: stamp deploy generation so redeploy can kill orphaned continues. */
  deploy_generation?: string;
  /**
   * Phase 3 S2 — stable client create identity (Contract §22 / Mapping §2.4).
   * When set, create is idempotent: same identity returns the existing job (no blind retry).
   */
  client_task_id?: string;
  generation_type?: PojuXhighJob["generation_type"];
  fingerprint?: string;
  fingerprint_version?: string;
}): Promise<PojuXhighJob> {
  const client_task_id =
    typeof input.client_task_id === "string" && input.client_task_id.trim()
      ? input.client_task_id.trim()
      : undefined;

  // Check existing identity BEFORE generateXhighJobId — never second job for same identity.
  if (client_task_id) {
    const existing = await getXhighJobByClientTaskId({
      phase: input.phase,
      session_id: input.session_id,
      client_task_id,
    });
    if (existing.status === "found") {
      return existing.job;
    }
    if (existing.status === "recovery_required") {
      throw new Error(
        "XHIGH_JOB_RECOVERY_REQUIRED: ambiguous client_task_id=" +
          client_task_id +
          " phase=" +
          input.phase,
      );
    }
  }

  const job: PojuXhighJob = {
    job_id: generateXhighJobId(input.phase, input.session_id),
    phase: input.phase,
    session_id: input.session_id,
    locale: input.locale,
    status: "pending",
    accumulated_content: "",
    input: input.job_input,
    ...(client_task_id ? { client_task_id } : {}),
    ...(input.generation_type ? { generation_type: input.generation_type } : {}),
    ...(input.fingerprint ? { fingerprint: input.fingerprint } : {}),
    ...(input.fingerprint_version ? { fingerprint_version: input.fingerprint_version } : {}),
    ...(input.deploy_generation?.trim()
      ? { deploy_generation: input.deploy_generation.trim() }
      : {}),
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  // Job record is authority — persist identity inside job BEFORE ack.
  await kv.set(xhighJobKey(job.job_id), job, { ex: KV_TTL.POJU_XHIGH_JOB });
  await kv.set(xhighSessionLatestKey(input.phase, input.session_id), job.job_id, {
    ex: KV_TTL.POJU_XHIGH_JOB,
  });
  if (client_task_id) {
    // Rebuildable index (non-authoritative).
    await kv.set(
      xhighClientTaskKey(input.phase, input.session_id, client_task_id),
      job.job_id,
      { ex: KV_TTL.POJU_XHIGH_JOB },
    );
  }
  return job;
}

export type GetXhighJobByClientTaskResult =
  | { status: "found"; job: PojuXhighJob }
  | { status: "missing" }
  | { status: "recovery_required"; reason: string };

/**
 * Reverse lookup by client_task_id (S0 ABSENT → S2).
 * Index is rebuildable; job record is authority. Ambiguity → recovery_required (no blind create).
 */
export async function getXhighJobByClientTaskId(input: {
  phase: PojuXhighJobPhase;
  session_id: string;
  client_task_id: string;
  /** Optional candidate job_id from Reload / latest — verified against identity. */
  candidate_job_id?: string | null;
}): Promise<GetXhighJobByClientTaskResult> {
  const client_task_id = input.client_task_id.trim();
  if (!client_task_id) {
    return { status: "recovery_required", reason: "empty client_task_id" };
  }

  const indexKey = xhighClientTaskKey(input.phase, input.session_id, client_task_id);
  const indexedId = await kv.get<string>(indexKey);

  const candidates = new Set<string>();
  if (typeof indexedId === "string" && indexedId.trim()) candidates.add(indexedId.trim());
  if (input.candidate_job_id && input.candidate_job_id.trim()) {
    candidates.add(input.candidate_job_id.trim());
  }

  const matches: PojuXhighJob[] = [];
  for (const job_id of candidates) {
    const job = await getXhighJob(job_id);
    if (!job) continue;
    if (job.phase !== input.phase) continue;
    if (job.session_id !== input.session_id) continue;
    if (job.client_task_id !== client_task_id) continue;
    matches.push(job);
  }

  if (matches.length > 1) {
    const ids = Array.from(new Set(matches.map((m) => m.job_id)));
    if (ids.length > 1) {
      return {
        status: "recovery_required",
        reason:
          "multiple jobs for client_task_id=" + client_task_id + ": " + ids.join(","),
      };
    }
  }

  if (matches.length === 1) {
    const job = matches[0]!;
    // Repair index when possible.
    if (indexedId !== job.job_id) {
      await kv.set(indexKey, job.job_id, { ex: KV_TTL.POJU_XHIGH_JOB });
    }
    return { status: "found", job };
  }

  // Index miss + no verified candidate → missing (caller may create once).
  // Do NOT consult latest-only as authority (S0: latest is not create-identity).
  return { status: "missing" };
}

export async function getXhighJob(job_id: string): Promise<PojuXhighJob | null> {
  const data = await kv.get<PojuXhighJob>(xhighJobKey(job_id));
  return data ?? null;
}

export async function findLatestXhighJobForSession(
  phase: PojuXhighJobPhase,
  session_id: string,
): Promise<PojuXhighJob | null> {
  const job_id = await kv.get<string>(xhighSessionLatestKey(phase, session_id));
  if (!job_id) return null;
  return getXhighJob(job_id);
}

export async function updateXhighJobStatus(
  job_id: string,
  status: PojuXhighJobStatus,
  patch: Partial<PojuXhighJob> = {},
): Promise<void> {
  const job = await getXhighJob(job_id);
  if (!job) return;

  // Terminal states are sticky — never revive a failed/completed job (stale race),
  // except interrupted deliveries which user Continue re-arms explicitly.
  const allowInterruptedRevive =
    job.status === "failed" &&
    status === "running" &&
    (job.failure_reason === "interrupted" || job.retryable === true);
  if (
    (job.status === "completed" || job.status === "failed") &&
    status !== job.status &&
    !allowInterruptedRevive
  ) {
    console.warn("[xhigh-job] ignore status transition from terminal", {
      job_id,
      from: job.status,
      to: status,
    });
    return;
  }

  const updated: PojuXhighJob = {
    ...job,
    ...patch,
    status,
    updated_at: Date.now(),
    ...(status === "completed" ? { completed_at: Date.now() } : {}),
    ...(allowInterruptedRevive
      ? {
          error: undefined,
          error_detail: undefined,
          failure_reason: undefined,
          retryable: undefined,
          completed_at: undefined,
        }
      : {}),
  };

  await kv.set(xhighJobKey(job_id), updated, { ex: KV_TTL.POJU_XHIGH_JOB });
}

export async function appendXhighJobChunk(job_id: string, chunk: string): Promise<void> {
  const job = await getXhighJob(job_id);
  if (!job) return;
  job.accumulated_content += chunk;
  job.updated_at = Date.now();
  if (job.status === "pending") job.status = "running";
  await kv.set(xhighJobKey(job_id), job, { ex: KV_TTL.POJU_XHIGH_JOB });
}

export async function setXhighJobContent(job_id: string, content: string): Promise<void> {
  const job = await getXhighJob(job_id);
  if (!job) return;
  if (job.status === "failed" || job.status === "completed") return;
  job.accumulated_content = content;
  job.updated_at = Date.now();
  await kv.set(xhighJobKey(job_id), job, { ex: KV_TTL.POJU_XHIGH_JOB });
}

export async function completeXhighJob(
  job_id: string,
  patch: Pick<
    PojuXhighJob,
    | "result"
    | "llm_debug"
    | "model"
    | "tokens_used"
    | "accumulated_content"
    | "lab_call_traces"
  >,
): Promise<void> {
  await updateXhighJobStatus(job_id, "completed", patch);
}

export async function failXhighJob(
  job_id: string,
  error: string,
  patch: Partial<
    Pick<
      PojuXhighJob,
      "error_detail" | "retryable" | "failure_reason" | "accumulated_content" | "current_stage"
    >
  > = {},
): Promise<void> {
  await updateXhighJobStatus(job_id, "failed", { error, ...patch });
}

export async function acquireXhighSessionLock(
  phase: PojuXhighJobPhase,
  session_id: string,
): Promise<boolean> {
  const result = await kv.set(xhighSessionLockKey(phase, session_id), Date.now(), {
    ex: KV_TTL.POJU_XHIGH_LOCK,
    nx: true,
  });
  return result === "OK";
}

export async function releaseXhighSessionLock(
  phase: PojuXhighJobPhase,
  session_id: string,
): Promise<void> {
  await kv.del(xhighSessionLockKey(phase, session_id));
}
