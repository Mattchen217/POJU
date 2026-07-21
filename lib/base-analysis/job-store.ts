import { kv, KV_TTL } from "@/lib/kv/client";
import {
  type BaseAnalysisJob,
  type BaseAnalysisJobStatus,
  generateJobId,
  jobKey,
  profileLatestKey,
  profileLockKey,
} from "@/lib/base-analysis/job-types";
import type { BaseAnalysisProgressStage } from "@/lib/base-analysis/progress-stages";

export async function createJob(input: {
  profile_id: string;
  locale: string;
  local_data: BaseAnalysisJob["local_data"];
  kind?: BaseAnalysisJob["kind"];
}): Promise<BaseAnalysisJob> {
  const job: BaseAnalysisJob = {
    job_id: generateJobId(input.profile_id),
    profile_id: input.profile_id,
    locale: input.locale,
    kind: input.kind ?? "base_analysis",
    status: "pending",
    accumulated_content: "",
    local_data: input.local_data,
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  await kv.set(jobKey(job.job_id), job, { ex: KV_TTL.BASE_ANALYSIS_JOB });
  await kv.set(profileLatestKey(input.profile_id), job.job_id, {
    ex: KV_TTL.BASE_ANALYSIS_JOB,
  });

  return job;
}

export async function getJob(job_id: string): Promise<BaseAnalysisJob | null> {
  const data = await kv.get<BaseAnalysisJob>(jobKey(job_id));
  return data ?? null;
}

export async function findLatestJobForProfile(profile_id: string): Promise<BaseAnalysisJob | null> {
  const job_id = await kv.get<string>(profileLatestKey(profile_id));
  if (!job_id) return null;
  return getJob(job_id);
}

export async function updateJobStatus(
  job_id: string,
  status: BaseAnalysisJobStatus,
  patch: Partial<BaseAnalysisJob> = {},
): Promise<void> {
  const job = await getJob(job_id);
  if (!job) return;

  const updated: BaseAnalysisJob = {
    ...job,
    ...patch,
    status,
    updated_at: Date.now(),
    ...(status === "completed" ? { completed_at: Date.now() } : {}),
  };

  await kv.set(jobKey(job_id), updated, { ex: KV_TTL.BASE_ANALYSIS_JOB });
}

/** Persist wait-UI progress for SSE clients that fall back to status poll. */
export async function setJobProgress(
  job_id: string,
  stage: BaseAnalysisProgressStage,
): Promise<void> {
  const job = await getJob(job_id);
  if (!job) return;
  job.progress_stage = stage;
  job.progress_updated_at = Date.now();
  job.updated_at = Date.now();
  await kv.set(jobKey(job_id), job, { ex: KV_TTL.BASE_ANALYSIS_JOB });
}

export async function appendChunk(job_id: string, chunk: string): Promise<void> {
  const job = await getJob(job_id);
  if (!job) return;

  job.accumulated_content += chunk;
  job.updated_at = Date.now();

  await kv.set(jobKey(job_id), job, { ex: KV_TTL.BASE_ANALYSIS_JOB });
}

export async function setJobContent(job_id: string, content: string): Promise<void> {
  const job = await getJob(job_id);
  if (!job) return;
  job.accumulated_content = content;
  job.updated_at = Date.now();
  await kv.set(jobKey(job_id), job, { ex: KV_TTL.BASE_ANALYSIS_JOB });
}

export async function finalizeJob(
  job_id: string,
  meta: BaseAnalysisJob["meta"] | Record<string, unknown>,
): Promise<void> {
  await updateJobStatus(job_id, "completed", {
    meta: meta as BaseAnalysisJob["meta"],
  });
}

export async function failJob(job_id: string, error: string, detail?: string): Promise<void> {
  await updateJobStatus(job_id, "failed", {
    error,
    error_detail: detail,
  });
}

/** Prevent concurrent jobs for the same profile. */
export async function acquireLock(profile_id: string): Promise<boolean> {
  const result = await kv.set(profileLockKey(profile_id), Date.now(), {
    ex: KV_TTL.BASE_ANALYSIS_LOCK,
    nx: true,
  });
  return result === "OK";
}

/** Extend lock TTL while a phased client still owns the profile. */
export async function renewLockIfHeld(profile_id: string): Promise<boolean> {
  const key = profileLockKey(profile_id);
  const existing = await kv.get(key);
  if (existing == null) return false;
  await kv.set(key, Date.now(), { ex: KV_TTL.BASE_ANALYSIS_LOCK });
  return true;
}

export async function releaseLock(profile_id: string): Promise<void> {
  await kv.del(profileLockKey(profile_id));
}
