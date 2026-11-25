/**
 * Finalization Claim inspection — delegates to shared finalization-lock.
 * Legacy "claimed" ≡ sealed (page content locked).
 */

import {
  inspectFinalizationLock,
  type FinalizationLockResult,
} from "./finalization-lock";

export type ClaimInspectResult =
  | { kind: "absent" }
  | { kind: "claimed" }
  | { kind: "unlocked" }
  | { kind: "unusable"; reason: string };

/**
 * Inspect a raw Claim value. "claimed" kind means page-content locked
 * (sealed | delivering | delivery_failed | legacy claimed).
 */
export function inspectFinalizationClaimValue(
  raw: unknown,
): ClaimInspectResult {
  const r: FinalizationLockResult = inspectFinalizationLock(raw);
  if (r.kind === "absent") return { kind: "absent" };
  if (r.kind === "unlocked") return { kind: "unlocked" };
  if (r.kind === "locked") return { kind: "claimed" };
  return { kind: "unusable", reason: r.reason };
}

export {
  inspectFinalizationLock,
  isPageContentLockedByFinalization,
  mayActivateNextGeneration,
  normalizeFinalizationStatus,
} from "./finalization-lock";
