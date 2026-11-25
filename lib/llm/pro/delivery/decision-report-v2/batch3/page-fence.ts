/**
 * Per-page validity fence — monotonic validity_rev gates commits vs invalidation.
 * reopen: stale → open at current rev only (never resets rev; never revives old attempt).
 */

import { reportPageDefinition } from "../orchestration";
import type {
  ReportPageId,
  ReportUpstreamOutputFingerprints,
} from "../orchestration/types";
import { batch3NowIso } from "./clock";
import {
  finalizationClaimKey,
  FINALIZATION_LOCK_LUA_SNIPPET,
  inspectFinalizationLock,
} from "./finalization-lock";
import { canTransitionFence } from "./generation-transitions";
import { generationStoreKeys } from "./generation-store";
import {
  casSet,
  evalTxn,
  isBatch3SharedStoreAvailable,
  isMemoryAtomicAvailable,
  kvGet,
  kvUnavailable,
  runMemoryAtomic,
  trackBatch3Key,
  ttlSeconds,
} from "./kv-cas";
import type { Batch3Result, CascadeOperation, PageFence } from "./types";

/**
 * Lua: KEYS[1]=fence, KEYS[2]=active, KEYS[3]=claim, KEYS[4]=cascadeActive
 * ARGV: expectGenId, expectEpoch, expectRev, reportId, nowIso, ttl
 * Returns 1 ok; negatives fail-closed (see mapReopenLuaCode).
 */
export const REOPEN_LUA = `
local fenceKey = KEYS[1]
local activeKey = KEYS[2]
local claimKey = KEYS[3]
local cascadeActiveKey = KEYS[4]
local expectGenId = ARGV[1]
local expectEpoch = tonumber(ARGV[2])
local expectRev = tonumber(ARGV[3])
local reportId = ARGV[4]
local nowIso = ARGV[5]
local ttl = tonumber(ARGV[6])

if not expectEpoch or not expectRev or not ttl or type(expectGenId) ~= "string"
  or type(reportId) ~= "string" then
  return -12
end

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

local cascIdCur = redis.call("GET", cascadeActiveKey)
if cascIdCur ~= false and cascIdCur ~= nil then
  local cascId = cascIdCur
  if type(cascIdCur) == "string" then
    local cok, decoded = pcall(cjson.decode, cascIdCur)
    if cok and type(decoded) == "string" then cascId = decoded end
    if cok and type(decoded) ~= "string" and type(decoded) ~= "table" then cascId = cascIdCur end
  end
  if type(cascId) == "string" then
    local q = string.match(cascId, '^"(.*)"$')
    if q then cascId = q end
  end
  if type(cascId) == "string" and #cascId > 0 then
    local opKey = "report-batch3:" .. reportId .. ":" .. expectGenId .. ":cascade:" .. cascId
    local opCur = redis.call("GET", opKey)
    if opCur ~= false and opCur ~= nil then
      local ook, op = pcall(cjson.decode, opCur)
      if not ook or type(op) ~= "table" then return -6 end
      if op.status == "running" or op.status == "failed_recoverable" then
        return -6
      end
    end
  end
end

local fcur = redis.call("GET", fenceKey)
if fcur == false or fcur == nil then return -2 end
local fok, fence = pcall(cjson.decode, fcur)
if not fok or not fence then return -11 end
if fence.status == "open" then return 1 end
if fence.status ~= "stale" then return -3 end
if tonumber(fence.validity_rev) ~= expectRev then return -3 end

fence.status = "open"
fence.attempt_id = cjson.null
fence.task_key = cjson.null
fence.input_fingerprint = cjson.null
fence.upstream_output_fingerprints = cjson.null
fence.output_fingerprint = cjson.null
fence.updated_at = nowIso

redis.call("SET", fenceKey, cjson.encode(fence), "EX", ttl)
return 1
`;

