/**
 * DAG-based invalidation — reuses Batch1 registry; bumps page fence rev so
 * late commits cannot restore invalidated pages.
 *
 * R5/R6: refuse invalidation when a Finalization Claim is sealed (or
 * unusable) for the generation — atomic mutual exclusion with claimFinalization.
 */

import {
  bindPageValidityRev,
  getJob,
  saveJob,
  updatePageState,
} from "../batch2/job-store";
import { REPORT_PAGE_IDS } from "../orchestration";
import type { ReportPageId } from "../orchestration/types";
import { inspectFinalizationClaimValue } from "./claim-inspect";
import {
  finalizationClaimKey,
  FINALIZATION_LOCK_LUA_SNIPPET,
  inspectFinalizationLock,
} from "./finalization-lock";
import type { FinalizationClaim } from "./finalization";
import { assertGenerationActive } from "./generation-store";
import {
  evalTxn,
  isMemoryAtomicAvailable,
  kvGet,
  runMemoryAtomic,
  trackBatch3Key,
  ttlSeconds,
} from "./kv-cas";
import { pageFenceKey } from "./page-fence";
import { readPageProvenance } from "./provenance";
import type {
  Batch3Result,
  CascadeOperation,
  PageFence,
  PageProvenance,
  TaskRecord,
} from "./types";
import { randomUUID } from "node:crypto";

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

/** Test hook: await before entering MemoryKv/Redis atomic invalidate. */
let beforeInvalidateAtomicHook: (() => Promise<void>) | null = null;

export function setBeforeInvalidateAtomicHookForTests(
  hook: (() => Promise<void>) | null,
): void {
  beforeInvalidateAtomicHook = hook;
}

/**
 * Lua: KEYS[1]=claim, KEYS[2]=fence, KEYS[3]=prov, KEYS[4]=taskPlaceholder
 * ARGV[1]=report_id, ARGV[2]=generation_id, ARGV[3]=epoch, ARGV[4]=page_id,
 * ARGV[5]=reason, ARGV[6]=nowIso, ARGV[7]=ttl
 *
 * Returns: nextRev (>=0) on success
 *  -10 finalization_locked (status claimed)
 *  -11 fence decode fail (fail closed)
 *  -12 unknown / bad args
 *  -13 claim present but unusable (decode fail / unknown status / incomplete)
 */
export const INVALIDATE_LUA = `
local claimKey = KEYS[1]
local fenceKey = KEYS[2]
local provKey = KEYS[3]
local taskKey = KEYS[4]
local reportId = ARGV[1]
local genId = ARGV[2]
local epoch = tonumber(ARGV[3])
local pageId = ARGV[4]
local reason = ARGV[5]
local nowIso = ARGV[6]
local ttl = tonumber(ARGV[7])
if not epoch or not ttl or type(reportId) ~= "string" or type(genId) ~= "string" then
  return -12
end

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
local nextRev = curRev + 1

local nextFence = {
  report_id = reportId,
  generation_id = genId,
  generation_epoch = epoch,
  page_id = pageId,
  validity_rev = nextRev,
  status = "stale",
  attempt_id = cjson.null,
  task_key = cjson.null,
  input_fingerprint = cjson.null,
  upstream_output_fingerprints = cjson.null,
  output_fingerprint = cjson.null,
  updated_at = nowIso
}
redis.call("SET", fenceKey, cjson.encode(nextFence), "EX", ttl)

local pcur = redis.call("GET", provKey)
if pcur ~= false and pcur ~= nil then
  local pok, prov = pcall(cjson.decode, pcur)
  if pok and prov then
    prov.stale = true
    prov.stale_reason = reason
    prov.validity_rev = nextRev
    redis.call("SET", provKey, cjson.encode(prov), "EX", ttl)
  end
end

local tcur = redis.call("GET", taskKey)
if tcur ~= false and tcur ~= nil then
  local tok, task = pcall(cjson.decode, tcur)
  if tok and task and task.status ~= "superseded" then
    task.status = "stale"
    task.lease_expires_at = cjson.null
    task.updated_at = nowIso
    task.failure_detail = reason
    task.validity_rev = nextRev
    redis.call("SET", taskKey, cjson.encode(task), "EX", ttl)
  end
end

return nextRev
`;

