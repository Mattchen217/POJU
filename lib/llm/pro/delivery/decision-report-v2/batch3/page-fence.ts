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
import type {
  ActiveGenerationPointer,
  Batch3Result,
  CascadeOperation,
  GenerationRecord,
  PageFence,
} from "./types";

const GEN_NOT_ACTIVE_FOR_REOPEN = new Set([
  "finalizing",
  "delivery_failed",
  "completed",
  "superseded",
]);

/**
 * Lua: KEYS[1]=fence KEYS[2]=active KEYS[3]=claim KEYS[4]=cascadeActive KEYS[5]=gen
 *      KEYS[6..]=required upstream fence keys
 * ARGV: expectGenId, expectEpoch, expectRev, reportId, pageId, nowIso, ttl, upstreamCount
 * Returns 1 reopened, 2 already open/claimable; negatives fail-closed (mapReopenLuaCode).
 */
export const REOPEN_LUA = `
local fenceKey = KEYS[1]
local activeKey = KEYS[2]
local claimKey = KEYS[3]
local cascadeActiveKey = KEYS[4]
local genKey = KEYS[5]
local expectGenId = ARGV[1]
local expectEpoch = tonumber(ARGV[2])
local expectRev = tonumber(ARGV[3])
local reportId = ARGV[4]
local pageId = ARGV[5]
local nowIso = ARGV[6]
local ttl = tonumber(ARGV[7])
local upstreamCount = tonumber(ARGV[8])

if not expectEpoch or expectRev == nil or not ttl or not upstreamCount
  or type(expectGenId) ~= "string" or type(reportId) ~= "string"
  or type(pageId) ~= "string" or type(nowIso) ~= "string" then
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

local gcur = redis.call("GET", genKey)
if gcur == false or gcur == nil then return -1 end
local gok, grec = pcall(cjson.decode, gcur)
if not gok or type(grec) ~= "table" then return -1 end
if grec.status ~= "active" then return -1 end

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

for i = 1, upstreamCount do
  local upKey = KEYS[5 + i]
  local upCur = redis.call("GET", upKey)
  if upCur == false or upCur == nil then return -7 end
  local uok, upFence = pcall(cjson.decode, upCur)
  if not uok or type(upFence) ~= "table" then return -7 end
  if upFence.status ~= "committed" then return -7 end
end

local fcur = redis.call("GET", fenceKey)
if fcur == false or fcur == nil then return -8 end
local fok, fence = pcall(cjson.decode, fcur)
if not fok or not fence then return -8 end
-- open/committed: idempotent no-op. claimed: refuse (ownership held — not a reopen).
if fence.status == "open" or fence.status == "committed" then
  return 2
end
if fence.status == "claimed" then return -9 end
if fence.status ~= "stale" then return -8 end
if tonumber(fence.validity_rev) ~= expectRev then return -8 end

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
  if (code === -1) {
    return {
      ok: false,
      code: "stale_generation",
      detail: "reopen refused: active generation mismatch or gen not active",
    };
  }
  if (code === -6) {
    return {
      ok: false,
      code: "cascade_incomplete",
      detail: "reopen refused: cascade running or failed_recoverable",
    };
  }
  if (code === -7) {
    return {
      ok: false,
      code: "dependency_not_ready",
      detail: "reopen refused: required upstream fences not committed",
    };
  }
  if (code === -8) {
    return {
      ok: false,
      code: "stale_page",
      detail: "reopen refused: fence missing, not stale, or validity_rev advanced",
    };
  }
  if (code === -9) {
    return {
      ok: false,
      code: "invalid_state",
      detail: "reopen refused: fence claimed — ownership held",
    };
  }
  if (code === -10) {
    return {
      ok: false,
      code: "finalization_locked",
      detail: "reopen refused: finalization locks page content",
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
 * All gates (active pointer, gen record, fin lock, cascade, upstream deps, fence rev)
 * run inside one MemoryAtomic / Redis Lua.
 */
export async function reopenStaleFenceAtomic(input: {
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
  const gKey = generationStoreKeys.genKey(
    input.report_id,
    input.generation_id,
  );
  const def = reportPageDefinition(input.page_id);
  const upstreamKeys = def.required_upstream.map((up) =>
    pageFenceKey(input.report_id, input.generation_id, up),
  );
  trackBatch3Key(fKey);
  trackBatch3Key(cKey);
  trackBatch3Key(aKey);
  trackBatch3Key(casKey);
  trackBatch3Key(gKey);
  for (const uk of upstreamKeys) trackBatch3Key(uk);

  const cur = await kvGet<PageFence>(fKey);
  if (!cur.ok) return cur;
  const expectedRev = cur.value?.validity_rev ?? 0;
  const now = batch3NowIso();
  const upstreamCount = upstreamKeys.length;

  if (isMemoryAtomicAvailable()) {
    const ran = runMemoryAtomic((ops) => {
      const lock = inspectFinalizationLock(ops.getJson(cKey));
      if (lock.kind === "locked") {
        return {
          ok: false as const,
          code: "finalization_locked" as const,
          detail: "reopen refused: finalization locks page content",
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
          detail: "reopen refused: active generation mismatch",
        };
      }

      const grec = ops.getJson(gKey) as GenerationRecord | null;
      if (!grec || grec.status !== "active") {
        return {
          ok: false as const,
          code:
            grec && GEN_NOT_ACTIVE_FOR_REOPEN.has(grec.status)
              ? ("generation_inactive" as const)
              : ("stale_generation" as const),
          detail: `reopen refused: generation status=${grec?.status ?? "missing"}`,
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

      for (let i = 0; i < def.required_upstream.length; i++) {
        const upId = def.required_upstream[i]!;
        const upFence = ops.getJson(upstreamKeys[i]!) as PageFence | null;
        if (!upFence || upFence.status !== "committed") {
          return {
            ok: false as const,
            code: "dependency_not_ready" as const,
            detail: `required upstream ${upId} not committed for reopen`,
          };
        }
      }

      const fence = ops.getJson(fKey) as PageFence | null;
      if (!fence) {
        return {
          ok: false as const,
          code: "stale_page" as const,
          detail: "fence missing for reopen",
        };
      }
      if (fence.status === "open" || fence.status === "committed") {
        return { ok: true as const, fence, idempotent: true as const };
      }
      if (fence.status === "claimed") {
        return {
          ok: false as const,
          code: "invalid_state" as const,
          detail: "cannot reopen claimed fence — ownership held",
        };
      }
      if (fence.status !== "stale") {
        return {
          ok: false as const,
          code: "stale_page" as const,
          detail: `cannot reopen fence status=${fence.status}`,
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
      return { ok: true as const, fence: next, idempotent: false as const };
    });
    if (!ran.ok) return ran;
    if (!ran.value.ok) {
      return { ok: false, code: ran.value.code, detail: ran.value.detail };
    }
    return { ok: true, value: ran.value.fence };
  }

  const evaled = await evalTxn(
    REOPEN_LUA,
    [fKey, aKey, cKey, casKey, gKey, ...upstreamKeys],
    [
      input.generation_id.trim(),
      String(input.generation_epoch),
      String(expectedRev),
      input.report_id.trim(),
      input.page_id,
      now,
      String(ttlSeconds()),
      String(upstreamCount),
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
  if (code !== 1 && code !== 2) {
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

export const reopenStaleFenceIfReady = reopenStaleFenceAtomic;

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
