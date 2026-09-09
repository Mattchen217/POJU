/**
 * Soft cap for evidence units per page (Wave 2 — prevent relation-split inflation).
 * Planned paths remain the ceiling; assign may emit fewer standing claims.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { deepEvidenceUnitSpec } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-prompt";

/** Absolute soft ceiling across pages (relation-chain splits count toward this). */
export const PAGE_EVIDENCE_UNIT_SOFT_CAP = 8;

export function pageEvidenceUnitBounds(key: DeliverySegmentKey): {
  min: number;
  max: number;
} {
  const spec = deepEvidenceUnitSpec(key);
  const max = Math.min(spec.max, PAGE_EVIDENCE_UNIT_SOFT_CAP);
  const min = Math.min(spec.min, max);
  return { min, max };
}

/**
 * Clamp a desired unit count into [min, max] for the page.
 * Prefer merging weak claims over exceeding max.
 */
export function clampEvidenceUnitCount(
  key: DeliverySegmentKey,
  desired: number,
  prealloc_max?: number,
): number {
  const { min, max } = pageEvidenceUnitBounds(key);
  let hi = max;
  if (typeof prealloc_max === "number" && prealloc_max > 0) {
    hi = Math.min(hi, prealloc_max);
  }
  const n = Math.floor(desired);
  if (!Number.isFinite(n) || n < 1) return min;
  return Math.max(min, Math.min(hi, n));
}
