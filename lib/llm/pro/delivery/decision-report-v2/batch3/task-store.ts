/**
 * Atomic task claim / lease / completion for Batch3 idempotency.
 */

import { randomUUID } from "node:crypto";

import type { ReportPageId, ReportUpstreamOutputFingerprints } from "../orchestration/types";
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

/** Redis renew: authoritative lease via TIME (not client nowMs). */
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
  /** Defaults to 0; must match fence validity_rev for TaskKey. */
  validity_rev?: number;
}): Promise<Batch3Result<TaskRecord>> {
  if (!isBatch3SharedStoreAvailable()) return kvUnavailable();
  const key = taskKeyPath(input.report_id, input.generation_id, input.task_key);
  const existing = await kvGet<TaskRecord>(key);
  if (!existing.ok) return existing;
  if (existing.value) return { ok: true, value: existing.value };

  const now = new Date().toISOString();
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

export async function claimTask(input: {
  report_id: string;
  generation_id: string;
  task_key: string;
  worker_id: string;
  lease_ms?: number;
  /** Bound page fence validity_rev at claim time. */
  validity_rev?: number;
}): Promise<Batch3Result<TaskRecord>> {
  if (!isBatch3SharedStoreAvailable()) return kvUnavailable();
  const key = taskKeyPath(input.report_id, input.generation_id, input.task_key);
  const leaseMs = input.lease_ms ?? DEFAULT_TASK_LEASE_MS;

  const { pageFenceKey } = await import("./page-fence");

  for (let i = 0; i < 6; i += 1) {
    const cur = await kvGet<TaskRecord>(key);
    if (!cur.ok) return cur;
    if (!cur.value) {
      return { ok: false, code: "not_found", detail: "task missing — ensureQueued first" };
    }
    const task = cur.value;
    if (task.status === "completed") {
      return { ok: false, code: "already_completed", detail: "task already completed" };
    }
    if (task.status === "stale" || task.status === "superseded") {
      return {
        ok: false,
        code: "stale_attempt",
        detail: `task status=${task.status}`,
      };
    }
    if (task.status === "failed") {
      // allow new attempt from failed
    }

    const nowMs = batch3NowMs();
    if (
      task.status === "running" &&
      task.attempt_id &&
      !leaseExpired(task, nowMs)
    ) {
      return {
        ok: false,
        code: "already_claimed",
        detail: `held by attempt ${task.attempt_id} until ${task.lease_expires_at}`,
      };
    }

    const fKey = pageFenceKey(input.report_id, input.generation_id, task.page_id);
    const fence = await kvGet<import("./types").PageFence>(fKey);
    if (fence.ok && fence.value?.task_key && fence.value.task_key !== input.task_key) {
      return {
        ok: false,
        code: "task_conflict",
        detail: `fence bound to task_key=${fence.value.task_key}`,
      };
    }

    const attempt_id = randomUUID();
    const lease_expires_ms = nowMs + leaseMs;
    const next: TaskRecord = {
      ...task,
      status: "running",
      attempt_id,
      worker_id: input.worker_id,
      lease_expires_at: new Date(lease_expires_ms).toISOString(),
      lease_expires_ms,
      updated_at: batch3NowIso(),
      failure_detail: null,
      validity_rev:
        typeof input.validity_rev === "number"
          ? input.validity_rev
          : (task.validity_rev ?? 0),
    };
    const saved = await casSet(key, JSON.stringify(task), next);
    if (!saved.ok) {
      if (saved.code === "conflict") continue;
      return saved;
    }

    if (fence.ok && fence.value) {
      if (
        fence.value.status === "open" ||
        (fence.value.status === "claimed" &&
          (!fence.value.task_key || fence.value.task_key === input.task_key))
      ) {
        const rev =
          typeof input.validity_rev === "number"
            ? input.validity_rev
            : fence.value.validity_rev;
        if (fence.value.validity_rev === rev) {
          const nextFence: import("./types").PageFence = {
            ...fence.value,
            status: "claimed",
            attempt_id,
            task_key: input.task_key,
            input_fingerprint: task.input_fingerprint,
            upstream_output_fingerprints: task.upstream_output_fingerprints,
            updated_at: next.updated_at,
          };
          await casSet(fKey, JSON.stringify(fence.value), nextFence);
        }
      }
    }

    return { ok: true, value: next };
  }
  return { ok: false, code: "conflict", detail: "claimTask CAS exhausted" };
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

  if (!isMemoryAtomicAvailable()) {
    const evaled = await evalTxn(
      RENEW_LEASE_LUA,
      [key],
      [
        input.attempt_id,
        String(leaseMs),
        String(ttlSeconds()),
        batch3NowIso(),
      ],
    );
    if (!evaled.ok) return evaled;
    const code = Number(evaled.value);
    if (code === 1) {
      const after = await kvGet<TaskRecord>(key);
      if (!after.ok) return after;
      if (!after.value) {
        return { ok: false, code: "conflict", detail: "task missing after renew lua" };
      }
      return { ok: true, value: after.value };
    }
    if (code === -2) {
      return { ok: false, code: "not_found", detail: "task missing" };
    }
    if (code === -3) {
      return { ok: false, code: "stale_attempt", detail: "attempt_id mismatch on renew" };
    }
    if (code === -5) {
      return {
        ok: false,
        code: "conflict",
        detail: "cannot renew lease when task not running",
      };
    }
    if (code === -14) {
      return {
        ok: false,
        code: "lease_expired",
        detail: "cannot renew an already-expired lease",
      };
    }
    return { ok: false, code: "conflict", detail: `renewLease lua=${code}` };
  }

  for (let i = 0; i < 6; i += 1) {
    const cur = await kvGet<TaskRecord>(key);
    if (!cur.ok) return cur;
    if (!cur.value) {
      return { ok: false, code: "not_found", detail: "task missing" };
    }
    if (cur.value.attempt_id !== input.attempt_id) {
      return { ok: false, code: "stale_attempt", detail: "attempt_id mismatch on renew" };
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
        detail: "cannot renew an already-expired lease",
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
    if (!saved.ok) {
      if (saved.code === "conflict") continue;
      return saved;
    }
    return { ok: true, value: next };
  }
  return { ok: false, code: "conflict", detail: "renewLease CAS exhausted" };
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
    return { ok: false, code: "stale_attempt", detail: "attempt_id mismatch" };
  }
  if (cur.value.status === "completed" && input.to !== "completed") {
    return { ok: false, code: "already_completed", detail: "already completed" };
  }
  if (cur.value.status === "superseded" || cur.value.status === "stale") {
    return {
      ok: false,
      code: "stale_attempt",
      detail: `task already ${cur.value.status}`,
    };
  }
  const next: TaskRecord = {
    ...cur.value,
    status: input.to,
    updated_at: new Date().toISOString(),
    completed_at:
      input.to === "completed" ? new Date().toISOString() : cur.value.completed_at,
    failure_detail: input.failure_detail ?? cur.value.failure_detail,
    lease_expires_at:
      input.to === "running" ? cur.value.lease_expires_at : null,
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

export async function markRepairPending(input: {
  report_id: string;
  generation_id: string;
  task_key: string;
  attempt_id: string;
}): Promise<Batch3Result<TaskRecord>> {
  return transitionOwned({ ...input, to: "repair_pending" });
}

export async function markTaskStale(input: {
  report_id: string;
  generation_id: string;
  task_key: string;
  reason: string;
}): Promise<Batch3Result<TaskRecord>> {
  const key = taskKeyPath(input.report_id, input.generation_id, input.task_key);
  const cur = await kvGet<TaskRecord>(key);
  if (!cur.ok) return cur;
  if (!cur.value) return { ok: false, code: "not_found", detail: "task missing" };
  const next: TaskRecord = {
    ...cur.value,
    status: "stale",
    updated_at: new Date().toISOString(),
    failure_detail: input.reason,
    lease_expires_at: null,
  };
  const saved = await casSet(key, JSON.stringify(cur.value), next);
  if (!saved.ok) return saved;
  return { ok: true, value: next };
}
