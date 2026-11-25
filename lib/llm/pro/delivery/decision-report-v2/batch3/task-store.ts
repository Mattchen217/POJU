/**
 * Atomic task claim / lease / completion for Batch3 idempotency.
 */

import { randomUUID } from "node:crypto";

import type { ReportPageId, ReportUpstreamOutputFingerprints } from "../orchestration/types";
import { casSet, isBatch3SharedStoreAvailable, kvGet, kvUnavailable } from "./kv-cas";
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
  if (!task.lease_expires_at) return true;
  return Date.parse(task.lease_expires_at) <= nowMs;
}

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
    validity_rev: 0,
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

    const now = Date.now();
    if (
      task.status === "running" &&
      task.attempt_id &&
      !leaseExpired(task, now)
    ) {
      return {
        ok: false,
        code: "already_claimed",
        detail: `held by attempt ${task.attempt_id} until ${task.lease_expires_at}`,
      };
    }

    const attempt_id = randomUUID();
    const next: TaskRecord = {
      ...task,
      status: "running",
      attempt_id,
      worker_id: input.worker_id,
      lease_expires_at: new Date(now + leaseMs).toISOString(),
      updated_at: new Date().toISOString(),
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
  const cur = await kvGet<TaskRecord>(key);
  if (!cur.ok) return cur;
  if (!cur.value) return { ok: false, code: "not_found", detail: "task missing" };
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
  const next: TaskRecord = {
    ...cur.value,
    lease_expires_at: new Date(
      Date.now() + (input.lease_ms ?? DEFAULT_TASK_LEASE_MS),
    ).toISOString(),
    updated_at: new Date().toISOString(),
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
