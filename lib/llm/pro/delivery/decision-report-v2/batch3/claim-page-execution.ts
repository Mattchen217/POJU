/**
 * Atomic Task + Fence claim — single MemoryKv txn / Redis Lua.
 * Fence becomes claimed with attempt/task/rev bound in the same transaction.
 */

import { randomUUID } from "node:crypto";

import { reportPageDefinition } from "../orchestration";
import type {
  ReportPageId,
  ReportUpstreamOutputFingerprints,
} from "../orchestration/types";
import { batch3NowIso, batch3NowMs } from "./clock";
import {
  finalizationClaimKey,
  inspectFinalizationLock,
  FINALIZATION_LOCK_LUA_SNIPPET,
} from "./finalization-lock";
import { generationStoreKeys } from "./generation-store";
import {
  evalTxn,
  isMemoryAtomicAvailable,
  kvGet,
  runMemoryAtomic,
  trackBatch3Key,
  ttlSeconds,
} from "./kv-cas";
import { pageFenceKey } from "./page-fence";
import { computeTaskKey } from "./task-identity";
import type {
  ActiveGenerationPointer,
  Batch3Result,
  PageFence,
  TaskRecord,
  TaskType,
} from "./types";
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

/**
 * Lua: KEYS[1]=active, KEYS[2]=claim, KEYS[3]=fence, KEYS[4]=task
 * Returns 1 + writes; negatives fail-closed.
 *  -10 finalization_locked
 *  -13 claim unusable
 *  -1 stale_generation
 *  -8 fence not open / rev mismatch
 *  -2 task missing
 *  -9 already_claimed (lease held)
 *  -4 already_completed
 *  -3 stale task
 */
const CLAIM_EXEC_LUA = `
local activeKey = KEYS[1]
local claimKey = KEYS[2]
local fenceKey = KEYS[3]
local taskKey = KEYS[4]
local expectGenId = ARGV[1]
local expectEpoch = tonumber(ARGV[2])
local expectRev = tonumber(ARGV[3])
local expectTaskKey = ARGV[4]
local workerId = ARGV[5]
local leaseMs = tonumber(ARGV[6])
local nowMs = tonumber(ARGV[7])
local nowIso = ARGV[8]
local attemptId = ARGV[9]
local nextFenceJson = ARGV[10]
local nextTaskJson = ARGV[11]
local ttl = tonumber(ARGV[12])

local claimCur = redis.call("GET", claimKey)
${FINALIZATION_LOCK_LUA_SNIPPET}
if __fin_lock == -10 then return -10 end
if __fin_lock == -13 then return -13 end

local cur = redis.call("GET", activeKey)
if cur == false or cur == nil then return -1 end
local ok, active = pcall(cjson.decode, cur)
if not ok or not active then return -1 end
if active.generation_id ~= expectGenId or tonumber(active.generation_epoch) ~= expectEpoch then
  return -1
end

local fcur = redis.call("GET", fenceKey)
if fcur == false or fcur == nil then return -8 end
local fok, fence = pcall(cjson.decode, fcur)
if not fok or not fence then return -8 end
if fence.status ~= "open" and fence.status ~= "claimed" then return -8 end
if tonumber(fence.validity_rev) ~= expectRev then return -8 end
if tonumber(fence.generation_epoch) ~= expectEpoch then return -1 end

local tcur = redis.call("GET", taskKey)
if tcur == false or tcur == nil then return -2 end
local tok, task = pcall(cjson.decode, tcur)
if not tok or not task then return -2 end
if task.status == "completed" then return -4 end
if task.status == "stale" or task.status == "superseded" then return -3 end
if task.status == "running" and task.attempt_id and task.lease_expires_at then
  local exp = tonumber(string.sub(task.lease_expires_at, 1, 10))
  -- ISO parse is awkward in Lua; pass precomputed: ARGV[13]=lease_ok (1 allow reclaim)
end
local leaseOk = tonumber(ARGV[13])
if task.status == "running" and task.attempt_id and leaseOk ~= 1 then
  return -9
end

redis.call("SET", fenceKey, nextFenceJson, "EX", ttl)
redis.call("SET", taskKey, nextTaskJson, "EX", ttl)
return 1
`;

export async function claimPageExecution(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  page_id: ReportPageId;
  task_type: TaskType;
  input_fingerprint: string;
  upstream_output_fingerprints: ReportUpstreamOutputFingerprints;
  worker_id: string;
  lease_ms?: number;
}): Promise<
  Batch3Result<{
    task: TaskRecord;
    task_key: string;
    attempt_id: string;
    validity_rev: number;
  }>
