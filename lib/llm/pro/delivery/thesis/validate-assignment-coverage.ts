/**
 * Ensure assign signals are grounded in chart thesis (命盘总纲).
 *
 * Design invariant（换人换盘仍成立 — 禁止只贴本案例补丁）:
 * - Grounding = closed-set / ganzhi tokens extracted from *this* thesis corpus, not
 *   hand-maintained aliases for one dayun/one god.
 * - Hollow category shells（大运/用神/财星…）must refine to a concrete token present
 *   in corpus∩prose (丁酉/水/正财…), whatever that chart’s tokens are.
 * - Soft-strip remints hollow/bare/wrong-dim (and concrete↔inference mismatch) from
 *   prose∩*any* thesis dim before dropping — chart-agnostic salvage, not per-case patches.
 * - Third-party ban = known party as non-topic participant on *explanatory*
 *   fields only (inference/role/why)，not on unit_claim/calc_cite 表象引用.
 *   Detection is agency/topic-frame (see third-party-agency.ts), not volition verbs.
 * - Shadow 神煞/长生 stay out until thesis expands; soft-strip + prefer filter are
 *   corpus-driven, not name-list bans of 金舆 alone.
 *
 * When thesis is present:
 * - every necessary_signal MUST have dimension_id + inference_zh
 * - slug must ground (+ refine if hollow) to a fact token in that dim’s present corpus
 * - no third-party attribution from natal signals (硬闸)
 * - ganzhi used as dayun/cycle claims must appear in thesis cycle facts
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
import {
  detectKnownThirdPartyAgency,
  softRepairThirdPartyAgencyProse,
} from "@/lib/llm/pro/delivery/thesis/third-party-agency";

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
 * Hollow shells（大运/用神…）are not acceptable finals — see refineSlugAgainstThesis.
 */
export function resolveSlugToThesisToken(
  corpus: string,
  slug: string,
): string | null {
  const s = slug.trim();
  if (!s || !corpus) return null;
  const tokens = extractThesisFactTokens(corpus);

  // Prefer longest non-hollow closed-set / ganzhi core shared by slug and corpus.
  for (const t of tokens) {
    if (HOLLOW_STRUCTURAL_SLUGS.has(t)) continue;
    if (!s.includes(t)) continue;
    if (t.length >= 2) return t;
    if (
      (CLOSED_WUXING as readonly string[]).includes(t) &&
      (s === t || /^(?:用神|喜神|忌神)[:：]?[木火土金水]$/.test(s))
    ) {
      return t;
    }
  }

  // Hollow structural match only as interim (caller must refine).
  for (const t of tokens) {
    if (!HOLLOW_STRUCTURAL_SLUGS.has(t)) continue;
    if (s === t || s.includes(t)) return t;
  }

  if (corpus.includes(s)) return s;
  return null;
}

/**
 * Category shells that appear in thesis prose but cannot alone承重.
 * Chart-agnostic: any chart’s concrete token (六十甲子 / 十神 / 五行…) must replace these.
 */
export const HOLLOW_STRUCTURAL_SLUGS: ReadonlySet<string> = new Set([
  "大运",
  "流年",
  "流月",
  "用神",
  "喜神",
  "忌神",
  "日主",
  "岁运",
  "岁环",
  "纪元",
  "气候交织",
  "财星",
  "官杀",
  "印星",
  "比劫",
  "食伤",
  "十神",
  "藏干",
  "天干",
  "地支",
  "四柱",
  "八字",
  "命盘",
]);

/** 十二长生 — parked with 神煞；未扩总纲维前禁止 assign 承重（换盘仍成立）. */
const CHANGSHENG_SLUGS: ReadonlySet<string> = new Set(CLOSED_LIFE_STAGES);

const STEM_ONE_RE = /^[甲乙丙丁戊己庚辛壬癸]$/;
const BRANCH_ONE_RE = /^[子丑寅卯辰巳午未申酉戌亥]$/;

const GANZHI_ONE_RE =
  /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/;

