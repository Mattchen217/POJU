/**
 * Unit D — transitionDeliveryAtomic
 * Finalization Claim + Generation status updated in ONE MemoryAtomic / Redis Lua.
 */

import {
  finalizationClaimKey,
  type FinalizationDeliveryStatus,
} from "./finalization-lock";
import type { FinalizationClaim } from "./finalization";
import { generationStoreKeys } from "./generation-store";
import {
  evalTxn,
  isMemoryAtomicAvailable,
  kvGet,
  runMemoryAtomic,
  trackBatch3Key,
  ttlSeconds,
} from "./kv-cas";
import type { Batch3Result, GenerationRecord } from "./types";

export type DeliveryTransitionTo =
  | "delivering"
  | "delivered"
  | "delivery_failed";

/**
 * KEYS[1]=claim KEYS[2]=gen
 * ARGV: to, detail, nowIso, ttl, expectEpoch
 * Returns 1 ok, 2 idempotent, negatives fail-closed
 */
export const DELIVERY_TRANSITION_LUA = `
local claimKey = KEYS[1]
local genKey = KEYS[2]
local toStatus = ARGV[1]
local detail = ARGV[2]
local nowIso = ARGV[3]
local ttl = tonumber(ARGV[4])
local expectEpoch = tonumber(ARGV[5])

local ccur = redis.call("GET", claimKey)
if ccur == false or ccur == nil then return -2 end
local cok, claim = pcall(cjson.decode, ccur)
if not cok or type(claim) ~= "table" then return -5 end
local cst = claim.status

local gcur = redis.call("GET", genKey)
if gcur == false or gcur == nil then return -2 end
local gok, grec = pcall(cjson.decode, gcur)
if not gok or type(grec) ~= "table" then return -5 end
if expectEpoch and tonumber(grec.generation_epoch) ~= expectEpoch then return -1 end

local gst = grec.status

if toStatus == "delivering" then
  if cst == "delivering" and (gst == "finalizing") then return 2 end
  if cst == "delivered" then return -4 end
  if cst ~= "sealed" and cst ~= "claimed" and cst ~= "delivery_failed" then return -3 end
  if gst == "delivery_failed" then
    grec.status = "finalizing"
  elseif gst ~= "finalizing" and gst ~= "active" then
    -- allow finalizing already; active only if seal just happened inconsistently
    if gst ~= "finalizing" then return -3 end
  end
  if gst == "active" then grec.status = "finalizing" end
  claim.status = "delivering"
  claim.delivering_at = nowIso
  grec.updated_at = nowIso
elseif toStatus == "delivered" then
  if cst == "delivered" and gst == "completed" then return 2 end
  if cst ~= "delivering" and cst ~= "sealed" and cst ~= "claimed" then return -3 end
  if gst ~= "finalizing" then return -3 end
  claim.status = "delivered"
  claim.delivered_at = nowIso
  grec.status = "completed"
  grec.updated_at = nowIso
elseif toStatus == "delivery_failed" then
  if cst == "delivered" then return -4 end
  if gst ~= "finalizing" and gst ~= "delivery_failed" then return -3 end
  claim.status = "delivery_failed"
  claim.delivery_failed_at = nowIso
  claim.delivery_detail = detail
  grec.status = "delivery_failed"
  grec.updated_at = nowIso
else
  return -3
end

redis.call("SET", claimKey, cjson.encode(claim), "EX", ttl)
redis.call("SET", genKey, cjson.encode(grec), "EX", ttl)
return 1
`;

export function mapDeliveryTransitionCode(
  code: number,
): Batch3Result<"ok" | "idempotent"> {
  if (code === 1) return { ok: true, value: "ok" };
  if (code === 2) return { ok: true, value: "idempotent" };
  if (code === -1) {
    return { ok: false, code: "stale_generation", detail: "epoch mismatch" };
  }
  if (code === -2) {
    return { ok: false, code: "not_found", detail: "claim or gen missing" };
  }
  if (code === -3) {
    return {
      ok: false,
      code: "invalid_state",
      detail: "illegal delivery transition",
    };
  }
  if (code === -4) {
    return { ok: false, code: "conflict", detail: "already delivered" };
  }
  if (code === -5) {
    return { ok: false, code: "conflict", detail: "claim/gen undecodable" };
  }
  return {
    ok: false,
    code: "conflict",
    detail: `delivery transition lua=${code}`,
  };
}

