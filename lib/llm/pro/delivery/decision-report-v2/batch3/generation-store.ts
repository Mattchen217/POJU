/**
 * Generation fencing — monotonic epoch + atomic active switch.
 */

import { randomUUID } from "node:crypto";

import { durableKv, KV_TTL } from "@/lib/kv/client";
import {
  casSet,
  isBatch3SharedStoreAvailable,
  isMemoryAtomicAvailable,
  kvGet,
  kvUnavailable,
  runMemoryAtomic,
  trackBatch3Key,
  evalTxn,
} from "./kv-cas";
import {
  finalizationClaimKey,
  inspectFinalizationLock,
  mayActivateNextGeneration,
} from "./finalization-lock";
import {
  GENERATION_TERMINAL,
  transitionGenerationStatus as checkGenTransition,
} from "./generation-transitions";
import type {
  ActiveGenerationPointer,
  Batch3Result,
  GenerationRecord,
  GenerationStatus,
} from "./types";

function epochKey(report_id: string): string {
  return `report-batch3:${report_id.trim()}:epoch`;
}

function activeKey(report_id: string): string {
  return `report-batch3:${report_id.trim()}:active`;
}

function genKey(report_id: string, generation_id: string): string {
  return `report-batch3:${report_id.trim()}:gen:${generation_id.trim()}`;
}

function batch2PointerKey(job_id: string): string {
  return `report-batch2-active:${job_id.trim()}`;
}

const TERMINAL = GENERATION_TERMINAL;

/**
 * KEYS[1]=active, KEYS[2]=newGen, KEYS[3]=b2,
 * KEYS[4]=claimPrefixUnused — claim key built inside from live active gen id
 * ARGV: epoch, newGenId, pointerJson, newGenJson, b2Json, ttl, nowIso, reportId
 *
 * Live prev gen key derived INSIDE Lua from current Active Pointer.
 * Finalization lock on live active gen: sealed|delivering|delivery_failed|claimed → -10
 */
