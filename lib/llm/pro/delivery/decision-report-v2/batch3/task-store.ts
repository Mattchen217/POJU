/**
 * Task store — claimTask is a thin wrapper over claimPageExecutionAtomic.
 * Lease renew uses Redis TIME / Memory clock with fail-closed missing lease.
 */

import type {
  ReportPageId,
  ReportUpstreamOutputFingerprints,
} from "../orchestration/types";
import {
  REDIS_LEASE_EXPIRED_LUA_SNIPPET,
  REDIS_TIME_LUA_SNIPPET,
  batch3NowIso,
  batch3NowMs,
} from "./clock";
import {
  casSet,
  evalTxn,
  isBatch3SharedStoreAvailable,
  isMemoryAtomicAvailable,
  isRedisEvalAvailable,
  kvGet,
  kvUnavailable,
  ttlSeconds,
} from "./kv-cas";
import type { Batch3Result, TaskRecord, TaskStatus, TaskType } from "./types";
import { DEFAULT_TASK_LEASE_MS } from "./types";

function taskKeyPath(
  report_id: string,
  generation_id: string,
  task_key: string,
): string {
  return `report-batch3:${report_id.trim()}:${generation_id.trim()}:task:${task_key}`;
}

function leaseExpired(task: TaskRecord, nowMs: number): boolean {
  const hasMs = typeof task.lease_expires_ms === "number";
  const hasAt = Boolean(task.lease_expires_at);
  if (!hasMs && !hasAt) return true;
  if (hasMs && (task.lease_expires_ms as number) <= nowMs) return true;
  if (hasAt && Date.parse(task.lease_expires_at as string) <= nowMs) return true;
  return false;
}

const RENEW_LEASE_LUA = `
${REDIS_TIME_LUA_SNIPPET}
${REDIS_LEASE_EXPIRED_LUA_SNIPPET}
local taskKey = KEYS[1]
local expectAttempt = ARGV[1]
local leaseMs = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])
local displayNowIso = ARGV[4]

local tcur = redis.call("GET", taskKey)
if tcur == false or tcur == nil then return -2 end
local tok, task = pcall(cjson.decode, tcur)
if not tok or not task then return -2 end
if task.attempt_id ~= expectAttempt then return -3 end
if task.status ~= "running" then return -5 end
if __batch3_lease_expired(task, __now_ms) then
  return -14
end

local lease_expires_ms = __now_ms + leaseMs
task.lease_expires_ms = lease_expires_ms
task.lease_expires_at = tostring(lease_expires_ms)
task.updated_at = displayNowIso
redis.call("SET", taskKey, cjson.encode(task), "EX", ttl)
return 1
`;

export async function readTask(
  report_id: string,
  generation_id: string,
  task_key: string,
): Promise<Batch3Result<TaskRecord | null>> {
  return kvGet<TaskRecord>(taskKeyPath(report_id, generation_id, task_key));
}

export async function ensureQueuedTask(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  page_id: ReportPageId;
  task_type: TaskType;
  task_key: string;
  input_fingerprint: string;
  upstream_output_fingerprints: ReportUpstreamOutputFingerprints;
  page_contract_version: string;
  prompt_version: string;
  validator_version: string;
  validity_rev?: number;
}): Promise<Batch3Result<TaskRecord>> {
  if (!isBatch3SharedStoreAvailable()) return kvUnavailable();
  const key = taskKeyPath(input.report_id, input.generation_id, input.task_key);
  const existing = await kvGet<TaskRecord>(key);
  if (!existing.ok) return existing;
  if (existing.value) return { ok: true, value: existing.value };

  const now = batch3NowIso();
  const queued: TaskRecord = {
    report_id: input.report_id.trim(),
    generation_id: input.generation_id.trim(),
    generation_epoch: input.generation_epoch,
    page_id: input.page_id,
    task_type: input.task_type,
    task_key: input.task_key,
    status: "queued",
    attempt_id: null,
    lease_expires_at: null,
    lease_expires_ms: null,
    worker_id: null,
    validity_rev: input.validity_rev ?? 0,
    input_fingerprint: input.input_fingerprint,
    upstream_output_fingerprints: input.upstream_output_fingerprints,
    page_contract_version: input.page_contract_version,
    prompt_version: input.prompt_version,
    validator_version: input.validator_version,
    created_at: now,
    updated_at: now,
  };
  const created = await casSet(key, null, queued);
  if (!created.ok) {
    if (created.code === "conflict") {
      const again = await kvGet<TaskRecord>(key);
      if (!again.ok) return again;
      if (again.value) return { ok: true, value: again.value };
    }
    return created;
  }
  return { ok: true, value: queued };
}

