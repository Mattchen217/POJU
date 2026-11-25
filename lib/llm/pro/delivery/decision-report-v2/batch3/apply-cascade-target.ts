/**
 * Unit B — applyCascadeTargetAtomic
 * Operation ID + expected_old_rev + fence stale + target completed in ONE txn.
 */

import type { ReportPageId } from "../orchestration/types";
import { cascadeOpKey } from "./cascade-operation";
import {
  finalizationClaimKey,
  FINALIZATION_LOCK_LUA_SNIPPET,
  inspectFinalizationLock,
} from "./finalization-lock";
import {
  evalTxn,
  isMemoryAtomicAvailable,
  runMemoryAtomic,
  trackBatch3Key,
  ttlSeconds,
} from "./kv-cas";
import { pageFenceKey } from "./page-fence";
import type {
  Batch3Result,
  CascadeOperation,
  CascadePageTarget,
  PageFence,
  PageProvenance,
  TaskRecord,
} from "./types";

function provKey(
  report_id: string,
  generation_id: string,
  page_id: ReportPageId,
): string {
  return `report-batch3:${report_id.trim()}:${generation_id.trim()}:prov:${page_id}`;
}

function taskKeyPath(
  report_id: string,
  generation_id: string,
  task_key: string,
): string {
  return `report-batch3:${report_id.trim()}:${generation_id.trim()}:task:${task_key}`;
}

function targetDone(t: CascadePageTarget): boolean {
  return t.status === "completed" || t.done === true;
}

/**
 * KEYS[1]=claim KEYS[2]=fence KEYS[3]=prov KEYS[4]=cascadeOp
 * ARGV: reportId, genId, epoch, pageId, reason, nowIso, ttl, expectedOld, targetRev, operationId
 * Returns: targetRev | 2 idempotent already-done | negatives
 *  -20 revision_conflict
 *  -21 op missing / id mismatch / target not in set
 *  -22 op not running
 *  -10/-13 fin lock
 */
export const APPLY_CASCADE_TARGET_LUA = `
local claimKey = KEYS[1]
local fenceKey = KEYS[2]
local provKey = KEYS[3]
local opKey = KEYS[4]
local reportId = ARGV[1]
local genId = ARGV[2]
local epoch = tonumber(ARGV[3])
local pageId = ARGV[4]
local reason = ARGV[5]
local nowIso = ARGV[6]
local ttl = tonumber(ARGV[7])
local expectedOldRev = tonumber(ARGV[8])
local targetRev = tonumber(ARGV[9])
local operationId = ARGV[10]
if not epoch or not ttl or not expectedOldRev or not targetRev
  or type(reportId) ~= "string" or type(genId) ~= "string" or type(operationId) ~= "string" then
  return -12
end

local opCur = redis.call("GET", opKey)
if opCur == false or opCur == nil then return -21 end
local ook, op = pcall(cjson.decode, opCur)
if not ook or type(op) ~= "table" then return -21 end
if op.operation_id ~= operationId then return -21 end
if op.report_id ~= reportId or op.generation_id ~= genId then return -21 end
if tonumber(op.generation_epoch) ~= epoch then return -21 end
if op.status ~= "running" and op.status ~= "failed_recoverable" then
  if op.status == "completed" then
    -- idempotent if target already done
  else
    return -22
  end
end

local tIdx = nil
local target = nil
if type(op.targets) ~= "table" then return -21 end
for i = 1, #op.targets do
  local t = op.targets[i]
  if t and t.page_id == pageId then
    tIdx = i
    target = t
    break
  end
end
if not target then return -21 end
if tonumber(target.expected_old_rev) ~= expectedOldRev then return -20 end
if tonumber(target.target_rev) ~= targetRev then return -20 end

local already = (target.status == "completed") or (target.done == true)
if already then
  return 2
end

if op.status == "completed" then return -22 end

local claimCur = redis.call("GET", claimKey)
${FINALIZATION_LOCK_LUA_SNIPPET}
if __fin_lock == -10 then return -10 end
if __fin_lock == -13 then return -13 end

local fcur = redis.call("GET", fenceKey)
local curRev = 0
local curTask = nil
if fcur ~= false and fcur ~= nil then
  local fok, fence = pcall(cjson.decode, fcur)
  if not fok or not fence then return -11 end
  curRev = tonumber(fence.validity_rev) or 0
  curTask = fence.task_key
end
if curRev ~= expectedOldRev then return -20 end

local nextFence = {
  report_id = reportId,
  generation_id = genId,
  generation_epoch = epoch,
  page_id = pageId,
  validity_rev = targetRev,
  status = "stale",
  attempt_id = cjson.null,
  task_key = cjson.null,
  input_fingerprint = cjson.null,
  upstream_output_fingerprints = cjson.null,
  output_fingerprint = cjson.null,
  updated_at = nowIso
}
redis.call("SET", fenceKey, cjson.encode(nextFence), "EX", ttl)

local boundTask = nil
if curTask ~= nil and curTask ~= cjson.null and type(curTask) == "string" then
  boundTask = curTask
end
local pcur = redis.call("GET", provKey)
if pcur ~= false and pcur ~= nil then
  local pok, prov = pcall(cjson.decode, pcur)
  if pok and prov then
    prov.stale = true
    prov.stale_reason = reason
    prov.validity_rev = targetRev
    redis.call("SET", provKey, cjson.encode(prov), "EX", ttl)
    if prov.task_key and type(prov.task_key) == "string" then
      boundTask = prov.task_key
    end
  end
end
if boundTask then
  local taskKey = "report-batch3:" .. reportId .. ":" .. genId .. ":task:" .. boundTask
  local tcur = redis.call("GET", taskKey)
  if tcur ~= false and tcur ~= nil then
    local tok, task = pcall(cjson.decode, tcur)
    if tok and task and task.status ~= "superseded" then
      task.status = "stale"
      task.lease_expires_at = cjson.null
      task.lease_expires_ms = cjson.null
      task.updated_at = nowIso
      task.failure_detail = reason
      task.validity_rev = targetRev
      redis.call("SET", taskKey, cjson.encode(task), "EX", ttl)
    end
  end
end

op.targets[tIdx].status = "completed"
op.targets[tIdx].done = true
local allDone = true
for i = 1, #op.targets do
  local t = op.targets[i]
  if not ((t.status == "completed") or (t.done == true)) then
    allDone = false
    break
  end
end
op.status = allDone and "completed" or "running"
op.updated_at = nowIso
op.failure_detail = cjson.null
redis.call("SET", opKey, cjson.encode(op), "EX", ttl)
return targetRev
`;

