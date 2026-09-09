/**
 * Extend or refine a chart thesis dimension when assign hits thesis_gap.
 * Same checklist bar as §1.3 + §1.6 — never silent low-quality patches.
 * Hard cap: 8 dimensions; prefer refining an existing dim over inventing a 9th.
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { buildThesisCalcFeed } from "@/lib/llm/pro/delivery/thesis/build-thesis-calc-feed";
import type {
  ChartThesis,
  ThesisDimension,
  ThesisDimensionId,
} from "@/lib/llm/pro/delivery/thesis/types";
import {
  THESIS_ABSENT_SUMMARY_ZH,
  THESIS_DIMENSION_IDS,
  THESIS_DIMENSION_NAME_ZH,
  THESIS_EMPTY_CONCLUSION_ZH,
} from "@/lib/llm/pro/delivery/thesis/types";

const HARD_MAX_DIMENSIONS = 8;

export type ExtendThesisResult =
  | { ok: true; thesis: ChartThesis; refined: ThesisDimensionId | "new" }
  | { ok: false; reason: string };

function strengthVerdictOf(thesis: ChartThesis): string | undefined {
  return thesis.dimensions.find((d) => d.dimension_id === "day_master_strength")
    ?.strength_verdict;
}

/**
 * Refine hints / wuxing on an existing dimension, or add one of the fixed 6 if missing.
 * Does not invent calc features — re-reads ThesisCalcFeed.
 */
export function extendThesisDimension(input: {
  thesis: ChartThesis;
  structured: ProfileStructured;
  /** Claim gap text for hint tagging only — must not alter classical_basis facts. */
  gap_claim_zh: string;
  prefer_dimension_id?: ThesisDimensionId;
}): ExtendThesisResult {
  const feed = buildThesisCalcFeed(input.structured);
  if (feed.fingerprint !== input.thesis.structured_fingerprint) {
    return { ok: false, reason: "thesis_fingerprint_mismatch" };
  }

  const prefer = input.prefer_dimension_id;
  const existingIds = new Set(input.thesis.dimensions.map((d) => d.dimension_id));

  // Prefer refine existing
  const targetId: ThesisDimensionId | null =
    prefer && existingIds.has(prefer)
      ? prefer
      : prefer && THESIS_DIMENSION_IDS.includes(prefer)
        ? prefer
        : null;

  if (targetId && existingIds.has(targetId)) {
    const dims = input.thesis.dimensions.map((d) => {
      if (d.dimension_id !== targetId) return d;
      const hint = input.gap_claim_zh.trim().slice(0, 48);
      const nextHints = hint
        ? [...new Set([...d.usable_claims_hint, `gap:${hint}`])].slice(0, 12)
        : d.usable_claims_hint;
      return { ...d, usable_claims_hint: nextHints, depth: "full" as const };
    });
    return {
      ok: true,
      refined: targetId,
      thesis: { ...input.thesis, dimensions: dims },
    };
  }

  // Add missing fixed dimension from feed (still within 6; hard cap 8)
  if (input.thesis.dimensions.length >= HARD_MAX_DIMENSIONS) {
    return { ok: false, reason: "thesis_dimension_cap" };
  }

  const missing = THESIS_DIMENSION_IDS.find((id) => !existingIds.has(id));
  if (!missing) {
    // All 6 present — refine first non-empty or resource_pattern
    const fallback =
      input.thesis.dimensions.find((d) => d.depth !== "skip")?.dimension_id ??
      "resource_pattern";
    return extendThesisDimension({
      ...input,
      prefer_dimension_id: fallback,
    });
  }

  const fd = feed.dimensions[missing];
  const verdict = strengthVerdictOf(input.thesis);
  const basis: Record<string, unknown> = {
    checklist: fd.items,
  };
  if (
    (missing === "favor_avoid_tuning" || missing === "interpersonal_pattern") &&
    verdict
  ) {
    basis.strength_premise = `由于日主${verdict}（见 day_master_strength）`;
  }
  const dim: ThesisDimension = {
    dimension_id: missing,
    dimension_name_zh: THESIS_DIMENSION_NAME_ZH[missing],
    classical_basis: basis,
    strength_verdict: missing === "day_master_strength" ? fd.strength_verdict : undefined,
    conclusion_zh: fd.empty
      ? THESIS_EMPTY_CONCLUSION_ZH
      : fd.items
          .filter((i) => i.present)
          .map((i) => i.summary_zh)
          .join("；") || THESIS_ABSENT_SUMMARY_ZH,
    usable_claims_hint: [
      ...fd.hints.filter((h) => !h.startsWith("wuxing:")),
      ...(input.gap_claim_zh.trim()
        ? [`gap:${input.gap_claim_zh.trim().slice(0, 48)}`]
        : []),
    ].slice(0, 12),
    wuxing_relations: [],
    depth: fd.empty ? "brief" : "full",
  };

  return {
    ok: true,
    refined: "new",
    thesis: {
      ...input.thesis,
      dimensions: [...input.thesis.dimensions, dim],
    },
  };
}