/**
 * Compat Claim entry — MUST use Unit A atomic claimPageExecution.
 * No separate Task CAS + Fence CAS.
 */
export async function claimTask(input: {
  report_id: string;
  generation_id: string;
  task_key: string;
  worker_id: string;
  lease_ms?: number;
  validity_rev?: number;
}): Promise<Batch3Result<TaskRecord>> {
  if (!isBatch3SharedStoreAvailable()) return kvUnavailable();
  const cur = await readTask(
    input.report_id,
    input.generation_id,
    input.task_key,
  );
  if (!cur.ok) return cur;
  if (!cur.value) {
    return {
      ok: false,
      code: "not_found",
      detail: "task missing — ensureQueued first",
    };
  }
  const task = cur.value;
  if (
    typeof input.validity_rev === "number" &&
    task.validity_rev !== input.validity_rev
  ) {
    // Soft pre-check only; atomic claim still re-validates fence.validity_rev.
    // Mismatch here means caller is targeting a different revision identity.
    return {
      ok: false,
      code: "revision_conflict",
      detail: `task validity_rev ${task.validity_rev} != ${input.validity_rev}`,
    };
  }
  const { claimPageExecution } = await import("./claim-page-execution");
  const claimed = await claimPageExecution({
    report_id: input.report_id,
    generation_id: input.generation_id,
    generation_epoch: task.generation_epoch,
    page_id: task.page_id,
    task_type: task.task_type,
    input_fingerprint: task.input_fingerprint,
    upstream_output_fingerprints: task.upstream_output_fingerprints,
    worker_id: input.worker_id,
    lease_ms: input.lease_ms,
    page_contract_version: task.page_contract_version,
    prompt_version: task.prompt_version,
    validator_version: task.validator_version,
    expect_task_key: input.task_key,
  });
  if (!claimed.ok) return claimed;
  if (claimed.value.task_key !== input.task_key) {
    return {
      ok: false,
      code: "task_conflict",
      detail: `computed task_key mismatch vs claimTask key`,
    };
  }
  if (
    typeof input.validity_rev === "number" &&
    claimed.value.validity_rev !== input.validity_rev
  ) {
    return {
      ok: false,
      code: "revision_conflict",
      detail: `validity_rev ${claimed.value.validity_rev} != ${input.validity_rev}`,
    };
  }
  return { ok: true, value: claimed.value.task };
}