export function mapApplyCascadeTargetCode(
  code: number,
): Batch3Result<{ validity_rev: number; idempotent?: boolean }> {
  if (code === 2) {
    return { ok: true, value: { validity_rev: -1, idempotent: true } };
  }
  if (Number.isFinite(code) && code >= 0) {
    return { ok: true, value: { validity_rev: code } };
  }
  if (code === -10) {
    return {
      ok: false,
      code: "finalization_locked",
      detail: "cascade target refused: finalization locked",
    };
  }
  if (code === -13) {
    return {
      ok: false,
      code: "conflict",
      detail: "cascade target refused: finalization unusable",
    };
  }
  if (code === -11) {
    return { ok: false, code: "conflict", detail: "fence undecodable" };
  }
  if (code === -12) {
    return { ok: false, code: "conflict", detail: "bad cascade lua args" };
  }
  if (code === -20) {
    return {
      ok: false,
      code: "revision_conflict",
      detail: "expected_old_rev / target_rev mismatch",
    };
  }
  if (code === -21) {
    return {
      ok: false,
      code: "not_found",
      detail: "cascade op missing / id mismatch / target not in set",
    };
  }
  if (code === -22) {
    return {
      ok: false,
      code: "cascade_blocked",
      detail: "cascade op not in recoverable running state",
    };
  }
  return {
    ok: false,
    code: "conflict",
    detail: `applyCascadeTarget lua=${code}`,
  };
}

export async function applyCascadeTargetAtomic(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  page_id: ReportPageId;
  reason: string;
  expected_old_rev: number;
  target_rev: number;
  operation_id: string;
}): Promise<
  Batch3Result<{
    validity_rev: number;
    idempotent?: boolean;
    operation: CascadeOperation | null;
  }>