const ACTIVATE_LUA = `
local activeKey = KEYS[1]
local newGenKey = KEYS[2]
local b2Key = KEYS[3]
local newEpoch = tonumber(ARGV[1])
local newGenId = ARGV[2]
local newPointerJson = ARGV[3]
local newGenJson = ARGV[4]
local b2Json = ARGV[5]
local ttl = tonumber(ARGV[6])
local nowIso = ARGV[7]
local reportId = ARGV[8]

local cur = redis.call("GET", activeKey)
local live = nil
if cur ~= false and cur ~= nil then
  local ok, decoded = pcall(cjson.decode, cur)
  if ok and decoded then
    live = decoded
    if live.generation_id == newGenId and tonumber(live.generation_epoch) == newEpoch then
      return 1
    end
    if tonumber(live.generation_epoch) >= newEpoch then
      return -1
    end
    -- Shared Finalization lock on the CURRENT active generation.
    local claimKey = "report-batch3:" .. reportId .. ":" .. live.generation_id .. ":finalization"
    local claimCur = redis.call("GET", claimKey)
    if claimCur ~= false and claimCur ~= nil then
      local cok, claim = pcall(cjson.decode, claimCur)
      if not cok or type(claim) ~= "table" then return -13 end
      local st = claim.status
      if st == "sealed" or st == "delivering" or st == "delivery_failed" or st == "claimed" then
        return -10
      end
      if st ~= "delivered" and st ~= nil and st ~= cjson.null then
        if type(st) ~= "string" or st == "" then return -13 end
        if st ~= "delivered" then return -13 end
      end
    end
  end
end

local gcur = redis.call("GET", newGenKey)
if gcur == false or gcur == nil then return -3 end
local gok, grec = pcall(cjson.decode, gcur)
if not gok or not grec then return -3 end
if grec.status == "superseded" or grec.status == "completed" or grec.status == "failed" or grec.status == "cancelled" or grec.status == "finalizing" or grec.status == "delivery_failed" then
  return -2
end

-- Derive prev gen key from LIVE active pointer inside the script.
if live and live.generation_id and live.generation_id ~= newGenId then
  local prevGenKey = "report-batch3:" .. reportId .. ":gen:" .. live.generation_id
  local pcur = redis.call("GET", prevGenKey)
  if pcur ~= false and pcur ~= nil then
    local pok, prev = pcall(cjson.decode, pcur)
    if pok and prev then
      local st = prev.status
      if st ~= "superseded" and st ~= "completed" and st ~= "failed" and st ~= "cancelled" then
        prev.status = "superseded"
        prev.updated_at = nowIso
        prev.superseded_at = nowIso
        prev.superseded_by = newGenId
        redis.call("SET", prevGenKey, cjson.encode(prev), "EX", ttl)
      end
    end
  end
end

redis.call("SET", activeKey, newPointerJson, "EX", ttl)
redis.call("SET", newGenKey, newGenJson, "EX", ttl)
if b2Key ~= "" then
  redis.call("SET", b2Key, b2Json, "EX", ttl)
end
return 1
`;
export async function allocateGeneration(input: {
  report_id: string;
  locale: string;
  generation_id?: string;
}): Promise<Batch3Result<GenerationRecord>> {
  if (!isBatch3SharedStoreAvailable()) return kvUnavailable();
  const report_id = input.report_id.trim();
  const eKey = epochKey(report_id);
  trackBatch3Key(eKey);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const cur = await kvGet<number>(eKey);
    if (!cur.ok) return cur;
    const nextEpoch = (cur.value ?? 0) + 1;
    const expected = cur.value == null ? null : JSON.stringify(cur.value);
    const bumped = await casSet(eKey, expected, nextEpoch);
    if (!bumped.ok) {
      if (bumped.code === "conflict") continue;
      return bumped;
    }

    const now = new Date().toISOString();
    const generation_id = (input.generation_id?.trim() || randomUUID()).trim();
    const record: GenerationRecord = {
      report_id,
      generation_id,
      generation_epoch: nextEpoch,
      status: "pending",
      locale: input.locale.trim() || "en",
      created_at: now,
      updated_at: now,
      superseded_at: null,
      superseded_by: null,
    };
    const gKey = genKey(report_id, generation_id);
    const written = await casSet(gKey, null, record);
    if (!written.ok) return written;
    return { ok: true, value: record };
  }
  return { ok: false, code: "conflict", detail: "allocateGeneration epoch CAS exhausted" };
}

/**
 * Atomically activate a generation as the report's sole active generation.
 * Requires new epoch strictly greater than current active epoch (idempotent same gen).
 */
