import { kv, KV_TTL } from "@/lib/kv/client";
import {
  generateXhighJobId,
  type PojuXhighJob,
  type PojuXhighJobPhase,
  type PojuXhighJobStatus,
  xhighJobKey,
  xhighSessionLatestKey,
  xhighSessionLockKey,
} from "@/lib/poju/xhigh-job-types";

export async function createXhighJob(input: {
  phase: PojuXhighJobPhase;
  session_id: string;
  locale: string;
  job_input: PojuXhighJob["input"];
}): Promise<PojuXhighJob> {
  const job: PojuXhighJob = {
    job_id: generateXhighJobId(input.phase, input.session_id),
    phase: input.phase,
    session_id: input.session_id,
    locale: input.locale,
    status: "pending",
    accumulated_content: "",
    input: input.job_input,
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  await kv.set(xhighJobKey(job.job_id), job, { ex: KV_TTL.POJU_XHIGH_JOB });
  await kv.set(xhighSessionLatestKey(input.phase, input.session_id), job.job_id, {
    ex: KV_TTL.POJU_XHIGH_JOB,
  });
  return job;
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

  const updated: PojuXhighJob = {
    ...job,
    ...patch,
    status,
    updated_at: Date.now(),
    ...(status === "completed" ? { completed_at: Date.now() } : {}),
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
  job.accumulated_content = content;
  job.updated_at = Date.now();
  await kv.set(xhighJobKey(job_id), job, { ex: KV_TTL.POJU_XHIGH_JOB });
}

export async function completeXhighJob(
  job_id: string,
  patch: Pick<
    PojuXhighJob,
    "result" | "llm_debug" | "model" | "tokens_used" | "accumulated_content"
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
