/**
 * Ensure assign signals' dimension_id exist on the chart thesis.
 * Missing → thesis_gap (extend or hard-fail; never invent in write).
 */

import type { ChartThesis } from "@/lib/llm/pro/delivery/thesis/types";
import { isThesisDimensionId } from "@/lib/llm/pro/delivery/page-schema/assign-necessary-signals";

export type ThesisCoverageUnit = {
  necessary_signals?: ReadonlyArray<{
    dimension_id?: string;
  }>;
};

export function validateAssignmentThesisCoverage(
  assignment: { units: readonly ThesisCoverageUnit[] },
  thesis: ChartThesis | null | undefined,
): string | null {
  if (!thesis?.dimensions?.length) return null; // no thesis yet — skip
  const known = new Set(thesis.dimensions.map((d) => d.dimension_id));
  for (const u of assignment.units) {
    for (const s of u.necessary_signals ?? []) {
      const dim = s.dimension_id?.trim();
      if (!dim) continue;
      if (!isThesisDimensionId(dim)) {
        return `thesis_gap:dimension_id_invalid:${dim}`;
      }
      if (!known.has(dim)) {
        return `thesis_gap:${dim}`;
      }
    }
  }
  return null;
}
