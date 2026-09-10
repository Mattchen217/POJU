/**
 * Ensure assign signals are grounded in chart thesis (命盘总纲).
 *
 * When thesis is present:
 * - every necessary_signal MUST have dimension_id + inference_zh
 * - dimension_id must exist on thesis
 * - slug must appear in that dimension's verified present facts
 *   (classical_basis present summaries / strength_verdict / usable_claims_hint)
 *
 * Signals without dimension_id used to skip this gate → shadow pool (神煞/长生) leak.
 * Missing slug in cited dim → thesis_gap (wrong dim or unvalidated fact).
 */

import type { ChartThesis, ThesisDimension } from "@/lib/llm/pro/delivery/thesis/types";
import { isThesisDimensionId } from "@/lib/llm/pro/delivery/page-schema/assign-necessary-signals";

export type ThesisCoverageUnit = {
  necessary_signals?: ReadonlyArray<{
    slug?: string;
    dimension_id?: string;
    inference_zh?: string;
  }>;
};

function dimCorpus(dim: ThesisDimension): string {
  const parts: string[] = [];
  if (dim.strength_verdict?.trim()) parts.push(dim.strength_verdict.trim());
  if (Array.isArray(dim.classical_basis)) {
    for (const it of dim.classical_basis) {
      if (it.present && it.summary_zh?.trim()) parts.push(it.summary_zh.trim());
    }
  }
  for (const h of dim.usable_claims_hint ?? []) {
    if (h.trim()) parts.push(h.trim());
  }
  return parts.join("\n");
}

/** Build dimension_id → searchable corpus of verified thesis facts. */
export function buildThesisDimensionCorpora(
  thesis: ChartThesis,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const dim of thesis.dimensions) {
    map.set(dim.dimension_id, dimCorpus(dim));
  }
  return map;
}

/** True if slug appears as contiguous text in a thesis dimension corpus. */
export function slugGroundedInCorpus(corpus: string, slug: string): boolean {
  const s = slug.trim();
  if (!s || !corpus) return false;
  return corpus.includes(s);
}

/** Union of all grounded corpora — for filtering prealloc prefer_primary. */
export function thesisAllFactsCorpus(thesis: ChartThesis): string {
  return thesis.dimensions.map(dimCorpus).filter(Boolean).join("\n");
}

export function isSlugGroundedInThesis(
  thesis: ChartThesis,
  slug: string,
  dimension_id?: string | null,
): boolean {
  const s = slug.trim();
  if (!s) return false;
  if (dimension_id?.trim()) {
    const dim = thesis.dimensions.find((d) => d.dimension_id === dimension_id.trim());
    if (!dim) return false;
    return slugGroundedInCorpus(dimCorpus(dim), s);
  }
  return slugGroundedInCorpus(thesisAllFactsCorpus(thesis), s);
}

/**
 * Find which thesis dims contain this slug (for wrong-dim error hints).
 */
export function thesisDimsContainingSlug(
  thesis: ChartThesis,
  slug: string,
): string[] {
  const s = slug.trim();
  if (!s) return [];
  const out: string[] = [];
  for (const dim of thesis.dimensions) {
    if (slugGroundedInCorpus(dimCorpus(dim), s)) out.push(dim.dimension_id);
  }
  return out;
}

export function validateAssignmentThesisCoverage(
  assignment: { units: readonly ThesisCoverageUnit[] },
  thesis: ChartThesis | null | undefined,
): string | null {
  if (!thesis?.dimensions?.length) return null; // no thesis yet — skip
  const corpora = buildThesisDimensionCorpora(thesis);
  const known = new Set(corpora.keys());

  for (const u of assignment.units) {
    for (const s of u.necessary_signals ?? []) {
      const slug = (s.slug ?? "").trim();
      const dim = s.dimension_id?.trim() ?? "";

      if (!dim) {
        return `thesis_gap:dimension_id_required:${slug || "unknown_slug"}`;
      }
      if (!isThesisDimensionId(dim)) {
        return `thesis_gap:dimension_id_invalid:${dim}`;
      }
      if (!known.has(dim)) {
        return `thesis_gap:${dim}`;
      }
      if (!(s.inference_zh?.trim())) {
        return `thesis_gap:inference_zh_missing:${slug || dim}`;
      }
      if (!slug) {
        return `thesis_gap:slug_missing:${dim}`;
      }

      const corpus = corpora.get(dim) ?? "";
      if (!slugGroundedInCorpus(corpus, slug)) {
        const elsewhere = thesisDimsContainingSlug(thesis, slug);
        if (elsewhere.length > 0) {
          return `thesis_gap:slug_wrong_dim:${slug}:cited=${dim}:found_in=${elsewhere.join("|")}`;
        }
        return `thesis_gap:slug_not_in_thesis:${slug}`;
      }
    }
  }
  return null;
}

/**
 * Drop prefer_primary values that are not present in any thesis verified fact.
 * Forces assign off the shadow pool (神煞/长生 not yet in 六维 checklist).
 */
export function filterPreferMapToThesis(
  preferByPath: Readonly<Record<string, string>> | null | undefined,
  thesis: ChartThesis | null | undefined,
): Record<string, string> | undefined {
  if (!preferByPath) return undefined;
  if (!thesis?.dimensions?.length) {
    return { ...preferByPath };
  }
  const corpus = thesisAllFactsCorpus(thesis);
  const out: Record<string, string> = {};
  for (const [path, primary] of Object.entries(preferByPath)) {
    const p = primary.trim();
    if (p && slugGroundedInCorpus(corpus, p)) {
      out[path] = p;
    }
  }
  return out;
}
