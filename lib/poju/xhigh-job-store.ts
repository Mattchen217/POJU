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

/**
 * Phase 3 J4 — business identity gate for shared Job Store recovery.
 *
 * Identity axes (shared storage ≠ shared business identity):
 * - phase (segment2_breakthrough_core | segment2_agenda_bridge | synthesis | final_delivery)
 * - session_id
 * - client_task_id (when present — Phase 3 Generation / ITEM 6)
 * - generation_type (when caller supplies it — POJU Call A/B only today)
 *
 * Lab / Synthesis / Final Delivery creates omit client_task_id + generation_type;
 * those fields remain optional so existing business semantics are unchanged.
 * When a Generation caller *does* supply generation_type, the job must carry the
 * same value — a Lab/legacy job missing generation_type must not match.
 */
export function jobMatchesIdentity(
  job: PojuXhighJob,
  input: {
    phase: PojuXhighJobPhase;
    session_id: string;
    client_task_id: string;
    generation_type?: PojuXhighJob["generation_type"];
  },
): boolean {
  if (job.phase !== input.phase) return false;
  if (job.session_id !== input.session_id) return false;
  if (job.client_task_id !== input.client_task_id) return false;
  if (input.generation_type) {
    // Strict: Generation recovery must not accept Lab/legacy jobs lacking type.
    if (job.generation_type !== input.generation_type) return false;
  }
  return true;
}

export type GetXhighJobByClientTaskResult =
  | { status: "found"; job: PojuXhighJob }
  | { status: "missing" }
  | { status: "recovery_required"; reason: string };

/**
 * Reverse lookup by stable create identity (session_id + phase/generation + client_task_id).
 * Job record is authority; index is rebuildable.
 * Distinguishes missing / found / recovery_required (never blind-create on ambiguity).
 */
export async function getXhighJobByClientTaskId(input: {
  phase: PojuXhighJobPhase;
  session_id: string;
  client_task_id: string;
  /** Optional candidate job_id from Reload / HTTP retry / pending bind. */
  candidate_job_id?: string | null;
  /**
   * When true (default on create/reload), treat session `latest` as a *candidate only*
   * and verify job.client_task_id before accepting (Mapping §2.4 / ITEM 6).
   */
  consult_latest_candidate?: boolean;
  generation_type?: PojuXhighJob["generation_type"];
}): Promise<GetXhighJobByClientTaskResult> {
  const client_task_id = input.client_task_id.trim();
  if (!client_task_id) {
    return { status: "recovery_required", reason: "empty client_task_id" };
  }

  const indexKey = xhighClientTaskKey(input.phase, input.session_id, client_task_id);
  const indexedId = await kv.get<string>(indexKey);

  const candidates = new Set<string>();
  if (typeof indexedId === "string" && indexedId.trim()) {
    candidates.add(indexedId.trim());
  }
  if (input.candidate_job_id && input.candidate_job_id.trim()) {
    candidates.add(input.candidate_job_id.trim());
  }
  if (input.consult_latest_candidate !== false) {
    const latestId = await kv.get<string>(
      xhighSessionLatestKey(input.phase, input.session_id),
    );
    if (typeof latestId === "string" && latestId.trim()) {
      candidates.add(latestId.trim());
    }
  }

  const matches: PojuXhighJob[] = [];
  let danglingIndex = false;
  for (const job_id of candidates) {
    const job = await getXhighJob(job_id);
    if (!job) {
      if (indexedId && indexedId.trim() === job_id) danglingIndex = true;
      continue;
    }
    if (
      !jobMatchesIdentity(job, {
        phase: input.phase,
        session_id: input.session_id,
        client_task_id,
        generation_type: input.generation_type,
      })
    ) {
      continue;
    }
    matches.push(job);
  }

  const uniqueIds = Array.from(new Set(matches.map((m) => m.job_id)));
  if (uniqueIds.length > 1) {
    return {
      status: "recovery_required",
      reason:
        "multiple jobs for client_task_id=" + client_task_id + ": " + uniqueIds.join(","),
    };
  }

  if (uniqueIds.length === 1) {
    const job = matches[0]!;
    // Repair rebuildable index when possible.
    if (indexedId !== job.job_id) {
      await kv.set(indexKey, job.job_id, { ex: KV_TTL.POJU_XHIGH_JOB });
    }
    return { status: "found", job };
  }

  // Index points at a missing/foreign job with no verified candidate → unclear; do not create.
  if (danglingIndex) {
    return {
      status: "recovery_required",
      reason:
        "client_task index dangling (job missing) for client_task_id=" + client_task_id,
    };
  }

  return { status: "missing" };
}

