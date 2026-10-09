/**
 * Adjacent peel atoms (composite ⟦w:日主身强⟧ → ⟦t:day_master|⟧⟦t:strong_self|⟧)
 * render as one gold cluster: soft labels joined with · (本元·充沛).
 * No new glossary slug — reuses per-atom SSOT soft/gloss.
 */

import type { TermPolarity } from "@/lib/glossary/term-polarity";

/** Visible soft join for a peel cluster (zh/en/… all use the same separator). */
export const PEEL_SOFT_JOIN = "·";

/** Gap between peel atoms must be empty (encode emits zero vernacular). */
export function isPeelClusterGap(gap: string): boolean {
  return !/[^\s\u200b]/.test(gap ?? "");
}

export function joinPeelSoftLabels(softs: readonly string[]): string {
  return softs
    .map((s) => s.trim())
    .filter(Boolean)
    .join(PEEL_SOFT_JOIN);
}

export function joinPeelGlosses(glosses: readonly string[]): string {
  return glosses
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n");
}

/** Prefer caution if any atom is caution; else favorable if any; else neutral. */
export function mergePeelPolarities(
  polarities: readonly TermPolarity[],
): TermPolarity {
  if (polarities.includes("caution")) return "caution";
  if (polarities.includes("favorable")) return "favorable";
  return "neutral";
}

/** Cap runaway adjacent runs (encode peels are typically 2–4 atoms). */
export const MAX_PEEL_CLUSTER_ATOMS = 6;