export function mapInvalidateLuaCode(
  code: number,
): Batch3Result<{ validity_rev: number }> {
  if (Number.isFinite(code) && code >= 0) {
    return { ok: true, value: { validity_rev: code } };
  }
  if (code === -10) {
    return {
      ok: false,
      code: "finalization_locked",
      detail: "invalidation refused: finalization claim sealed for generation",
    };
  }
  if (code === -11) {
    return {
      ok: false,
      code: "conflict",
      detail: "invalidation refused: fence undecodable",
    };
  }
  if (code === -12) {
    return {
      ok: false,
      code: "conflict",
      detail: "invalidation refused: bad lua args",
    };
  }
  if (code === -13) {
    return {
      ok: false,
      code: "conflict",
      detail:
        "invalidation refused: finalization claim present but unusable (fail-closed)",
    };
  }
  return {
    ok: false,
    code: "conflict",
    detail: `invalidation refused: unknown lua code=${String(code)}`,
  };
}

function refuseUnusableClaim(reason: string): Batch3Result<never> {
  return {
    ok: false,
    code: "conflict",
    detail: `invalidation refused: ${reason}`,
  };
}

/**
 * Atomically bump page fence validity_rev, mark stale, invalidate provenance,
 * and stale the bound task attempt — refused if finalization claim exists
 * or is present-but-unusable (fail-closed).
 */
export async function invalidatePageAuthority(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  page_id: ReportPageId;
  reason: string;
}): Promise<Batch3Result<{ validity_rev: number }>> {
  const fKey = pageFenceKey(input.report_id, input.generation_id, input.page_id);
  const pKey = provKey(input.report_id, input.generation_id, input.page_id);
  const cKey = finalizationClaimKey(input.report_id, input.generation_id);
  trackBatch3Key(fKey);
  trackBatch3Key(pKey);
  trackBatch3Key(cKey);

  if (beforeInvalidateAtomicHook) {
    await beforeInvalidateAtomicHook();
  }

  if (isMemoryAtomicAvailable()) {
    const ran = runMemoryAtomic((ops) => {
      const claimRaw = ops.getJson(cKey);
      const lock = inspectFinalizationLock(claimRaw);
      if (lock.kind === "locked") {
        return {
          ok: false as const,
          code: "finalization_locked" as const,
          detail:
            "invalidation refused: finalization locks page content",
        };
      }
      if (lock.kind === "unusable") {
        return {
          ok: false as const,
          code: "conflict" as const,
          detail: `invalidation refused: ${lock.reason}`,
        };
      }

      const now = new Date().toISOString();
      const cur = ops.getJson(fKey) as PageFence | null;
      const nextRev = (cur?.validity_rev ?? 0) + 1;
      const fence: PageFence = {
        report_id: input.report_id.trim(),
        generation_id: input.generation_id.trim(),
        generation_epoch: input.generation_epoch,
        page_id: input.page_id,
        validity_rev: nextRev,
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
      if (prov) {
        ops.setJson(pKey, {
          ...prov,
          stale: true,
          stale_reason: input.reason,
          validity_rev: nextRev,
        });
        if (prov.task_key) {
          const tKey = taskKeyPath(
            input.report_id,
            input.generation_id,
            prov.task_key,
          );
          trackBatch3Key(tKey);
          const task = ops.getJson(tKey) as TaskRecord | null;
          if (task && task.status !== "superseded") {
            ops.setJson(tKey, {
              ...task,
              status: "stale",
              lease_expires_at: null,
              updated_at: now,
              failure_detail: input.reason,
              validity_rev: nextRev,
            });
          }
        }
      } else if (cur?.task_key) {
        const tKey = taskKeyPath(
          input.report_id,
          input.generation_id,
          cur.task_key,
        );
        trackBatch3Key(tKey);
        const task = ops.getJson(tKey) as TaskRecord | null;
        if (task) {
          ops.setJson(tKey, {
            ...task,
            status: "stale",
            lease_expires_at: null,
            updated_at: now,
            failure_detail: input.reason,
            validity_rev: nextRev,
          });
        }
      }

      return { ok: true as const, validity_rev: nextRev };
    });
    if (!ran.ok) return ran;
    if (!ran.value.ok) {
      return { ok: false, code: ran.value.code, detail: ran.value.detail };
    }
    return { ok: true, value: { validity_rev: ran.value.validity_rev } };
  }

  // Redis: single Lua — claim check + fence/prov/task update (no GET→CAS gap).
  const preFence = await kvGet<PageFence>(fKey);
  if (!preFence.ok) return preFence;
  const preProv = await kvGet<PageProvenance>(pKey);
  if (!preProv.ok) return preProv;
  const boundTask =
    preProv.value?.task_key || preFence.value?.task_key || null;
  const taskKeyStr = boundTask
    ? taskKeyPath(input.report_id, input.generation_id, boundTask)
    : `report-batch3:${input.report_id.trim()}:${input.generation_id.trim()}:task:__absent__`;
  trackBatch3Key(taskKeyStr);

  const now = new Date().toISOString();
  const evaled = await evalTxn(
    INVALIDATE_LUA,
    [cKey, fKey, pKey, taskKeyStr],
    [
      input.report_id.trim(),
      input.generation_id.trim(),
      String(input.generation_epoch),
      input.page_id,
      input.reason,
      now,
      String(ttlSeconds()),
    ],
  );
  if (!evaled.ok) {
    return {
      ok: false,
      code: evaled.code,
      detail: `invalidation lua failed: ${evaled.detail}`,
    };
  }
  const code = Number(evaled.value);
  if (!Number.isFinite(code)) {
    return {
      ok: false,
      code: "conflict",
      detail: `invalidation non-numeric lua=${String(evaled.value)}`,
    };
  }
  return mapInvalidateLuaCode(code);
}

/**
 * Mark source page + DAG dependents as stale via a frozen CascadeOperation.
 * Optional consumers (Page02←01) invalidate only when provenance consumed that upstream.
 * If a finalization claim is sealed or unusable, refuse before any fence bump.
 * Recovery continues mid-cascade via continueCascadeOperation (targets not recomputed).
 */
export async function invalidateFromPage(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  source_page_id: ReportPageId;
  reason: string;
}): Promise<
  Batch3Result<{
    invalidated: ReportPageId[];
    operation_id: string;
    cascade_status: CascadeOperation["status"];
  }>