/**
 * Atomic unique create for stable identity session+phase(+generation_type)+client_task_id.
 * Uses SET NX on the rebuildable index as the create claim (works on Upstash and MemoryKv).
 * MUST NOT: query-miss → random job_id → unconditional write (race).
 */
export async function createXhighJob(input: {
  phase: PojuXhighJobPhase;
  session_id: string;
  locale: string;
  job_input: PojuXhighJob["input"];
  deploy_generation?: string;
  client_task_id?: string;
  generation_type?: PojuXhighJob["generation_type"];
  fingerprint?: string;
  fingerprint_version?: string;
  /**
   * Test-only: after job authority write succeeds, skip/fail index repair path.
   * Production omits. Used to prove Reload recovers via latest candidate (ITEM 6.2).
   */
  __test_delete_index_after_create?: boolean;
}): Promise<PojuXhighJob> {
  const client_task_id =
    typeof input.client_task_id === "string" && input.client_task_id.trim()
      ? input.client_task_id.trim()
      : undefined;

  if (client_task_id) {
    const existing = await getXhighJobByClientTaskId({
      phase: input.phase,
      session_id: input.session_id,
      client_task_id,
      generation_type: input.generation_type,
      consult_latest_candidate: true,
    });
    if (existing.status === "found") {
      return existing.job;
    }
    if (existing.status === "recovery_required") {
      throw new Error(
        "XHIGH_JOB_RECOVERY_REQUIRED: " +
          existing.reason +
          " phase=" +
          input.phase,
      );
    }

    const job_id = generateXhighJobId(input.phase, input.session_id);
    const indexKey = xhighClientTaskKey(input.phase, input.session_id, client_task_id);

    // Atomic claim of stable identity BEFORE writing a second authority record.
    const claimed = await kv.set(indexKey, job_id, {
      ex: KV_TTL.POJU_XHIGH_JOB,
      nx: true,
    });
    if (claimed !== "OK") {
      // Lost the race — return the winner (or surface ambiguity).
      const again = await getXhighJobByClientTaskId({
        phase: input.phase,
        session_id: input.session_id,
        client_task_id,
        generation_type: input.generation_type,
        consult_latest_candidate: true,
      });
      if (again.status === "found") return again.job;
      throw new Error(
        "XHIGH_JOB_RECOVERY_REQUIRED: lost create race for client_task_id=" +
          client_task_id +
          (again.status === "recovery_required" ? " (" + again.reason + ")" : ""),
      );
    }

    const job: PojuXhighJob = {
      job_id,
      phase: input.phase,
      session_id: input.session_id,
      locale: input.locale,
      status: "pending",
      accumulated_content: "",
      input: input.job_input,
      client_task_id,
      ...(input.generation_type ? { generation_type: input.generation_type } : {}),
      ...(input.fingerprint ? { fingerprint: input.fingerprint } : {}),
      ...(input.fingerprint_version
        ? { fingerprint_version: input.fingerprint_version }
        : {}),
      ...(input.deploy_generation?.trim()
        ? { deploy_generation: input.deploy_generation.trim() }
        : {}),
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    try {
      // Job record is authority — persist identity inside job after NX claim.
      await kv.set(xhighJobKey(job.job_id), job, { ex: KV_TTL.POJU_XHIGH_JOB });
      await kv.set(xhighSessionLatestKey(input.phase, input.session_id), job.job_id, {
        ex: KV_TTL.POJU_XHIGH_JOB,
      });
    } catch (err) {
      // Release claim so the same identity can retry; do not leave a silent second identity.
      await kv.del(indexKey);
      throw err;
    }

    if (input.__test_delete_index_after_create) {
      await kv.del(indexKey);
    }

    return job;
  }

  // Legacy path without client_task_id (pre-Phase3 callers). Not identity-safe under retry.
  const job: PojuXhighJob = {
    job_id: generateXhighJobId(input.phase, input.session_id),
    phase: input.phase,
    session_id: input.session_id,
    locale: input.locale,
    status: "pending",
    accumulated_content: "",
    input: input.job_input,
    ...(input.generation_type ? { generation_type: input.generation_type } : {}),
    ...(input.fingerprint ? { fingerprint: input.fingerprint } : {}),
    ...(input.fingerprint_version ? { fingerprint_version: input.fingerprint_version } : {}),
    ...(input.deploy_generation?.trim()
      ? { deploy_generation: input.deploy_generation.trim() }
      : {}),
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

  const nonRevivable =
    job.failure_reason === "superseded_by_regenerate" ||
    job.failure_reason === "superseded_by_deploy" ||
    job.failure_reason === "user_cancelled";
  const allowInterruptedRevive =
    job.status === "failed" &&
    status === "running" &&
    !nonRevivable &&
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