export function mapReopenLuaCode(code: number): Batch3Result<PageFence> {
  if (code === 1) {
    return {
      ok: false,
      code: "conflict",
      detail: "reopen lua ok but fence not returned inline",
    };
  }
  if (code === -1) {
    return {
      ok: false,
      code: "stale_generation",
      detail: "reopen refused: active generation mismatch",
    };
  }
  if (code === -2) {
    return { ok: false, code: "not_found", detail: "fence missing for reopen" };
  }
  if (code === -3) {
    return {
      ok: false,
      code: "stale_page",
      detail: "reopen refused: fence not stale or validity_rev advanced",
    };
  }
  if (code === -6) {
    return {
      ok: false,
      code: "cascade_incomplete",
      detail: "reopen refused: cascade running or failed_recoverable",
    };
  }
  if (code === -10) {
    return {
      ok: false,
      code: "finalization_locked",
      detail: "reopen refused: finalization locks page content",
    };
  }
  if (code === -11) {
    return {
      ok: false,
      code: "conflict",
      detail: "reopen refused: fence undecodable",
    };
  }
  if (code === -12) {
    return {
      ok: false,
      code: "conflict",
      detail: "reopen refused: bad lua args",
    };
  }
  if (code === -13) {
    return {
      ok: false,
      code: "conflict",
      detail: "reopen refused: finalization claim present but unusable",
    };
  }
  return {
    ok: false,
    code: "conflict",
    detail: `reopen refused: unknown lua code=${String(code)}`,
  };
}

export function pageFenceKey(
  report_id: string,
  generation_id: string,
  page_id: ReportPageId,
): string {
  return `report-batch3:${report_id.trim()}:${generation_id.trim()}:fence:${page_id}`;
}

export async function readPageFence(
  report_id: string,
  generation_id: string,
  page_id: ReportPageId,
): Promise<Batch3Result<PageFence | null>> {
  return kvGet<PageFence>(pageFenceKey(report_id, generation_id, page_id));
}

/** Ensure an open fence exists; returns current fence (rev unchanged if present). */
export async function ensurePageFence(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  page_id: ReportPageId;
}): Promise<Batch3Result<PageFence>> {
  if (!isBatch3SharedStoreAvailable()) return kvUnavailable();
  const key = pageFenceKey(input.report_id, input.generation_id, input.page_id);
  trackBatch3Key(key);
  const cur = await kvGet<PageFence>(key);
  if (!cur.ok) return cur;
  if (cur.value) return { ok: true, value: cur.value };

  const fence: PageFence = {
    report_id: input.report_id.trim(),
    generation_id: input.generation_id.trim(),
    generation_epoch: input.generation_epoch,
    page_id: input.page_id,
    validity_rev: 0,
    status: "open",
    attempt_id: null,
    task_key: null,
    input_fingerprint: null,
    upstream_output_fingerprints: null,
    output_fingerprint: null,
    updated_at: batch3NowIso(),
  };
  const created = await casSet(key, null, fence);
  if (!created.ok) {
    if (created.code === "conflict") {
      const again = await kvGet<PageFence>(key);
      if (!again.ok) return again;
      if (again.value) return { ok: true, value: again.value };
    }
    return created;
  }
  return { ok: true, value: fence };
}

/**
 * If fence is stale and all required upstream fences are committed,
 * atomically reopen at the **current** validity_rev (clears attempt ownership).
 * Concurrent invalidation that bumps rev first wins — reopen then fails.
 */