/**
 * Resolve slug to a concrete thesis token. Hollow「大运/用神/藏干」must upgrade via prose.
 * Bare stem/branch upgrades to 十神 when prose+corpus name one.
 * Returns null if ungrounded or still hollow after refine.
 */
export function refineSlugAgainstThesis(
  corpus: string,
  slug: string,
  prose: string,
  dimension_id?: string,
): string | null {
  const s = slug.trim();
  if (!s) return null;
  if (CHANGSHENG_SLUGS.has(s)) return null;

  const grounded = resolveSlugToThesisToken(corpus, s);
  if (!grounded) return null;
  if (CHANGSHENG_SLUGS.has(grounded)) return null;

  const blob = `${s}\n${prose}`;
  const concrete = extractThesisFactTokens(corpus).filter(
    (t) =>
      !HOLLOW_STRUCTURAL_SLUGS.has(t) &&
      !CHANGSHENG_SLUGS.has(t),
  );
  const inProse = concrete.filter((t) => blob.includes(t));

  const pickPreferred = (pool: string[]): string | null => {
    if (dimension_id === "cycle_rhythm") {
      const gz = pool.find((t) => GANZHI_ONE_RE.test(t));
      if (gz) return gz;
    }
    if (dimension_id === "favor_avoid_tuning") {
      const wx = pool.find((t) => (CLOSED_WUXING as readonly string[]).includes(t));
      if (wx) return wx;
    }
    if (
      dimension_id === "resource_pattern" ||
      dimension_id === "interpersonal_pattern" ||
      dimension_id === "expression_creativity"
    ) {
      const god = pool.find((t) => (CLOSED_TEN_GODS as readonly string[]).includes(t));
      if (god) return god;
    }
    if (dimension_id === "day_master_strength") {
      const st = pool.find(
        (t) => t === "身弱" || t === "身强" || t === "从弱" || t === "从强",
      );
      if (st) return st;
    }
    return pool[0] ?? null;
  };

  // Bare stem/branch → prefer 十神 named in prose (丁 + 食神 → 食神)
  if (STEM_ONE_RE.test(grounded) || BRANCH_ONE_RE.test(grounded) || STEM_ONE_RE.test(s) || BRANCH_ONE_RE.test(s)) {
    const god =
      pickPreferred(inProse.filter((t) => (CLOSED_TEN_GODS as readonly string[]).includes(t))) ??
      inProse.find((t) => (CLOSED_TEN_GODS as readonly string[]).includes(t));
    if (god) return god;
    // bare stem/branch alone is too thin for承重
    return null;
  }

  if (!HOLLOW_STRUCTURAL_SLUGS.has(grounded) && !HOLLOW_STRUCTURAL_SLUGS.has(s)) {
    return grounded;
  }

  return pickPreferred(inProse.length > 0 ? inProse : []) ?? null;
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

/**
 * Natal chart may only explain the querent.
 * Primary path: known/mentioned third party outside topic frames (agency).
 * Optional `knownParties` from agenda strengthens extraction; prose mentions still scan.
 */
export function detectThirdPartyNatalAttribution(
  text: string,
  knownParties: readonly string[] = [],
): string | null {
  return detectKnownThirdPartyAgency(text, knownParties);
}

/**
 * Deterministic neutralize: rewrite agency spans to querent-side pressure
 * (rule 11 soft-repair — no LLM). Leaves non-matching prose untouched.
 */
export function softRepairThirdPartyAttributionProse(
  text: string,
  knownParties: readonly string[] = [],
): string {
  const out = softRepairThirdPartyAgencyProse(text, knownParties);
  return collapseQuerentPressureStutter(out);
}

/** Collapse soft-repair / model stutter around 感到 / 该结构. */
export function collapseQuerentPressureStutter(text: string): string {
  let out = text.trim();
  if (!out) return out;
  const patterns: Array<[RegExp, string]> = [
    [/结构上你感到你在该结构下更易感到/g, "结构上你更易感到"],
    [/你感到你在该结构下更易感到/g, "你更易感到"],
    [/结构上你感到(?=你)/g, "结构上"],
    [/你在该结构下更易感到你在该结构下更易感到/g, "你在该结构下更易感到"],
    [/(你在该结构下更易感到){2,}/g, "你在该结构下更易感到"],
    [/(更易感到){2,}/g, "更易感到"],
    [/为什么你在该结构下更易感到紧密绑定与投入压力/g, "为何合局下你更难兼职试水"],
    [/解释为何你在该结构下更易感到紧密绑定与投入压力/g, "解释为何合局下你更难兼职试水"],
  ];
  for (const [re, rep] of patterns) {
    out = out.replace(re, rep);
  }
  return out.replace(/。{2,}/g, "。").trim();
}

export function softRepairAssignmentThirdPartySignals<
  T extends {
    units: ReadonlyArray<{
      necessary_signals?: ReadonlyArray<{
        slug?: string;
        dimension_id?: string;
        inference_zh?: string;
        role?: string;
        why_needed?: string;
        [key: string]: unknown;
      }>;
      [key: string]: unknown;
    }>;
  },
>(
  assignment: T,
  knownParties: readonly string[] = [],
): { assignment: T; repaired: boolean } {
  let repaired = false;
  const units = assignment.units.map((u) => {
    const signals = u.necessary_signals;
    if (!signals?.length) return u;
    const next = signals.map((s) => {
      let inference = softRepairThirdPartyAttributionProse(
        s.inference_zh ?? "",
        knownParties,
      );
      let role = softRepairThirdPartyAttributionProse(s.role ?? "", knownParties);
      let why = softRepairThirdPartyAttributionProse(
        s.why_needed ?? "",
        knownParties,
      );
      inference = collapseQuerentPressureStutter(inference);
      role = collapseQuerentPressureStutter(role);
      why = collapseQuerentPressureStutter(why);
      if (
        inference !== (s.inference_zh ?? "").trim() ||
        role !== (s.role ?? "").trim() ||
        why !== (s.why_needed ?? "").trim()
      ) {
        repaired = true;
      }
      return {
        ...s,
        inference_zh: inference || s.inference_zh,
        role: role || s.role,
        why_needed: why || s.why_needed,
      };
    });
    return { ...u, necessary_signals: next };
  });
  return { assignment: { ...assignment, units } as T, repaired };
}

export type ThesisCoverageOpts = {
  /** Parties extracted from this consultation's agenda/question. */
  known_third_parties?: readonly string[];
};

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
  opts?: ThesisCoverageOpts,
): string | null {
  const map = corpora ?? buildThesisDimensionCorpora(thesis);
  const known = new Set(map.keys());
  const cycleCorpus = map.get("cycle_rhythm") ?? "";
  const parties = opts?.known_third_parties ?? [];

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
  if (CHANGSHENG_SLUGS.has(slug)) {
    return `thesis_gap:slug_changsheng_parked:${slug}`;
  }

  const corpus = map.get(dim) ?? "";
  if (!slugGroundedInCorpus(corpus, slug)) {
    const elsewhere = thesisDimsContainingSlug(thesis, slug);
    if (elsewhere.length > 0) {
      return `thesis_gap:slug_wrong_dim:${slug}:cited=${dim}:found_in=${elsewhere.join("|")}`;
    }
    return `thesis_gap:slug_not_in_thesis:${slug}`;
  }

  const refined = refineSlugAgainstThesis(corpus, slug, prose, dim);
  if (!refined) {
    if (STEM_ONE_RE.test(slug) || BRANCH_ONE_RE.test(slug)) {
      return `thesis_gap:slug_bare_ganzhi:${slug}`;
    }
    return `thesis_gap:slug_too_generic:${slug}`;
  }

  const third = detectThirdPartyNatalAttribution(prose, parties);
  if (third) {
    return `thesis_gap:third_party_attr:${slug}:${third}`;
  }

  const badGz = detectUngroundedCycleGanzhi(prose, cycleCorpus, refined);
  if (badGz) {
    return `thesis_gap:cycle_ganzhi_not_in_thesis:${slug}:${badGz}`;
  }
  return null;
}