> {
  // Fast fail finalization lock BEFORE active check — after seal, gen may be
  // `finalizing` and must still report finalization_locked (not stale_generation).
  const claim = await kvGet<FinalizationClaim | unknown>(
    finalizationClaimKey(input.report_id, input.generation_id),
  );
  if (!claim.ok) return claim;
  const inspect = inspectFinalizationClaimValue(claim.value);
  if (inspect.kind === "claimed") {
    return {
      ok: false,
      code: "finalization_locked",
      detail:
        "invalidateFromPage refused: finalization claim sealed for generation",
    };
  }
  if (inspect.kind === "unusable") {
    return refuseUnusableClaim(inspect.reason);
  }

  const fence = await assertGenerationActive({
    report_id: input.report_id,
    generation_id: input.generation_id,
    generation_epoch: input.generation_epoch,
  });
  if (!fence.ok) return fence;

  const {
    planCascadePageIds,
    buildFrozenCascadeTargets,
    saveCascadeOperation,
  } = await import("./cascade-operation");

  const planned = await planCascadePageIds({
    report_id: input.report_id,
    generation_id: input.generation_id,
    source_page_id: input.source_page_id,
    shouldIncludeOptional: async (dep, upstream) => {
      const prov = await readPageProvenance(
        input.report_id,
        input.generation_id,
        dep,
      );
      if (!prov.ok) return prov;
      return {
        ok: true,
        value: !!prov.value?.upstream_output_fingerprints?.[upstream],
      };
    },
  });
  if (!planned.ok) return planned;

  const targets = await buildFrozenCascadeTargets({
    report_id: input.report_id,
    generation_id: input.generation_id,
    page_ids: planned.value,
  });
  if (!targets.ok) return targets;

  const now = new Date().toISOString();
  const operation_id = randomUUID();
  let op: CascadeOperation = {
    operation_id,
    report_id: input.report_id.trim(),
    generation_id: input.generation_id.trim(),
    generation_epoch: input.generation_epoch,
    source_page_id: input.source_page_id,
    reason: input.reason,
    targets: targets.value,
    status: "running",
    created_at: now,
    updated_at: now,
  };
  const created = await saveCascadeOperation(op, null);
  if (!created.ok) return created;

  return continueCascadeOperation({
    report_id: input.report_id,
    generation_id: input.generation_id,
    operation_id,
  });
}

/**
 * Continue a frozen CascadeOperation — never recomputes target set.
 * Idempotent per target via expected_old_rev → target_rev.
 */
export async function continueCascadeOperation(input: {
  report_id: string;
  generation_id: string;
  operation_id: string;
}): Promise<
  Batch3Result<{
    invalidated: ReportPageId[];
    operation_id: string;
    cascade_status: CascadeOperation["status"];
  }>
