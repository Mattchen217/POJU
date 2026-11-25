/**
 * Shared Finalization Claim inspection — MemoryKv and Redis Lua must agree:
 * only a confirmed absent key allows invalidation / new claim write;
 * status "claimed" locks; anything else present is fail-closed.
 */

export type ClaimInspectResult =
  | { kind: "absent" }
  | { kind: "claimed" }
  | { kind: "unusable"; reason: string };

/**
 * Inspect a raw Claim value loaded from KV (already decoded object/string).
 * null/undefined → absent. Non-object, missing/unknown status → unusable.
 */
export function inspectFinalizationClaimValue(
  raw: unknown,
): ClaimInspectResult {
  if (raw === null || raw === undefined) {
    return { kind: "absent" };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return {
      kind: "unusable",
      reason: "finalization claim is not a plain object",
    };
  }
  const status = (raw as { status?: unknown }).status;
  if (status === "claimed") {
    return { kind: "claimed" };
  }
  if (typeof status !== "string" || status.length === 0) {
    return {
      kind: "unusable",
      reason: "finalization claim missing or empty status",
    };
  }
  return {
    kind: "unusable",
    reason: `finalization claim unknown status=${status}`,
  };
}
