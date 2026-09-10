/**
 * Ensure assign signals are grounded in chart thesis (命盘总纲).
 *
 * When thesis is present:
 * - every necessary_signal MUST have dimension_id + inference_zh
 * - dimension_id must exist on thesis
 * - slug must appear in that dimension's verified present facts
 * - no third-party attribution from natal signals (硬闸, not prompt-only)
 * - ganzhi used as dayun/cycle claims must appear in thesis cycle facts
 *
 * Signals without dimension_id used to skip this gate → shadow pool (神煞/长生) leak.
 */

import type { ChartThesis, ThesisDimension } from "@/lib/llm/pro/delivery/thesis/types";
import { isThesisDimensionId } from "@/lib/llm/pro/delivery/page-schema/assign-necessary-signals";

export type ThesisCoverageUnit = {
  necessary_signals?: ReadonlyArray<{
    slug?: string;
    dimension_id?: string;
    inference_zh?: string;
    role?: string;
    why_needed?: string;
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

/** 用盘主信号推断第三者动机/决定 — hard ban patterns. */
const THIRD_PARTY_ATTR_RE =
  /对方|伙伴|旧部|合盘|第三人|他(?:明确|坚持|要求|不愿|感知)|她(?:明确|坚持|要求)|创业伙伴|发起人/;

/**
 * Natal chart may only explain the querent. Detect "partner psychology from 正官" style leaks.
 */
export function detectThirdPartyNatalAttribution(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  const m = t.match(THIRD_PARTY_ATTR_RE);
  return m ? m[0]! : null;
}

const GANZHI_RE =
  /[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g;

/** Ganzhi that look like cycle steps (大运/流年) must be in cycle_rhythm thesis facts. */
export function detectUngroundedCycleGanzhi(
  text: string,
  cycleCorpus: string,
  slug: string,
): string | null {
  const blob = `${slug}\n${text}`;
  // Only enforce when the prose claims a cycle step, or slug itself is a ganzhi.
  const claimsCycle =
    /大运|流年|流月|起运|岁运|岁环/.test(blob) ||
    /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/.test(slug.trim());
  if (!claimsCycle) return null;

  const hits = blob.match(GANZHI_RE) ?? [];
  for (const gz of hits) {
    if (!cycleCorpus.includes(gz)) {
      return gz;
    }
  }
  return null;
}

export function validateAssignmentThesisCoverage(
  assignment: { units: readonly ThesisCoverageUnit[] },
  thesis: ChartThesis | null | undefined,
): string | null {
  if (!thesis?.dimensions?.length) return null; // no thesis yet — skip
  const corpora = buildThesisDimensionCorpora(thesis);
  const known = new Set(corpora.keys());
  const cycleCorpus = corpora.get("cycle_rhythm") ?? "";

  for (const u of assignment.units) {
    for (const s of u.necessary_signals ?? []) {
      const slug = (s.slug ?? "").trim();
      const dim = s.dimension_id?.trim() ?? "";
      const inference = (s.inference_zh ?? "").trim();
      const role = (s.role ?? "").trim();
      const why = (s.why_needed ?? "").trim();
      const prose = [inference, role, why].filter(Boolean).join("\n");

      if (!dim) {
        return `thesis_gap:dimension_id_required:${slug || "unknown_slug"}`;
      }
      if (!isThesisDimensionId(dim)) {
        return `thesis_gap:dimension_id_invalid:${dim}`;
      }
      if (!known.has(dim)) {
        return `thesis_gap:${dim}`;
      }
      if (!inference) {
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

      const third = detectThirdPartyNatalAttribution(prose);
      if (third) {
        return `thesis_gap:third_party_attr:${slug}:${third}`;
      }

      const badGz = detectUngroundedCycleGanzhi(prose, cycleCorpus, slug);
      if (badGz) {
        return `thesis_gap:cycle_ganzhi_not_in_thesis:${slug}:${badGz}`;
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