export async function activateGeneration(input: {
  record: GenerationRecord;
  job_id?: string;
}): Promise<Batch3Result<ActiveGenerationPointer>> {
  if (!isBatch3SharedStoreAvailable()) return kvUnavailable();
  const { record } = input;
  const report_id = record.report_id.trim();
  const aKey = activeKey(report_id);
  const gKey = genKey(report_id, record.generation_id);
  const job_id = (input.job_id ?? report_id).trim();
  const b2Key = batch2PointerKey(job_id);
  trackBatch3Key(aKey);
  trackBatch3Key(gKey);
  trackBatch3Key(b2Key);

  const liveGen = await kvGet<GenerationRecord>(gKey);
  if (!liveGen.ok) return liveGen;
  if (!liveGen.value) {
    return { ok: false, code: "not_found", detail: "generation record missing" };
  }
  if (TERMINAL.has(liveGen.value.status)) {
    return {
      ok: false,
      code: "generation_terminal",
      detail: `cannot activate ${liveGen.value.status} generation`,
    };
  }
  if (liveGen.value.generation_epoch !== record.generation_epoch) {
    return {
      ok: false,
      code: "stale_generation",
      detail: "record epoch mismatch vs stored generation",
    };
  }

  const now = new Date().toISOString();
  const pointer: ActiveGenerationPointer = {
    report_id,
    generation_id: record.generation_id,
    generation_epoch: record.generation_epoch,
    switched_at: now,
  };
  const activeRec: GenerationRecord = {
    ...liveGen.value,
    status: "active",
    updated_at: now,
    superseded_at: null,
    superseded_by: null,
  };
  const b2Pointer = {
    report_id,
    generation_id: record.generation_id,
    started_at: now,
    generation_epoch: record.generation_epoch,
  };

  if (isMemoryAtomicAvailable()) {
    const result = runMemoryAtomic((ops) => {
      const live = ops.getJson(aKey) as ActiveGenerationPointer | null;
      if (
        live &&
        live.generation_id === record.generation_id &&
        live.generation_epoch === record.generation_epoch
      ) {
        return { code: 1 as const, pointer: live };
      }
      if (live && live.generation_epoch >= record.generation_epoch) {
        return {
          code: -1 as const,
          detail: `active epoch ${live.generation_epoch} >= ${record.generation_epoch}`,
        };
      }
      // Shared Finalization lock on CURRENT active generation.
      if (live?.generation_id) {
        const cKey = finalizationClaimKey(report_id, live.generation_id);
        trackBatch3Key(cKey);
        const lock = inspectFinalizationLock(ops.getJson(cKey));
        if (lock.kind === "locked") {
          return {
            code: -10 as const,
            detail: "prior generation finalization locks activation",
          };
        }
        if (lock.kind === "unusable") {
          return { code: -13 as const, detail: lock.reason };
        }
        if (!mayActivateNextGeneration(ops.getJson(cKey))) {
          return {
            code: -10 as const,
            detail: "prior generation delivery in progress",
          };
        }
      }

      const grec = ops.getJson(gKey) as GenerationRecord | null;
      if (!grec) return { code: -3 as const, detail: "generation missing" };
      if (TERMINAL.has(grec.status) || grec.status === "finalizing" || grec.status === "delivery_failed") {
        return { code: -2 as const, detail: `status=${grec.status}` };
      }

      if (live?.generation_id && live.generation_id !== record.generation_id) {
        const prevKey = genKey(report_id, live.generation_id);
        const prev = ops.getJson(prevKey) as GenerationRecord | null;
        if (prev && !TERMINAL.has(prev.status)) {
          ops.setJson(
            prevKey,
            {
              ...prev,
              status: "superseded",
              updated_at: now,
              superseded_at: now,
              superseded_by: record.generation_id,
            },
            KV_TTL.REPORT_BATCH2_JOB,
          );
          trackBatch3Key(prevKey);
        }
      }

      ops.setJson(aKey, pointer, KV_TTL.REPORT_BATCH2_JOB);
      ops.setJson(gKey, activeRec, KV_TTL.REPORT_BATCH2_JOB);
      ops.setJson(b2Key, b2Pointer, KV_TTL.REPORT_BATCH2_JOB);
      return { code: 1 as const, pointer };
    });
    if (!result.ok) return result;
    if (result.value.code === -1) {
      return {
        ok: false,
        code: "stale_generation",
        detail: result.value.detail ?? "epoch not monotonic",
      };
    }
    if (result.value.code === -2) {
      return {
        ok: false,
        code: "generation_terminal",
        detail: result.value.detail ?? "terminal generation",
      };
    }
    if (result.value.code === -3) {
      return { ok: false, code: "not_found", detail: result.value.detail ?? "missing" };
    }
    if (result.value.code === -10) {
      return {
        ok: false,
        code: "finalization_locked",
        detail: result.value.detail ?? "delivery in progress",
      };
    }
    if (result.value.code === -13) {
      return {
        ok: false,
        code: "conflict",
        detail: result.value.detail ?? "unusable finalization claim",
      };
    }
    return { ok: true, value: result.value.pointer! };
  }

  // Redis Lua — prev gen derived inside script from live Active Pointer.
  const evaled = await evalTxn(
    ACTIVATE_LUA,
    [aKey, gKey, b2Key],
    [
      String(record.generation_epoch),
      record.generation_id,
      JSON.stringify(pointer),
      JSON.stringify(activeRec),
      JSON.stringify(b2Pointer),
      String(KV_TTL.REPORT_BATCH2_JOB),
      now,
      report_id,
    ],
  );
  if (!evaled.ok) return evaled;
  const code = Number(evaled.value);
  if (code === 1) return { ok: true, value: pointer };
  if (code === -1) {
    return { ok: false, code: "stale_generation", detail: "epoch not monotonic (lua)" };
  }
  if (code === -2) {
    return {
      ok: false,
      code: "generation_terminal",
      detail: "cannot reactivate terminal generation (lua)",
    };
  }
  if (code === -10) {
    return {
      ok: false,
      code: "finalization_locked",
      detail: "prior generation finalization locks activation (lua)",
    };
  }
  if (code === -13) {
    return {
      ok: false,
      code: "conflict",
      detail: "prior finalization claim unusable (lua)",
    };
  }
  return { ok: false, code: "not_found", detail: `activate lua code=${code}` };
}