> {
  const fKey = pageFenceKey(input.report_id, input.generation_id, input.page_id);
  const pKey = provKey(input.report_id, input.generation_id, input.page_id);
  const cKey = finalizationClaimKey(input.report_id, input.generation_id);
  const oKey = cascadeOpKey(
    input.report_id,
    input.generation_id,
    input.operation_id,
  );
  trackBatch3Key(fKey);
  trackBatch3Key(pKey);
  trackBatch3Key(cKey);
  trackBatch3Key(oKey);

  const now = new Date().toISOString();

  if (isMemoryAtomicAvailable()) {
    const ran = runMemoryAtomic((ops) => {
      const op = ops.getJson(oKey) as CascadeOperation | null;
      if (!op || op.operation_id !== input.operation_id) {
        return {
          ok: false as const,
          code: "not_found" as const,
          detail: "cascade op missing or id mismatch",
        };
      }
      if (
        op.report_id !== input.report_id.trim() ||
        op.generation_id !== input.generation_id.trim() ||
        op.generation_epoch !== input.generation_epoch
      ) {
        return {
          ok: false as const,
          code: "stale_generation" as const,
          detail: "cascade op generation mismatch",
        };
      }
      const tIdx = op.targets.findIndex((t) => t.page_id === input.page_id);
      if (tIdx < 0) {
        return {
          ok: false as const,
          code: "not_found" as const,
          detail: "page not in frozen cascade targets",
        };
      }
      const target = op.targets[tIdx]!;
      if (
        target.expected_old_rev !== input.expected_old_rev ||
        target.target_rev !== input.target_rev
      ) {
        return {
          ok: false as const,
          code: "revision_conflict" as const,
          detail: "target rev fields mismatch",
        };
      }
      if (targetDone(target)) {
        return {
          ok: true as const,
          validity_rev: target.target_rev,
          idempotent: true,
          operation: op,
        };
      }
      if (op.status !== "running" && op.status !== "failed_recoverable") {
        return {
          ok: false as const,
          code: "cascade_blocked" as const,
          detail: `op status=${op.status}`,
        };
      }

      const lock = inspectFinalizationLock(ops.getJson(cKey));
      if (lock.kind === "locked") {
        return {
          ok: false as const,
          code: "finalization_locked" as const,
          detail: "finalization locks cascade target",
        };
      }
      if (lock.kind === "unusable") {
        return {
          ok: false as const,
          code: "conflict" as const,
          detail: lock.reason,
        };
      }

      const cur = ops.getJson(fKey) as PageFence | null;
      const curRev = cur?.validity_rev ?? 0;
      if (curRev !== input.expected_old_rev) {
        return {
          ok: false as const,
          code: "revision_conflict" as const,
          detail: `fence rev=${curRev} expected_old=${input.expected_old_rev}`,
        };
      }

      const fence: PageFence = {
        report_id: input.report_id.trim(),
        generation_id: input.generation_id.trim(),
        generation_epoch: input.generation_epoch,
        page_id: input.page_id,
        validity_rev: input.target_rev,
        status: "stale",
        attempt_id: null,
        task_key: null,
        input_fingerprint: null,
        upstream_output_fingerprints: null,
        output_fingerprint: null,
        updated_at: now,
      };
      ops.setJson(fKey, fence);

      const prov = ops.getJson(pKey) as PageProvenance | null;
      let bound = cur?.task_key ?? null;
      if (prov) {
        ops.setJson(pKey, {
          ...prov,
          stale: true,
          stale_reason: input.reason,
          validity_rev: input.target_rev,
        });
        bound = prov.task_key ?? bound;
      }
      if (bound) {
        const tKey = taskKeyPath(
          input.report_id,
          input.generation_id,
          bound,
        );
        trackBatch3Key(tKey);
        const task = ops.getJson(tKey) as TaskRecord | null;
        if (task && task.status !== "superseded") {
          ops.setJson(tKey, {
            ...task,
            status: "stale",
            lease_expires_at: null,
            lease_expires_ms: null,
            updated_at: now,
            failure_detail: input.reason,
            validity_rev: input.target_rev,
          });
        }
      }

      const nextTargets = op.targets.map((t, i) =>
        i === tIdx
          ? { ...t, status: "completed" as const, done: true }
          : t,
      );
      const allDone = nextTargets.every(targetDone);
      const nextOp: CascadeOperation = {
        ...op,
        targets: nextTargets,
        status: allDone ? "completed" : "running",
        updated_at: now,
        failure_detail: null,
      };
      ops.setJson(oKey, nextOp);
      return {
        ok: true as const,
        validity_rev: input.target_rev,
        operation: nextOp,
      };
    });
    if (!ran.ok) return ran;
    if (!ran.value.ok) {
      return { ok: false, code: ran.value.code, detail: ran.value.detail };
    }
    return {
      ok: true,
      value: {
        validity_rev: ran.value.validity_rev,
        idempotent: ran.value.idempotent,
        operation: ran.value.operation,
      },
    };
  }

  const evaled = await evalTxn(
    APPLY_CASCADE_TARGET_LUA,
    [cKey, fKey, pKey, oKey],
    [
      input.report_id.trim(),
      input.generation_id.trim(),
      String(input.generation_epoch),
      input.page_id,
      input.reason,
      now,
      String(ttlSeconds()),
      String(input.expected_old_rev),
      String(input.target_rev),
      input.operation_id,
    ],
  );
  if (!evaled.ok) {
    return {
      ok: false,
      code: evaled.code,
      detail: `applyCascadeTarget lua failed: ${evaled.detail}`,
    };
  }
  const code = Number(evaled.value);
  const mapped = mapApplyCascadeTargetCode(code);
  if (!mapped.ok) return mapped;
  // Re-read op after Lua for caller consistency.
  const { readCascadeOperation } = await import("./cascade-operation");
  const op = await readCascadeOperation(
    input.report_id,
    input.generation_id,
    input.operation_id,
  );
  if (!op.ok) return op;
  return {
    ok: true,
    value: {
      validity_rev:
        mapped.value.idempotent && mapped.value.validity_rev < 0
          ? input.target_rev
          : mapped.value.validity_rev,
      idempotent: mapped.value.idempotent,
      operation: op.value,
    },
  };
}