export async function transitionDeliveryAtomic(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  to: DeliveryTransitionTo;
  detail?: string;
}): Promise<Batch3Result<FinalizationClaim>> {
  const cKey = finalizationClaimKey(input.report_id, input.generation_id);
  const gKey = generationStoreKeys.genKey(
    input.report_id,
    input.generation_id,
  );
  trackBatch3Key(cKey);
  trackBatch3Key(gKey);
  const nowIso = new Date().toISOString();

  if (isMemoryAtomicAvailable()) {
    const ran = runMemoryAtomic((ops) => {
      const claim = ops.getJson(cKey) as FinalizationClaim | null;
      const grec = ops.getJson(gKey) as GenerationRecord | null;
      if (!claim || !grec) {
        return {
          ok: false as const,
          code: "not_found" as const,
          detail: "claim or gen missing",
        };
      }
      if (grec.generation_epoch !== input.generation_epoch) {
        return {
          ok: false as const,
          code: "stale_generation" as const,
          detail: "epoch mismatch",
        };
      }

      let nextClaim: FinalizationClaim = { ...claim };
      let nextGen: GenerationRecord = { ...grec };

      if (input.to === "delivering") {
        if (
          claim.status === "delivering" &&
          grec.status === "finalizing"
        ) {
          return { ok: true as const, claim, mode: "idempotent" as const };
        }
        if (claim.status === "delivered") {
          return {
            ok: false as const,
            code: "conflict" as const,
            detail: "already delivered",
          };
        }
        if (
          claim.status !== "sealed" &&
          claim.status !== "claimed" &&
          claim.status !== "delivery_failed"
        ) {
          return {
            ok: false as const,
            code: "invalid_state" as const,
            detail: `cannot start delivery from claim=${claim.status}`,
          };
        }
        if (grec.status === "delivery_failed") {
          nextGen = { ...nextGen, status: "finalizing", updated_at: nowIso };
        } else if (grec.status === "active") {
          nextGen = { ...nextGen, status: "finalizing", updated_at: nowIso };
        } else if (grec.status !== "finalizing") {
          return {
            ok: false as const,
            code: "invalid_state" as const,
            detail: `cannot start delivery from gen=${grec.status}`,
          };
        }
        nextClaim = {
          ...nextClaim,
          status: "delivering" as FinalizationDeliveryStatus,
          delivering_at: nowIso,
        };
      } else if (input.to === "delivered") {
        if (claim.status === "delivered" && grec.status === "completed") {
          return { ok: true as const, claim, mode: "idempotent" as const };
        }
        if (
          claim.status !== "delivering" &&
          claim.status !== "sealed" &&
          claim.status !== "claimed"
        ) {
          return {
            ok: false as const,
            code: "invalid_state" as const,
            detail: `cannot mark delivered from claim=${claim.status}`,
          };
        }
        if (grec.status !== "finalizing") {
          return {
            ok: false as const,
            code: "invalid_state" as const,
            detail: `cannot mark delivered from gen=${grec.status}`,
          };
        }
        nextClaim = {
          ...nextClaim,
          status: "delivered",
          delivered_at: nowIso,
        };
        nextGen = { ...nextGen, status: "completed", updated_at: nowIso };
      } else {
        if (claim.status === "delivered") {
          return {
            ok: false as const,
            code: "conflict" as const,
            detail: "already delivered",
          };
        }
        if (grec.status !== "finalizing" && grec.status !== "delivery_failed") {
          return {
            ok: false as const,
            code: "invalid_state" as const,
            detail: `cannot fail delivery from gen=${grec.status}`,
          };
        }
        nextClaim = {
          ...nextClaim,
          status: "delivery_failed",
          delivery_failed_at: nowIso,
          delivery_detail: input.detail ?? null,
        };
        nextGen = {
          ...nextGen,
          status: "delivery_failed",
          updated_at: nowIso,
        };
      }

      ops.setJson(cKey, nextClaim, ttlSeconds());
      ops.setJson(gKey, nextGen, ttlSeconds());
      return { ok: true as const, claim: nextClaim, mode: "ok" as const };
    });
    if (!ran.ok) return ran;
    if (!ran.value.ok) {
      return { ok: false, code: ran.value.code, detail: ran.value.detail };
    }
    return { ok: true, value: ran.value.claim };
  }

  const evaled = await evalTxn(
    DELIVERY_TRANSITION_LUA,
    [cKey, gKey],
    [
      input.to,
      input.detail ?? "",
      nowIso,
      String(ttlSeconds()),
      String(input.generation_epoch),
    ],
  );
  if (!evaled.ok) return evaled;
  const mapped = mapDeliveryTransitionCode(Number(evaled.value));
  if (!mapped.ok) return mapped;
  const after = await kvGet<FinalizationClaim>(cKey);
  if (!after.ok) return after;
  if (!after.value) {
    return { ok: false, code: "not_found", detail: "claim missing after transition" };
  }
  return { ok: true, value: after.value };
}
