/**
 * Ensure assign signals are grounded in chart thesis (命盘总纲).
 *
 * When thesis is present:
 * - every necessary_signal MUST have dimension_id + inference_zh
 * - dimension_id must exist on thesis
 * - slug must ground to a closed-set fact token that appears in that dim's present corpus
 *   (not brittle string-equality / hand-maintained aliases)
 * - no third-party attribution from natal signals (硬闸, not prompt-only)
 * - ganzhi used as dayun/cycle claims must appear in thesis cycle facts
 *
 * Signals without dimension_id used to skip this gate → shadow pool (神煞/长生) leak.
 */

import type { ChartThesis, ThesisDimension } from "@/lib/llm/pro/delivery/thesis/types";
import { isThesisDimensionId } from "@/lib/llm/pro/delivery/page-schema/assign-necessary-signals";
import {
  CLOSED_EARTHLY_BRANCHES,
  CLOSED_HEAVENLY_STEMS,
  CLOSED_LIFE_STAGES,
  CLOSED_MATCH_RELATIONS,
  CLOSED_STRUCTURAL,
  CLOSED_TEN_GODS,
  CLOSED_WUXING,
} from "@/lib/glossary/term-closed-set";

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

const GANZHI_RE =
  /[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g;

/** Lexicon for extracting fact tokens from thesis prose — longest-first. */
let _lexiconLongestFirst: string[] | null = null;

function groundingLexiconLongestFirst(): string[] {
  if (_lexiconLongestFirst) return _lexiconLongestFirst;
  const ganzhi: string[] = [];
  for (const s of CLOSED_HEAVENLY_STEMS) {
    for (const b of CLOSED_EARTHLY_BRANCHES) {
      ganzhi.push(`${s}${b}`);
    }
  }
  const extra = [
    "身强",
    "身弱",
    "从强",
    "从弱",
    "食伤",
    "财星",
    "官杀",
    "印星",
    "比劫",
  ];
  const all = [
    ...CLOSED_TEN_GODS,
    ...ganzhi,
    ...CLOSED_WUXING,
    ...CLOSED_STRUCTURAL,
    ...CLOSED_MATCH_RELATIONS,
    ...CLOSED_LIFE_STAGES,
    ...CLOSED_EARTHLY_BRANCHES,
    ...CLOSED_HEAVENLY_STEMS,
    ...extra,
  ];
  _lexiconLongestFirst = [...new Set(all)].sort((a, b) => b.length - a.length);
  return _lexiconLongestFirst;
}

/**
 * Closed-set / ganzhi tokens that actually appear in this dimension's thesis corpus.
 * Grounding is against this set — not a hand-maintained alias table.
 */
export function extractThesisFactTokens(corpus: string): string[] {
  if (!corpus) return [];
  const found = new Set<string>();
  for (const term of groundingLexiconLongestFirst()) {
    if (corpus.includes(term)) found.add(term);
  }
  const gz = corpus.match(GANZHI_RE) ?? [];
  for (const g of gz) found.add(g);
  // Relation phrases like 巳寅相刑 / 寅巳相冲
  const rel = corpus.match(
    /[子丑寅卯辰巳午未申酉戌亥]{2}相(?:刑|冲|合|害)|[甲乙丙丁戊己庚辛壬癸]{2}相合/g,
  );
  if (rel) for (const r of rel) found.add(r);
  return [...found].sort((a, b) => b.length - a.length);
}

/**
 * Longest thesis fact token embedded in slug (and present in corpus).
 * e.g. slug「大运丁酉」+ corpus「当前大运：丁酉」→「丁酉」
 * Prefer closed-set cores over compound model phrasing.
 */
export function resolveSlugToThesisToken(
  corpus: string,
  slug: string,
): string | null {
  const s = slug.trim();
  if (!s || !corpus) return null;
  const tokens = extractThesisFactTokens(corpus);

  // Prefer longest closed-set / ganzhi core shared by slug and corpus.
  for (const t of tokens) {
    if (!s.includes(t)) continue;
    if (t.length >= 2) return t;
    if (
      (CLOSED_WUXING as readonly string[]).includes(t) &&
      (s === t || /^(?:用神|喜神|忌神)[:：]?[木火土金水]$/.test(s))
    ) {
      return t;
    }
  }

  // Fallback: exact phrase appears in thesis prose (non-lexicon claim).
  if (corpus.includes(s)) return s;
  return null;
}

/** True if slug grounds to a fact token present in this thesis dimension corpus. */
export function slugGroundedInCorpus(corpus: string, slug: string): boolean {
  return resolveSlugToThesisToken(corpus, slug) != null;
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

/** 用盘主信号推断第三者动机/决定 — 须是「归因到对方心理/要求」，不是场景里提到旧部/伙伴。 */
const THIRD_PARTY_ATTR_RE =
  /(?:对方|伙伴|旧部|创业伙伴)(?:明确|坚持|要求|不愿|希望|感知|作为)|合盘|第三人|他(?:明确|坚持|要求|不愿|感知)|她(?:明确|坚持|要求|希望)/;

/**
 * Natal chart may only explain the querent. Detect "partner psychology from 正官" style leaks.
 */
export function detectThirdPartyNatalAttribution(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  const m = t.match(THIRD_PARTY_ATTR_RE);
  return m ? m[0]! : null;
}

/** Ganzhi that look like cycle steps (大运/流年) must be in cycle_rhythm thesis facts. */
export function detectUngroundedCycleGanzhi(
  text: string,
  cycleCorpus: string,
  slug: string,
): string | null {
  const blob = `${slug}\n${text}`;
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

type SignalLike = NonNullable<
  ThesisCoverageUnit["necessary_signals"]
>[number];

/** Per-signal thesis gap reason, or null if ok. */
export function signalThesisGapReason(
  signal: SignalLike,
  thesis: ChartThesis,
  corpora?: Map<string, string>,
): string | null {
  const map = corpora ?? buildThesisDimensionCorpora(thesis);
  const known = new Set(map.keys());
  const cycleCorpus = map.get("cycle_rhythm") ?? "";

  const slug = (signal.slug ?? "").trim();
  const dim = signal.dimension_id?.trim() ?? "";
  const inference = (signal.inference_zh ?? "").trim();
  const role = (signal.role ?? "").trim();
  const why = (signal.why_needed ?? "").trim();
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

  const corpus = map.get(dim) ?? "";
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
  return null;
}

export function validateAssignmentThesisCoverage(
  assignment: { units: readonly ThesisCoverageUnit[] },
  thesis: ChartThesis | null | undefined,
): string | null {
  if (!thesis?.dimensions?.length) return null;
  const corpora = buildThesisDimensionCorpora(thesis);
  for (const u of assignment.units) {
    for (const s of u.necessary_signals ?? []) {
      const fail = signalThesisGapReason(s, thesis, corpora);
      if (fail) return fail;
    }
  }
  return null;
}

export type SoftStripThesisResult<T> = {
  assignment: T;
  stripped_slugs: string[];
  emptied_paths: string[];
};

/**
 * Deterministic soft-fix: drop signals that fail thesis gates (e.g. 金舆 shadow pool).
 * Canonicalizes kept slugs to the thesis fact token (大运丁酉→丁酉).
 */
export function softStripUngroundedThesisSignals<
  T extends {
    units: ReadonlyArray<{
      path: string;
      chart_anchors: string[];
      necessary_signals?: ReadonlyArray<SignalLike>;
      [key: string]: unknown;
    }>;
  },
>(assignment: T, thesis: ChartThesis): SoftStripThesisResult<T> {
  const corpora = buildThesisDimensionCorpora(thesis);
  const stripped_slugs: string[] = [];
  const emptied_paths: string[] = [];

  const units = assignment.units.map((u) => {
    const kept: SignalLike[] = [];
    for (const s of u.necessary_signals ?? []) {
      const fail = signalThesisGapReason(s, thesis, corpora);
      if (fail) {
        const slug = (s.slug ?? "").trim() || "(empty)";
        if (!stripped_slugs.includes(slug)) stripped_slugs.push(slug);
        continue;
      }
      const dim = s.dimension_id?.trim() ?? "";
      const corpus = corpora.get(dim) ?? "";
      const canonical = resolveSlugToThesisToken(corpus, s.slug ?? "") ?? s.slug;
      kept.push({ ...s, slug: canonical });
    }
    if (kept.length === 0 && (u.necessary_signals?.length ?? 0) > 0) {
      emptied_paths.push(u.path);
    }
    return {
      ...u,
      necessary_signals: kept,
      chart_anchors: kept
        .map((x) => (x.slug ?? "").trim())
        .filter(Boolean)
        .slice(0, 4),
    };
  });

  return {
    assignment: { ...assignment, units } as T,
    stripped_slugs,
    emptied_paths,
  };
}

/**
 * Drop prefer_primary values that are not present in any thesis verified fact.
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
      out[path] = resolveSlugToThesisToken(corpus, p) ?? p;
    }
  }
  return out;
}

/** Ganzhi appearing in cycle_rhythm thesis facts (for inventory allowlist). */
export function thesisCycleGanzhiAllowlist(thesis: ChartThesis): string[] {
  const corpus = buildThesisDimensionCorpora(thesis).get("cycle_rhythm") ?? "";
  const hits = corpus.match(GANZHI_RE) ?? [];
  return [...new Set(hits)];
}

/** Keep only tokens that appear in thesis verified facts. */
export function filterTokensToThesis(
  tokens: readonly string[] | null | undefined,
  thesis: ChartThesis | null | undefined,
): string[] {
  if (!tokens?.length) return [];
  if (!thesis?.dimensions?.length) return [...tokens];
  const corpus = thesisAllFactsCorpus(thesis);
  return tokens
    .map((t) => {
      const s = t.trim();
      if (!s) return null;
      return resolveSlugToThesisToken(corpus, s);
    })
    .filter((x): x is string => Boolean(x));
}
