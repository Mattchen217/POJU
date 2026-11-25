/**
 * DAG-based invalidation — reuses Batch1 registry; bumps page fence rev so
 * late commits cannot restore invalidated pages.
 *
 * R5: refuse invalidation when a Finalization Claim is sealed for the
 * generation (atomic mutual exclusion with claimFinalization).
 */

import {
  bindPageValidityRev,
  getJob,
  saveJob,
  updatePageState,
} from "../batch2/job-store";
import {
  REPORT_PAGE_IDS,
  REPORT_PAGE_REGISTRY,
} from "../orchestration";
import type { ReportPageId } from "../orchestration/types";
import { finalizationClaimKey, type FinalizationClaim } from "./finalization";
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
import type { Batch3Result, PageFence, PageProvenance, TaskRecord } from "./types";

function requiredDependentsOf(page_id: ReportPageId): ReportPageId[] {
  const out: ReportPageId[] = [];
  for (const def of REPORT_PAGE_REGISTRY) {
    if ((def.required_upstream as readonly string[]).includes(page_id)) {
      out.push(def.page_id);
    }
  }
  return out;
}

function optionalDependentsOf(page_id: ReportPageId): ReportPageId[] {
  const out: ReportPageId[] = [];
  for (const def of REPORT_PAGE_REGISTRY) {
    if ((def.optional_upstream as readonly string[]).includes(page_id)) {
      out.push(def.page_id);
    }
  }
  return out;
}

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

/**
 * Lua: KEYS[1]=claim, KEYS[2]=fence, KEYS[3]=prov, KEYS[4]=taskPlaceholder
 * ARGV[1]=report_id, ARGV[2]=generation_id, ARGV[3]=epoch, ARGV[4]=page_id,
 * ARGV[5]=reason, ARGV[6]=nowIso, ARGV[7]=ttl, ARGV[8]=taskKeyPrefix
 *
 * Returns: nextRev (>=0) on success
 *  -10 finalization_locked
 *  -11 fence decode fail (fail closed)
 *  -12 unknown / bad args
 *
 * Task key is derived inside the script from fence/prov; KEYS[4] is the
 * precomputed task key when known, else empty string and script skips task.
 * Caller passes best-effort task key from a pre-read; script re-reads fence
 * and only updates task if KEYS[4] matches fence.task_key or prov.task_key.
 */
const INVALIDATE_LUA = `
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

local claimCur = redis.call("GET", claimKey)
if claimCur ~= false and claimCur ~= nil then
  local cok, claim = pcall(cjson.decode, claimCur)
  if cok and claim and claim.status == "claimed" then
    return -10
  end
end

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
  task_key = curTask,
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

function mapInvalidateLuaCode(
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
  return {
    ok: false,
    code: "conflict",
    detail: `invalidation refused: unknown lua code=${String(code)}`,
  };
}

/**
 * Atomically bump page fence validity_rev, mark stale, invalidate provenance,
 * and stale the bound task attempt — refused if finalization claim exists.
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

  if (isMemoryAtomicAvailable()) {
    const ran = runMemoryAtomic((ops) => {
      const claim = ops.getJson(cKey) as FinalizationClaim | null;
      if (claim?.status === "claimed") {
        return {
          ok: false as const,
          code: "finalization_locked" as const,
          detail:
            "invalidation refused: finalization claim sealed for generation",
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
        task_key: cur?.task_key ?? null,
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
 * Mark source page + DAG dependents as stale.
 * Optional consumers (Page02←01) invalidate only when provenance consumed that upstream.
 * If a finalization claim is sealed, the first page authority bump fails closed
 * and no partial cascade is applied.
 */
export async function invalidateFromPage(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  source_page_id: ReportPageId;
  reason: string;
}): Promise<Batch3Result<{ invalidated: ReportPageId[] }>> {
  const fence = await assertGenerationActive({
    report_id: input.report_id,
    generation_id: input.generation_id,
    generation_epoch: input.generation_epoch,
  });
  if (!fence.ok) return fence;

  // Fast fail: sealed claim blocks the entire cascade (no partial fence bumps).
  const claim = await kvGet<FinalizationClaim>(
    finalizationClaimKey(input.report_id, input.generation_id),
  );
  if (!claim.ok) return claim;
  if (claim.value?.status === "claimed") {
    return {
      ok: false,
      code: "finalization_locked",
      detail:
        "invalidateFromPage refused: finalization claim sealed for generation",
    };
  }

  const job = await getJob(input.report_id, input.generation_id);
  if (!job) {
    return { ok: false, code: "not_found", detail: "job missing for invalidation" };
  }

  const visited = new Set<ReportPageId>();
  const queue: ReportPageId[] = [input.source_page_id];

  while (queue.length) {
    const page_id = queue.shift()!;
    if (visited.has(page_id)) continue;
    visited.add(page_id);

    const auth = await invalidatePageAuthority({
      report_id: input.report_id,
      generation_id: input.generation_id,
      generation_epoch: input.generation_epoch,
      page_id,
      reason: `${input.reason} (from ${input.source_page_id})`,
    });
    if (!auth.ok) return auth;

    updatePageState(job, page_id, {
      outcome: "pending",
      output_fingerprint: undefined,
      applicability_status: page_id === "07" ? null : undefined,
    });
    delete job.page_outputs[page_id];
    bindPageValidityRev(job, page_id, auth.value.validity_rev, null);

    for (const dep of requiredDependentsOf(page_id)) {
      if (!visited.has(dep)) queue.push(dep);
    }

    for (const dep of optionalDependentsOf(page_id)) {
      if (visited.has(dep)) continue;
      const prov = await readPageProvenance(
        input.report_id,
        input.generation_id,
        dep,
      );
      if (!prov.ok) return prov;
      const consumed = prov.value?.upstream_output_fingerprints?.[page_id];
      if (consumed) {
        queue.push(dep);
      }
    }
  }

  const saved = await saveJob(job);
  if (!saved.ok) {
    return {
      ok: false,
      code: saved.code === "kv_unavailable" ? "kv_unavailable" : "kv_write_failed",
      detail: saved.detail,
    };
  }

  return { ok: true, value: { invalidated: [...visited] } };
}

export function allReportPageIds(): readonly ReportPageId[] {
  return REPORT_PAGE_IDS;
}
