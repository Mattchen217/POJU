/**
 * Shared Finalization lock — Claim / Commit / Invalidation / Activation
 * MUST use the same predicate (MemoryKv + identical Lua branch).
 *
 * locked (page content immutable, activation blocked):
 *   sealed | delivering | delivery_failed | legacy "claimed"
 * unlocked for next-gen activation:
 *   absent | delivered
 * unusable present value → fail-closed (treat as locked for mutation)
 */

export function finalizationClaimKey(
  report_id: string,
  generation_id: string,
): string {
  return `report-batch3:${report_id.trim()}:${generation_id.trim()}:finalization`;
}

export type FinalizationDeliveryStatus =
  | "sealed"
  | "delivering"
  | "delivered"
  | "delivery_failed"
  /** Legacy R4–R6 status; treated as sealed. */
  | "claimed";

export type FinalizationLockResult =
  | { kind: "absent" }
  | { kind: "unlocked"; status: "delivered" }
  | { kind: "locked"; status: FinalizationDeliveryStatus }
  | { kind: "unusable"; reason: string };

const LOCKED: ReadonlySet<string> = new Set([
  "sealed",
  "delivering",
  "delivery_failed",
  "claimed",
]);

/**
 * Normalize raw claim status. Legacy "claimed" ≡ sealed for lock purposes.
 */
export function normalizeFinalizationStatus(
  status: unknown,
): FinalizationDeliveryStatus | null {
  if (status === "claimed") return "claimed";
  if (status === "sealed") return "sealed";
  if (status === "delivering") return "delivering";
  if (status === "delivered") return "delivered";
  if (status === "delivery_failed") return "delivery_failed";
  return null;
}

export function isPageContentLockedStatus(status: string): boolean {
  return LOCKED.has(status);
}

/**
 * Shared inspection for a KV-loaded Finalization Claim value.
 */
export function inspectFinalizationLock(raw: unknown): FinalizationLockResult {
  if (raw === null || raw === undefined) {
    return { kind: "absent" };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return {
      kind: "unusable",
      reason: "finalization claim is not a plain object",
    };
  }
  const statusRaw = (raw as { status?: unknown }).status;
  if (typeof statusRaw !== "string" || statusRaw.length === 0) {
    return {
      kind: "unusable",
      reason: "finalization claim missing or empty status",
    };
  }
  const status = normalizeFinalizationStatus(statusRaw);
  if (!status) {
    return {
      kind: "unusable",
      reason: `finalization claim unknown status=${statusRaw}`,
    };
  }
  if (status === "delivered") {
    return { kind: "unlocked", status: "delivered" };
  }
  if (LOCKED.has(status)) {
    return { kind: "locked", status };
  }
  return {
    kind: "unusable",
    reason: `finalization claim unhandled status=${status}`,
  };
}

/** True when page content / invalidate / commit must refuse. */
export function isPageContentLockedByFinalization(raw: unknown): boolean {
  const r = inspectFinalizationLock(raw);
  return r.kind === "locked" || r.kind === "unusable";
}

/** True when a new Generation may activate over this claim (or none). */
export function mayActivateNextGeneration(raw: unknown): boolean {
  const r = inspectFinalizationLock(raw);
  return r.kind === "absent" || r.kind === "unlocked";
}

/**
 * Lua snippet fragment (shared semantics) — returns:
 *  0 = absent / delivered (unlocked)
 * -10 = locked (sealed|delivering|delivery_failed|claimed)
 * -13 = present but unusable
 *
 * Expects `claimCur` already assigned from redis.call("GET", claimKey).
 */
export const FINALIZATION_LOCK_LUA_SNIPPET = `
local __fin_lock = 0
if claimCur ~= false and claimCur ~= nil then
  local cok, claim = pcall(cjson.decode, claimCur)
  if not cok or type(claim) ~= "table" then
    __fin_lock = -13
  else
    local st = claim.status
    if st == "delivered" then
      __fin_lock = 0
    elseif st == "sealed" or st == "delivering" or st == "delivery_failed" or st == "claimed" then
      __fin_lock = -10
    else
      __fin_lock = -13
    end
  end
end
`;