> {
  const {
    readCascadeOperation,
    saveCascadeOperation,
    isCascadeTargetSatisfied,
  } = await import("./cascade-operation");

  const loaded = await readCascadeOperation(
    input.report_id,
    input.generation_id,
    input.operation_id,
  );
  if (!loaded.ok) return loaded;
  if (!loaded.value) {
    return {
      ok: false,
      code: "not_found",
      detail: `cascade ${input.operation_id} missing`,
    };
  }

  let op = loaded.value;
  if (op.status === "completed") {
    return {
      ok: true,
      value: {
        invalidated: op.targets.filter((t) => t.done).map((t) => t.page_id),
        operation_id: op.operation_id,
        cascade_status: "completed",
      },
    };
  }

  const job = await getJob(input.report_id, input.generation_id);
  if (!job) {
    return { ok: false, code: "not_found", detail: "job missing for cascade" };
  }

  const invalidated: ReportPageId[] = [];
  const prevJson = JSON.stringify(op);

  for (let i = 0; i < op.targets.length; i++) {
    const target = op.targets[i]!;
    if (target.done) {
      invalidated.push(target.page_id);
      continue;
    }

    const satisfied = await isCascadeTargetSatisfied({
      report_id: input.report_id,
      generation_id: input.generation_id,
      target,
    });
    if (!satisfied.ok) return satisfied;
    if (satisfied.value) {
      op = {
        ...op,
        targets: op.targets.map((t, idx) =>
          idx === i ? { ...t, done: true } : t,
        ),
        updated_at: new Date().toISOString(),
      };
      invalidated.push(target.page_id);
      continue;
    }

    // Only bump when fence is still at expected_old_rev (or absent at 0).
    const curFence = await kvGet<PageFence>(
      pageFenceKey(input.report_id, input.generation_id, target.page_id),
    );
    if (!curFence.ok) return curFence;
    const curRev = curFence.value?.validity_rev ?? 0;
    if (curRev !== target.expected_old_rev) {
      op = {
        ...op,
        status: "failed_recoverable",
        failure_detail: `page ${target.page_id} rev=${curRev} expected_old=${target.expected_old_rev}`,
        updated_at: new Date().toISOString(),
      };
      const failed = await saveCascadeOperation(op, prevJson);
      if (!failed.ok) return failed;
      return {
        ok: false,
        code: "cascade_incomplete",
        detail: op.failure_detail ?? "cascade target rev mismatch",
      };
    }

    const auth = await invalidatePageAuthority({
      report_id: input.report_id,
      generation_id: input.generation_id,
      generation_epoch: op.generation_epoch,
      page_id: target.page_id,
      reason: `${op.reason} (cascade ${op.operation_id} from ${op.source_page_id})`,
    });
    if (!auth.ok) {
      op = {
        ...op,
        status: "failed_recoverable",
        failure_detail: `${auth.code}:${auth.detail}`,
        updated_at: new Date().toISOString(),
      };
      await saveCascadeOperation(op, prevJson);
      return auth;
    }

    if (auth.value.validity_rev !== target.target_rev) {
      op = {
        ...op,
        status: "failed_recoverable",
        failure_detail: `page ${target.page_id} bumped to ${auth.value.validity_rev} want ${target.target_rev}`,
        updated_at: new Date().toISOString(),
      };
      await saveCascadeOperation(op, prevJson);
      return {
        ok: false,
        code: "cascade_incomplete",
        detail: op.failure_detail ?? "target_rev mismatch after invalidate",
      };
    }

    updatePageState(job, target.page_id, {
      outcome: "pending",
      output_fingerprint: undefined,
      applicability_status: target.page_id === "07" ? null : undefined,
    });
    delete job.page_outputs[target.page_id];
    bindPageValidityRev(job, target.page_id, auth.value.validity_rev, null);

    op = {
      ...op,
      targets: op.targets.map((t, idx) =>
        idx === i ? { ...t, done: true } : t,
      ),
      updated_at: new Date().toISOString(),
    };
    invalidated.push(target.page_id);
  }

  const allDone = op.targets.every((t) => t.done);
  op = {
    ...op,
    status: allDone ? "completed" : "running",
    updated_at: new Date().toISOString(),
    failure_detail: allDone ? null : op.failure_detail,
  };

  const savedOp = await saveCascadeOperation(op, prevJson);
  if (!savedOp.ok) return savedOp;

  const saved = await saveJob(job);
  if (!saved.ok) {
    return {
      ok: false,
      code: saved.code === "kv_unavailable" ? "kv_unavailable" : "kv_write_failed",
      detail: saved.detail,
    };
  }

  return {
    ok: true,
    value: {
      invalidated,
      operation_id: op.operation_id,
      cascade_status: op.status,
    },
  };
}

export function allReportPageIds(): readonly ReportPageId[] {
  return REPORT_PAGE_IDS;
}