export async function reopenStaleFenceIfReady(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  page_id: ReportPageId;
}): Promise<Batch3Result<PageFence>> {
  if (!isBatch3SharedStoreAvailable()) return kvUnavailable();
  const fKey = pageFenceKey(
    input.report_id,
    input.generation_id,
    input.page_id,
  );
  const { cascadeActiveKey, cascadeOpKey } = await import("./cascade-operation");
  const cKey = finalizationClaimKey(input.report_id, input.generation_id);
  const aKey = generationStoreKeys.activeKey(input.report_id);
  const casKey = cascadeActiveKey(input.report_id, input.generation_id);
  trackBatch3Key(fKey);
  trackBatch3Key(cKey);
  trackBatch3Key(aKey);
  trackBatch3Key(casKey);

  const cur = await kvGet<PageFence>(fKey);
  if (!cur.ok) return cur;
  if (!cur.value) {
    return { ok: false, code: "not_found", detail: "fence missing for reopen" };
  }
  if (cur.value.status === "open" || cur.value.status === "claimed") {
    return { ok: true, value: cur.value };
  }
  if (cur.value.status === "committed") {
    return { ok: true, value: cur.value };
  }
  if (cur.value.status !== "stale") {
    return {
      ok: false,
      code: "conflict",
      detail: `cannot reopen fence status=${cur.value.status}`,
    };
  }

  // Required upstreams must be committed at their current revs.
  const def = reportPageDefinition(input.page_id);
  for (const up of def.required_upstream) {
    const upFence = await readPageFence(
      input.report_id,
      input.generation_id,
      up,
    );
    if (!upFence.ok) return upFence;
    if (!upFence.value || upFence.value.status !== "committed") {
      return {
        ok: false,
        code: "deps_unmet",
        detail: `required upstream ${up} not committed for reopen`,
      };
    }
  }

  const expectedRev = cur.value.validity_rev;
  const now = batch3NowIso();

  if (isMemoryAtomicAvailable()) {
    const ran = runMemoryAtomic((ops) => {
      const lock = inspectFinalizationLock(ops.getJson(cKey));
      if (lock.kind === "locked" || lock.kind === "unusable") {
        return {
          ok: false as const,
          code: "finalization_locked" as const,
          detail: "reopen refused: finalization locks page content",
        };
      }
      const cascActiveId = ops.getJson(casKey) as string | null;
      if (cascActiveId) {
        const opRaw = ops.getJson(
          cascadeOpKey(input.report_id, input.generation_id, cascActiveId),
        ) as CascadeOperation | null;
        if (
          opRaw &&
          (opRaw.status === "running" || opRaw.status === "failed_recoverable")
        ) {
          return {
            ok: false as const,
            code: "cascade_incomplete" as const,
            detail: `reopen refused: cascade ${cascActiveId} status=${opRaw.status}`,
          };
        }
      }
      const fence = ops.getJson(fKey) as PageFence | null;
      if (!fence) {
        return {
          ok: false as const,
          code: "not_found" as const,
          detail: "fence missing",
        };
      }
      if (fence.status !== "stale") {
        if (fence.status === "open") {
          return { ok: true as const, fence };
        }
        return {
          ok: false as const,
          code: "conflict" as const,
          detail: `reopen race: status=${fence.status}`,
        };
      }
      if (fence.validity_rev !== expectedRev) {
        return {
          ok: false as const,
          code: "stale_page" as const,
          detail: "reopen refused: validity_rev advanced (invalidation won)",
        };
      }
      if (!canTransitionFence("stale", "open")) {
        return {
          ok: false as const,
          code: "conflict" as const,
          detail: "illegal fence transition",
        };
      }
      const next: PageFence = {
        ...fence,
        status: "open",
        attempt_id: null,
        task_key: null,
        input_fingerprint: null,
        upstream_output_fingerprints: null,
        output_fingerprint: null,
        updated_at: now,
      };
      ops.setJson(fKey, next, ttlSeconds());
      return { ok: true as const, fence: next };
    });
    if (!ran.ok) return ran;
    if (!ran.value.ok) {
      return { ok: false, code: ran.value.code, detail: ran.value.detail };
    }
    return { ok: true, value: ran.value.fence };
  }

  const evaled = await evalTxn(
    REOPEN_LUA,
    [fKey, aKey, cKey, casKey],
    [
      input.generation_id.trim(),
      String(input.generation_epoch),
      String(expectedRev),
      input.report_id.trim(),
      now,
      String(ttlSeconds()),
    ],
  );
  if (!evaled.ok) {
    return {
      ok: false,
      code: evaled.code,
      detail: `reopen lua failed: ${evaled.detail}`,
    };
  }
  const code = Number(evaled.value);
  if (!Number.isFinite(code)) {
    return {
      ok: false,
      code: "conflict",
      detail: `reopen non-numeric lua=${String(evaled.value)}`,
    };
  }
  if (code !== 1) {
    return mapReopenLuaCode(code);
  }
  const after = await kvGet<PageFence>(fKey);
  if (!after.ok) return after;
  if (!after.value) {
    return {
      ok: false,
      code: "not_found",
      detail: "fence missing after reopen lua",
    };
  }
  return { ok: true, value: after.value };
}

export function fingerprintsMatch(
  expected: ReportUpstreamOutputFingerprints | null | undefined,
  actual: ReportUpstreamOutputFingerprints | null | undefined,
): boolean {
  const a = expected ?? {};
  const b = actual ?? {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if ((a as Record<string, string>)[k] !== (b as Record<string, string>)[k]) {
      return false;
    }
  }
  return true;
}