export async function readActiveGeneration(
  report_id: string,
): Promise<Batch3Result<ActiveGenerationPointer | null>> {
  return kvGet<ActiveGenerationPointer>(activeKey(report_id.trim()));
}

export async function readGeneration(
  report_id: string,
  generation_id: string,
): Promise<Batch3Result<GenerationRecord | null>> {
  return kvGet<GenerationRecord>(genKey(report_id.trim(), generation_id.trim()));
}

export async function assertGenerationActive(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
}): Promise<Batch3Result<GenerationRecord>> {
  const active = await readActiveGeneration(input.report_id);
  if (!active.ok) return active;
  if (!active.value) {
    return {
      ok: false,
      code: "stale_generation",
      detail: "no active generation pointer",
    };
  }
  if (
    active.value.generation_id !== input.generation_id.trim() ||
    active.value.generation_epoch !== input.generation_epoch
  ) {
    return {
      ok: false,
      code: "stale_generation",
      detail: `active=${active.value.generation_id}@${active.value.generation_epoch} request=${input.generation_id}@${input.generation_epoch}`,
    };
  }
  const gen = await readGeneration(input.report_id, input.generation_id);
  if (!gen.ok) return gen;
  if (!gen.value) {
    return { ok: false, code: "not_found", detail: "generation record missing" };
  }
  if (gen.value.status !== "active") {
    return {
      ok: false,
      code: "stale_generation",
      detail: `generation status=${gen.value.status}`,
    };
  }
  if (gen.value.generation_epoch !== input.generation_epoch) {
    return {
      ok: false,
      code: "stale_generation",
      detail: "generation_epoch mismatch on record",
    };
  }
  return { ok: true, value: gen.value };
}

export async function transitionGenerationStatus(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  to: GenerationStatus;
}): Promise<Batch3Result<GenerationRecord>> {
  const gen = await readGeneration(input.report_id, input.generation_id);
  if (!gen.ok) return gen;
  if (!gen.value) {
    return { ok: false, code: "not_found", detail: "generation missing" };
  }
  if (gen.value.generation_epoch !== input.generation_epoch) {
    return { ok: false, code: "stale_generation", detail: "epoch mismatch" };
  }
  const allowed = checkGenTransition(gen.value.status, input.to);
  if (!allowed.ok) {
    return {
      ok: false,
      code: TERMINAL.has(gen.value.status)
        ? "generation_terminal"
        : "conflict",
      detail: allowed.detail,
    };
  }
  const next: GenerationRecord = {
    ...gen.value,
    status: input.to,
    updated_at: new Date().toISOString(),
  };
  const saved = await casSet(
    genKey(input.report_id, input.generation_id),
    JSON.stringify(gen.value),
    next,
  );
  if (!saved.ok) return saved;
  return { ok: true, value: next };
}

/** Exported for tests / recovery key construction. */
export const generationStoreKeys = {
  epochKey,
  activeKey,
  genKey,
  batch2PointerKey,
};

// Keep durableKv import referenced for pointer writes on non-atomic paths.
void durableKv;
