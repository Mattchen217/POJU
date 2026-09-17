/**
 * Cross-page primary-anchor Jaccard SSOT (write quality + assign + fill sanitize).
 * Fail when Jaccard ≥ threshold and no new inventory category vs prior pages.
 */

import {
  buildCategoryTokenSetsFromStructured,
  classifyAnchorToken,
  type AnchorCategoryId,
  type CategoryTokenSets,
} from "./anchor-category-tally";

export type CrossPagePrimaryReuseResult =
  | { ok: true; notes: string[] }
  | { ok: false; reason: string; notes: string[] };

/** Cross-page primary-anchor Jaccard hard gate when no new category. */
export const CROSS_PAGE_PRIMARY_ANCHOR_JACCARD = 0.72;

function jaccard(a: readonly string[], b: readonly string[]): number {
  const A = new Set(a.map((x) => x.trim()).filter(Boolean));
  const B = new Set(b.map((x) => x.trim()).filter(Boolean));
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

function categoriesForAnchors(
  anchors: readonly string[],
  sets: CategoryTokenSets,
): Set<AnchorCategoryId> {
  const cats = new Set<AnchorCategoryId>();
  for (const a of anchors) {
    const c = classifyAnchorToken(a, sets);
    if (c) cats.add(c);
  }
  return cats;
}

export function assessCrossPagePrimaryAnchorReuse(input: {
  page_primaries: readonly string[];
  prior_chart_anchors: readonly string[];
  category_token_sets?: CategoryTokenSets | null;
}): CrossPagePrimaryReuseResult {
  const notes: string[] = [];
  const prior = (input.prior_chart_anchors ?? []).map((x) => x.trim()).filter(Boolean);
  const primary = (input.page_primaries ?? []).map((x) => x.trim()).filter(Boolean);
  if (prior.length < 2 || primary.length < 2) {
    return { ok: true, notes };
  }
  const jv = jaccard(primary, prior);
  notes.push(`deep_evidence_cross_page_primary_jaccard:${jv.toFixed(2)}`);
  const sets =
    input.category_token_sets ?? buildCategoryTokenSetsFromStructured(null);
  const priorCats = categoriesForAnchors(prior, sets);
  const curCats = categoriesForAnchors(primary, sets);
  let newCat = false;
  for (const c of curCats) {
    if (!priorCats.has(c)) {
      newCat = true;
      break;
    }
  }
  notes.push(
    newCat
      ? "deep_evidence_cross_page_new_category"
      : "deep_evidence_cross_page_no_new_category",
  );
  if (jv >= CROSS_PAGE_PRIMARY_ANCHOR_JACCARD && !newCat) {
    return {
      ok: false,
      reason: "deep_evidence_cross_page_anchor_reuse",
      notes,
    };
  }
  return { ok: true, notes };
}
