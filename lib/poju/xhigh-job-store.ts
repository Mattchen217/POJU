import { AsyncLocalStorage } from "node:async_hooks";

import { kv, KV_TTL } from "@/lib/kv/client";
import { MemoryKv } from "@/lib/kv/memory-kv";
import {
  generateXhighJobId,
  type PojuXhighJob,
  type PojuXhighJobPhase,
  type PojuXhighJobStatus,
  xhighJobKey,
  xhighSessionLatestKey,
  xhighSessionLockKey,
} from "@/lib/poju/xhigh-job-types";

type XhighKv = {
  get<T = unknown>(key: string): Promise<T | null>;
  set(
    key: string,
    value: unknown,
    opts?: { ex?: number; nx?: boolean },
  ): Promise<"OK" | null>;
  del(...keys: string[]): Promise<number>;
};

const ephemeralKv = new AsyncLocalStorage<XhighKv>();

function activeKv(): XhighKv {
  return ephemeralKv.getStore() ?? (kv as unknown as XhighKv);
}

/**
 * One request-scoped memory KV. Upstash plan-limit fallback runs the job here
 * and returns it on the same response; do not poll this from another isolate.
 */
export function runWithEphemeralXhighKv<T>(fn: () => Promise<T>): Promise<T> {
  return ephemeralKv.run(new MemoryKv(), fn);
}

export async function createXhighJob(input: {
  phase: PojuXhighJobPhase;
  session_id: string;
  locale: string;
  job_input: PojuXhighJob["input"];
  /** Phase-4: stamp deploy generation so redeploy can kill orphaned continues. */
  deploy_generation?: string;
}): Promise<PojuXhighJob> {
  const job: PojuXhighJob = {
    job_id: generateXhighJobId(input.phase, input.session_id),
    phase: input.phase,
    session_id: input.session_id,
    locale: input.locale,
    status: "pending",
    accumulated_content: "",
    input: input.job_input,
    ...(input.deploy_generation?.trim()
      ? { deploy_generation: input.deploy_generation.trim() }
      : {}),
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  await activeKv().set(xhighJobKey(job.job_id), job, { ex: KV_TTL.POJU_XHIGH_JOB });
  await activeKv().set(xhighSessionLatestKey(input.phase, input.session_id), job.job_id, {
    ex: KV_TTL.POJU_XHIGH_JOB,
  });
  return job;
}

export async function getXhighJob(job_id: string): Promise<PojuXhighJob | null> {
  const data = await activeKv().get<PojuXhighJob>(xhighJobKey(job_id));
  return data ?? null;
}

export async function findLatestXhighJobForSession(
  phase: PojuXhighJobPhase,
  session_id: string,
): Promise<PojuXhighJob | null> {
  const job_id = await activeKv().get<string>(xhighSessionLatestKey(phase, session_id));
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

  await activeKv().set(xhighJobKey(job_id), updated, { ex: KV_TTL.POJU_XHIGH_JOB });
}

export async function appendXhighJobChunk(job_id: string, chunk: string): Promise<void> {
  const job = await getXhighJob(job_id);
  if (!job) return;
  job.accumulated_content += chunk;
  job.updated_at = Date.now();
  if (job.status === "pending") job.status = "running";
  await activeKv().set(xhighJobKey(job_id), job, { ex: KV_TTL.POJU_XHIGH_JOB });
}

export async function setXhighJobContent(job_id: string, content: string): Promise<void> {
  const job = await getXhighJob(job_id);
  if (!job) return;
  if (job.status === "failed" || job.status === "completed") return;
  job.accumulated_content = content;
  job.updated_at = Date.now();
  await activeKv().set(xhighJobKey(job_id), job, { ex: KV_TTL.POJU_XHIGH_JOB });
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
  const result = await activeKv().set(xhighSessionLockKey(phase, session_id), Date.now(), {
    ex: KV_TTL.POJU_XHIGH_LOCK,
    nx: true,
  });
  return result === "OK";
}

export async function releaseXhighSessionLock(
  phase: PojuXhighJobPhase,
  session_id: string,
): Promise<void> {
  await activeKv().del(xhighSessionLockKey(phase, session_id));
}
