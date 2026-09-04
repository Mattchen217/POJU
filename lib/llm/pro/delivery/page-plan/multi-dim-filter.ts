import type { BreakthroughCore } from "@/lib/poju/agent-state";

/**
 * Full multi_dim index list — no keyword score / head truncation.
 * Segment-2 already selected dimensions; delivery must not re-cut them.
 */
function allMultiDimIndices(core: BreakthroughCore): number[] {
  const dims = core.multi_dimension_reckoning ?? [];
  return dims.map((_, i) => i);
}

/** @deprecated Name kept for call sites — returns all indices (no P4 filter). */
export function filterMultiDimIndicesForP4(
  core: BreakthroughCore,
  _questionText?: string,
  _desiredOutcome?: string,
): number[] {
  return allMultiDimIndices(core);
}

/** @deprecated Name kept for call sites — returns all indices (no risk filter). */
export function filterMultiDimIndicesForRisk(core: BreakthroughCore): number[] {
  return allMultiDimIndices(core);
}