export function validateAssignmentThesisCoverage(
  assignment: { units: readonly ThesisCoverageUnit[] },
  thesis: ChartThesis | null | undefined,
  opts?: ThesisCoverageOpts,
): string | null {
  if (!thesis?.dimensions?.length) return null;
  const corpora = buildThesisDimensionCorpora(thesis);
  for (const u of assignment.units) {
    for (const s of u.necessary_signals ?? []) {
      const fail = signalThesisGapReason(s, thesis, corpora, opts);
      if (fail) return fail;
    }
  }
  return null;
}

export type SoftStripThesisResult<T> = {
  assignment: T;
  stripped_slugs: string[];
  emptied_paths: string[];
  /** Deterministic remints, e.g. `甲→伤官` / `食神→正印`. */
  reminted_slugs: string[];
};

function signalProseBlob(s: SignalLike): string {
  return [s.inference_zh, s.role, s.why_needed]
    .map((x) => (x ?? "").trim())
    .filter(Boolean)
    .join("\n");
}

export type ProseThesisHit = {
  slug: string;
  dimension_id: string;
};

/**
 * Concrete thesis tokens named in prose and grounded somewhere in this thesis.
 * Chart-agnostic: whatever tokens *this* thesis verifies.
 */
export function proseThesisConcreteHits(
  thesis: ChartThesis,
  prose: string,
): ProseThesisHit[] {
  const blob = prose.trim();
  if (!blob || !thesis.dimensions?.length) return [];
  const out: ProseThesisHit[] = [];
  const seen = new Set<string>();
  for (const dim of thesis.dimensions) {
    const corpus = dimCorpus(dim);
    if (!corpus.trim()) continue;
    for (const t of extractThesisFactTokens(corpus)) {
      if (HOLLOW_STRUCTURAL_SLUGS.has(t)) continue;
      if (CHANGSHENG_SLUGS.has(t)) continue;
      if (STEM_ONE_RE.test(t) || BRANCH_ONE_RE.test(t)) continue;
      if (!blob.includes(t)) continue;
      const key = `${dim.dimension_id}::${t}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ slug: t, dimension_id: dim.dimension_id });
    }
  }
  return out;
}

function pickPreferredProseHit(
  hits: readonly ProseThesisHit[],
  prefer_dim?: string,
): ProseThesisHit | null {
  if (hits.length === 0) return null;
  const inPrefer = prefer_dim
    ? hits.filter((h) => h.dimension_id === prefer_dim)
    : [];
  const pool = inPrefer.length > 0 ? inPrefer : hits;

  const god = pool.find((h) =>
    (CLOSED_TEN_GODS as readonly string[]).includes(h.slug),
  );
  if (god) return god;

  const strength = pool.find(
    (h) =>
      h.slug === "身弱" ||
      h.slug === "身强" ||
      h.slug === "从弱" ||
      h.slug === "从强",
  );
  if (strength) return strength;

  const gz = pool.find((h) => GANZHI_ONE_RE.test(h.slug));
  if (gz) return gz;

  const wx = pool.find((h) =>
    (CLOSED_WUXING as readonly string[]).includes(h.slug),
  );
  if (wx) return wx;

  return pool[0] ?? null;
}

/**
 * Deterministic salvage: hollow/bare/wrong-dim slug ← prose∩thesis concrete token;
 * or concrete slug that never appears in inference ← unique prose token (esp. 十神).
 * Returns null only when prose has no salvable thesis token.
 */
export function remintOrAlignSignalToThesisProse(
  signal: SignalLike,
  thesis: ChartThesis,
): SignalLike | null {
  if (!thesis.dimensions?.length) return null;
  const corpora = buildThesisDimensionCorpora(thesis);
  const prose = signalProseBlob(signal);
  const hits = proseThesisConcreteHits(thesis, prose);
  const preferDim = signal.dimension_id?.trim() || undefined;
  const pick = pickPreferredProseHit(hits, preferDim);

  const fail = signalThesisGapReason(signal, thesis, corpora);
  if (fail) {
    if (!pick) return null;
    return {
      ...signal,
      slug: pick.slug,
      dimension_id: pick.dimension_id,
    };
  }

  const dim = signal.dimension_id?.trim() ?? "";
  const corpus = corpora.get(dim) ?? "";
  const canonical =
    refineSlugAgainstThesis(corpus, signal.slug ?? "", prose, dim) ??
    (signal.slug ?? "").trim();
  if (!canonical) return pick ? { ...signal, slug: pick.slug, dimension_id: pick.dimension_id } : null;

  const hitSlugSet = new Set(hits.map((h) => h.slug));
  if (hitSlugSet.has(canonical)) {
    return { ...signal, slug: canonical, dimension_id: dim || signal.dimension_id };
  }

  // Slug grounded but not named in inference — align when prose has a clear unique load-bearer.
  const uniqueGods = [
    ...new Set(
      hits
        .filter((h) => (CLOSED_TEN_GODS as readonly string[]).includes(h.slug))
        .map((h) => h.slug),
    ),
  ];
  if (uniqueGods.length === 1) {
    const h =
      hits.find(
        (x) => x.slug === uniqueGods[0] && (!preferDim || x.dimension_id === preferDim),
      ) ?? hits.find((x) => x.slug === uniqueGods[0]);
    if (h) return { ...signal, slug: h.slug, dimension_id: h.dimension_id };
  }

  const uniqueAll = [...new Set(hits.map((h) => h.slug))];
  if (uniqueAll.length === 1 && hits[0]) {
    return {
      ...signal,
      slug: hits[0].slug,
      dimension_id: hits[0].dimension_id,
    };
  }

  // Ambiguous prose tokens — keep canonical (still valid).
  return { ...signal, slug: canonical, dimension_id: dim || signal.dimension_id };
}

/**
 * Deterministic soft-fix: remint/align from inference∩thesis, then drop only
 * unsavable signals. Canonicalizes kept slugs; caps cross-unit slug reuse.
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
>(
  assignment: T,
  thesis: ChartThesis,
  opts?: { slug_reuse_cap?: number } & ThesisCoverageOpts,
): SoftStripThesisResult<T> {
  const corpora = buildThesisDimensionCorpora(thesis);
  const stripped_slugs: string[] = [];
  const reminted_slugs: string[] = [];
  const emptied_paths: string[] = [];
  const reuseCap = opts?.slug_reuse_cap ?? 2;
  const reuseCounts = new Map<string, number>();
  const coverageOpts: ThesisCoverageOpts | undefined = opts?.known_third_parties
    ? { known_third_parties: opts.known_third_parties }
    : undefined;

  const units = assignment.units.map((u) => {
    const kept: SignalLike[] = [];
    for (const s of u.necessary_signals ?? []) {
      const beforeSlug = (s.slug ?? "").trim() || "(empty)";
      const salvaged = remintOrAlignSignalToThesisProse(s, thesis);
      if (!salvaged) {
        if (!stripped_slugs.includes(beforeSlug)) stripped_slugs.push(beforeSlug);
        continue;
      }
      const fail = signalThesisGapReason(salvaged, thesis, corpora, coverageOpts);
      if (fail) {
        if (!stripped_slugs.includes(beforeSlug)) stripped_slugs.push(beforeSlug);
        continue;
      }
      const dim = salvaged.dimension_id?.trim() ?? "";
      const corpus = corpora.get(dim) ?? "";
      const prose = signalProseBlob(salvaged);
      const canonical =
        refineSlugAgainstThesis(corpus, salvaged.slug ?? "", prose, dim) ??
        salvaged.slug;
      const key = (canonical ?? "").trim();
      const afterSlug = key || beforeSlug;
      if (afterSlug !== beforeSlug) {
        const note = `${beforeSlug}→${afterSlug}`;
        if (!reminted_slugs.includes(note)) reminted_slugs.push(note);
      }
      const used = reuseCounts.get(key) ?? 0;
      if (key && used >= reuseCap) {
        if (!stripped_slugs.includes(`${key}·reuse`)) {
          stripped_slugs.push(`${key}·reuse`);
        }
        continue;
      }
      if (key) reuseCounts.set(key, used + 1);
      kept.push({ ...salvaged, slug: canonical });
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
    reminted_slugs,
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