> {
  const fKey = pageFenceKey(
    input.report_id,
    input.generation_id,
    input.page_id,
  );
  const cKey = finalizationClaimKey(input.report_id, input.generation_id);
  const aKey = generationStoreKeys.activeKey(input.report_id);
  trackBatch3Key(fKey);
  trackBatch3Key(cKey);
  trackBatch3Key(aKey);

  const fenceRead = await kvGet<PageFence>(fKey);
  if (!fenceRead.ok) return fenceRead;
  if (!fenceRead.value) {
    return { ok: false, code: "not_found", detail: "fence missing — ensure first" };
  }
  if (fenceRead.value.status === "stale") {
    return {
      ok: false,
      code: "stale_page",
      detail: `page ${input.page_id} fence stale rev=${fenceRead.value.validity_rev}`,
    };
  }
  if (
    fenceRead.value.status !== "open" &&
    fenceRead.value.status !== "claimed"
  ) {
    return {
      ok: false,
      code: "conflict",
      detail: `fence status=${fenceRead.value.status} — need open/claimed for claim`,
    };
  }

  const validity_rev = fenceRead.value.validity_rev;
  const def = reportPageDefinition(input.page_id);
  const task_key = computeTaskKey({
    report_id: input.report_id,
    generation_id: input.generation_id,
    generation_epoch: input.generation_epoch,
    page_id: input.page_id,
    validity_rev,
    input_fingerprint: input.input_fingerprint,
    upstream_output_fingerprints: input.upstream_output_fingerprints,
    page_contract_version: def.production_version,
    prompt_version: def.prompt_version,
    validator_version: def.validator_version,
    task_type: input.task_type,
  });
  const tKey = taskKeyPath(input.report_id, input.generation_id, task_key);
  trackBatch3Key(tKey);

  // Ensure task record exists (CAS create if absent).
  const existingTask = await kvGet<TaskRecord>(tKey);
  if (!existingTask.ok) return existingTask;
  if (!existingTask.value) {
    const now = batch3NowIso();
    const queued: TaskRecord = {
      report_id: input.report_id.trim(),
      generation_id: input.generation_id.trim(),
      generation_epoch: input.generation_epoch,
      page_id: input.page_id,
      task_type: input.task_type,
      task_key,
      status: "queued",
      attempt_id: null,
      lease_expires_at: null,
      worker_id: null,
      validity_rev,
      input_fingerprint: input.input_fingerprint,
      upstream_output_fingerprints: input.upstream_output_fingerprints,
      page_contract_version: def.production_version,
      prompt_version: def.prompt_version,
      validator_version: def.validator_version,
      created_at: now,
      updated_at: now,
    };
    const { casSet } = await import("./kv-cas");
    const created = await casSet(tKey, null, queued);
    if (!created.ok && created.code !== "conflict") return created;
  }

  const leaseMs = input.lease_ms ?? DEFAULT_TASK_LEASE_MS;
  const nowMs = batch3NowMs();
  const nowIso = batch3NowIso();
  const attempt_id = randomUUID();

  if (isMemoryAtomicAvailable()) {
    const ran = runMemoryAtomic((ops) => {
      const lock = inspectFinalizationLock(ops.getJson(cKey));
      if (lock.kind === "locked") {
        return {
          ok: false as const,
          code: "finalization_locked" as const,
          detail: "claim refused: finalization locks page content",
        };
      }
      if (lock.kind === "unusable") {
        return {
          ok: false as const,
          code: "conflict" as const,
          detail: lock.reason,
        };
      }

      const active = ops.getJson(aKey) as ActiveGenerationPointer | null;
      if (
        !active ||
        active.generation_id !== input.generation_id.trim() ||
        active.generation_epoch !== input.generation_epoch
      ) {
        return {
          ok: false as const,
          code: "stale_generation" as const,
          detail: "active mismatch at page claim",
        };
      }

      const fence = ops.getJson(fKey) as PageFence | null;
      if (
        !fence ||
        (fence.status !== "open" && fence.status !== "claimed")
      ) {
        return {
          ok: false as const,
          code: "stale_page" as const,
          detail: `fence not claimable (${fence?.status ?? "missing"})`,
        };
      }
      if (fence.validity_rev !== validity_rev) {
        return {
          ok: false as const,
          code: "stale_page" as const,
          detail: "fence rev changed before claim",
        };
      }

      const task = ops.getJson(tKey) as TaskRecord | null;
      if (!task) {
        return {
          ok: false as const,
          code: "not_found" as const,
          detail: "task missing",
        };
      }
      if (task.status === "completed") {
        return {
          ok: false as const,
          code: "already_completed" as const,
          detail: "task completed",
        };
      }
      if (task.status === "stale" || task.status === "superseded") {
        return {
          ok: false as const,
          code: "stale_attempt" as const,
          detail: `task ${task.status}`,
        };
      }
      if (
        task.status === "running" &&
        task.attempt_id &&
        !leaseExpired(task, nowMs)
      ) {
        return {
          ok: false as const,
          code: "already_claimed" as const,
          detail: `held until ${task.lease_expires_at}`,
        };
      }

      const nextTask: TaskRecord = {
        ...task,
        status: "running",
        attempt_id,
        worker_id: input.worker_id,
        lease_expires_at: new Date(nowMs + leaseMs).toISOString(),
        updated_at: nowIso,
        validity_rev,
        failure_detail: null,
      };
      const nextFence: PageFence = {
        ...fence,
        status: "claimed",
        attempt_id,
        task_key,
        validity_rev,
        input_fingerprint: input.input_fingerprint,
        upstream_output_fingerprints: input.upstream_output_fingerprints,
        updated_at: nowIso,
      };
      ops.setJson(tKey, nextTask);
      ops.setJson(fKey, nextFence);
      return {
        ok: true as const,
        task: nextTask,
        attempt_id,
        validity_rev,
      };
    });
    if (!ran.ok) return ran;
    if (!ran.value.ok) {
      return { ok: false, code: ran.value.code, detail: ran.value.detail };
    }
    return {
      ok: true,
      value: {
        task: ran.value.task,
        task_key,
        attempt_id: ran.value.attempt_id,
        validity_rev: ran.value.validity_rev,
      },
    };
  }

  // Redis path: precompute lease reclaim flag from current task.
  const preTask = await kvGet<TaskRecord>(tKey);
  if (!preTask.ok) return preTask;
  const leaseOk =
    !preTask.value ||
    preTask.value.status !== "running" ||
    !preTask.value.attempt_id ||
    leaseExpired(preTask.value, nowMs)
      ? 1
      : 0;

  const nextTask: TaskRecord = {
    ...(preTask.value as TaskRecord),
    status: "running",
    attempt_id,
    worker_id: input.worker_id,
    lease_expires_at: new Date(nowMs + leaseMs).toISOString(),
    updated_at: nowIso,
    validity_rev,
    failure_detail: null,
  };
  const nextFence: PageFence = {
    ...fenceRead.value,
    status: "claimed",
    attempt_id,
    task_key,
    validity_rev,
    input_fingerprint: input.input_fingerprint,
    upstream_output_fingerprints: input.upstream_output_fingerprints,
    updated_at: nowIso,
  };

  const evaled = await evalTxn(
    CLAIM_EXEC_LUA,
    [aKey, cKey, fKey, tKey],
    [
      input.generation_id.trim(),
      String(input.generation_epoch),
      String(validity_rev),
      task_key,
      input.worker_id,
      String(leaseMs),
      String(nowMs),
      nowIso,
      attempt_id,
      JSON.stringify(nextFence),
      JSON.stringify(nextTask),
      String(ttlSeconds()),
      String(leaseOk),
    ],
  );
  if (!evaled.ok) return evaled;
  const code = Number(evaled.value);
  if (code === 1) {
    return {
      ok: true,
      value: { task: nextTask, task_key, attempt_id, validity_rev },
    };
  }
  if (code === -10) {
    return {
      ok: false,
      code: "finalization_locked",
      detail: "claim refused: finalization locks page content",
    };
  }
  if (code === -13) {
    return {
      ok: false,
      code: "conflict",
      detail: "claim refused: finalization claim unusable",
    };
  }
  if (code === -1) {
    return { ok: false, code: "stale_generation", detail: "active mismatch" };
  }
  if (code === -8) {
    return { ok: false, code: "stale_page", detail: "fence not open / rev" };
  }
  if (code === -9) {
    return { ok: false, code: "already_claimed", detail: "lease held" };
  }
  if (code === -4) {
    return { ok: false, code: "already_completed", detail: "task completed" };
  }
  if (code === -3) {
    return { ok: false, code: "stale_attempt", detail: "task stale" };
  }
  if (code === -2) {
    return { ok: false, code: "not_found", detail: "task missing" };
  }
  return {
    ok: false,
    code: "conflict",
    detail: `claimPageExecution lua=${code}`,
  };
}