export async function renewLease(input: {
  report_id: string;
  generation_id: string;
  task_key: string;
  attempt_id: string;
  lease_ms?: number;
}): Promise<Batch3Result<TaskRecord>> {
  const key = taskKeyPath(input.report_id, input.generation_id, input.task_key);
  const leaseMs = input.lease_ms ?? DEFAULT_TASK_LEASE_MS;

  if (isRedisEvalAvailable()) {
    const evaled = await evalTxn(
      RENEW_LEASE_LUA,
      [key],
      [input.attempt_id, String(leaseMs), String(ttlSeconds()), batch3NowIso()],
    );
    if (!evaled.ok) return evaled;
    const code = Number(evaled.value);
    if (code === 1) {
      const after = await kvGet<TaskRecord>(key);
      if (!after.ok) return after;
      if (!after.value) {
        return {
          ok: false,
          code: "conflict",
          detail: "task missing after renew lua",
        };
      }
      return { ok: true, value: after.value };
    }
    if (code === -2) return { ok: false, code: "not_found", detail: "task missing" };
    if (code === -3) {
      return { ok: false, code: "stale_attempt", detail: "attempt_id mismatch" };
    }
    if (code === -5) {
      return { ok: false, code: "conflict", detail: "bad status for renew" };
    }
    if (code === -14) {
      return {
        ok: false,
        code: "lease_expired",
        detail: "cannot renew expired/missing lease",
      };
    }
    return { ok: false, code: "conflict", detail: `renew lua=${code}` };
  }

  if (!isMemoryAtomicAvailable() && !isBatch3SharedStoreAvailable()) {
    return kvUnavailable();
  }

  const cur = await kvGet<TaskRecord>(key);
  if (!cur.ok) return cur;
  if (!cur.value) return { ok: false, code: "not_found", detail: "task missing" };
  if (cur.value.attempt_id !== input.attempt_id) {
    return {
      ok: false,
      code: "stale_attempt",
      detail: "attempt_id mismatch on renew",
    };
  }
  if (cur.value.status !== "running") {
    return {
      ok: false,
      code: "conflict",
      detail: `cannot renew lease in status=${cur.value.status}`,
    };
  }
  const nowMs = batch3NowMs();
  if (leaseExpired(cur.value, nowMs)) {
    return {
      ok: false,
      code: "lease_expired",
      detail: "cannot renew an already-expired or missing lease",
    };
  }
  const lease_expires_ms = nowMs + leaseMs;
  const next: TaskRecord = {
    ...cur.value,
    lease_expires_at: new Date(lease_expires_ms).toISOString(),
    lease_expires_ms,
    updated_at: batch3NowIso(),
  };
  const saved = await casSet(key, JSON.stringify(cur.value), next);
  if (!saved.ok) return saved;
  return { ok: true, value: next };
}

async function transitionOwned(input: {
  report_id: string;
  generation_id: string;
  task_key: string;
  attempt_id: string;
  to: TaskStatus;
  failure_detail?: string | null;
}): Promise<Batch3Result<TaskRecord>> {
  const key = taskKeyPath(input.report_id, input.generation_id, input.task_key);
  const cur = await kvGet<TaskRecord>(key);
  if (!cur.ok) return cur;
  if (!cur.value) return { ok: false, code: "not_found", detail: "task missing" };
  if (cur.value.attempt_id !== input.attempt_id) {
    return { ok: false, code: "stale_attempt", detail: "attempt mismatch" };
  }
  if (cur.value.status === "completed" && input.to === "completed") {
    return { ok: true, value: cur.value };
  }
  const next: TaskRecord = {
    ...cur.value,
    status: input.to,
    lease_expires_at: null,
    lease_expires_ms: null,
    updated_at: batch3NowIso(),
    completed_at:
      input.to === "completed" ? batch3NowIso() : cur.value.completed_at,
    failure_detail:
      input.failure_detail !== undefined
        ? input.failure_detail
        : cur.value.failure_detail,
  };
  const saved = await casSet(key, JSON.stringify(cur.value), next);
  if (!saved.ok) return saved;
  return { ok: true, value: next };
}

export async function completeTask(input: {
  report_id: string;
  generation_id: string;
  task_key: string;
  attempt_id: string;
}): Promise<Batch3Result<TaskRecord>> {
  return transitionOwned({ ...input, to: "completed" });
}

export async function failTask(input: {
  report_id: string;
  generation_id: string;
  task_key: string;
  attempt_id: string;
  detail: string;
}): Promise<Batch3Result<TaskRecord>> {
  return transitionOwned({
    ...input,
    to: "failed",
    failure_detail: input.detail,
  });
}
