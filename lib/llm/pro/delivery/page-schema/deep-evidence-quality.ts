/**
 * Deep-evidence quality gates:
 * depth (≥2 mechanism clauses), anchor↔evidence consistency,
 * unit evidence echo (exact / near-dup), cross-page primary-anchor hard reuse,
 * P4 moat thin (timing tightened in Batch3).
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { WORD_SLOT_PATTERN } from "@/lib/llm/sanitize/term-marking";
import {
  type CategoryTokenSets,
} from "./anchor-category-tally";
import { inferP4MoatEligibleTypes } from "./p4-means-gate";
import type { DeepEvidencePlan, DeepEvidenceUnit } from "./deep-evidence-prompt";
import {
  DEFAULT_PRIMARY_REUSE_CAP,
  validatePrimaryReuseCap,
} from "./preallocate-chart-primaries";
import {
  CROSS_PAGE_PRIMARY_ANCHOR_JACCARD,
  assessCrossPagePrimaryAnchorReuse,
} from "./cross-page-primary-reuse";
import { citeEchoedInEvidence, proseEchoesSituation } from "./situation-echo";

export { citeEchoedInEvidence, proseEchoesSituation };

export type DeepEvidenceQualityResult =
  | { ok: true; notes: string[] }
  | { ok: false; reason: string; notes: string[] };

const MIN_EVIDENCE_CHARS = 36;
/** Near-duplicate evidence between units (Batch2 A). Exact = 1.0. */
export const UNIT_ECHO_SIMILARITY_THRESHOLD = 0.92;
/** Re-export SSOT for write/assign/fill callers. */
export { CROSS_PAGE_PRIMARY_ANCHOR_JACCARD, assessCrossPagePrimaryAnchorReuse };

/**
 * Chart-judgment tokens (any natal chart / any question).
 * A clause with none of these is not 命理句读.
 */
const JUDGMENT_BEARING_RE =
  /[甲乙丙丁戊己庚辛壬癸]|[子丑寅卯辰巳午未申酉戌亥]|日主|用神|喜神|忌神|身强|身弱|中和|得令|得地|月令|年柱|月柱|日柱|时柱|年干|月干|日干|时干|大运|流年|流月|格局|藏干|透干|透出|正印|偏印|食神|伤官|比肩|劫财|正财|偏财|正官|七杀|印星|财星|官星|食伤|财库|三合|六合|半合|相冲|相刑|相害|贵人|华盖|禄神|命局|命盘|当令|当权|生扶|克制|受制|生克|调候|帮身|泄秀|印旺|印弱/;

/**
 * Soft-pressure / feeling frames. Topic-agnostic — never count as 批断.
 */
const SOFT_FRAME_RE =
  /更易感到|更易落入|更易处于|更易被当成|绑定与投入|配合位|让步位|该结构|就你侧|就本案表象|压力落在你侧|结构感受|结构上你更易|结构上更易/;

function splitEvidenceClauses(evidence: string): string[] {
  return evidence
    .split(/[。！？；;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);
}

function isJudgmentBearingClause(clause: string): boolean {
  return JUDGMENT_BEARING_RE.test(clause);
}

/** Querent-side vernacular with zero chart tokens — any topic. */
export function isSoftPaddingClause(clause: string): boolean {
  if (clause.length < 4) return false;
  if (isJudgmentBearingClause(clause)) return false;
  return true;
}

function packRoleElements(pack: string, label: "用神" | "喜神" | "忌神"): string[] {
  const hit = pack.match(new RegExp(`${label}：([^\\n]+)`));
  if (!hit?.[1]) return [];
  return [...hit[1]].filter((ch) => "木火土金水".includes(ch));
}

/** A clause that names an element as 用/喜/忌 when this chart's pack says otherwise. */
function mislabelsElementRole(clause: string, pack: string): boolean {
  const roles: Array<["用" | "喜" | "忌", "用神" | "喜神" | "忌神"]> = [
    ["用", "用神"],
    ["喜", "喜神"],
    ["忌", "忌神"],
  ];
  for (const [mark, label] of roles) {
    const allowed = packRoleElements(pack, label);
    if (allowed.length === 0) continue;
    const re = new RegExp(`(木|火|土|金|水)[^，。]{0,8}为${mark}`, "g");
    for (const hit of clause.matchAll(re)) {
      const element = hit[1] ?? "";
      if (element && !allowed.includes(element)) return true;
    }
  }
  return false;
}

const KE_ELEMENT: Record<string, string> = {
  木: "土",
  土: "水",
  水: "火",
  火: "金",
  金: "木",
};

const TEN_GOD_AFTER_GANZHI =
  "正印|偏印|食神|伤官|比肩|劫财|正财|偏财|正官|七杀|印星|财星|官星";

function lastElement(text: string): string {
  const found = text.match(/[木火土金水]/g);
  return found?.[found.length - 1] ?? "";
}

/** 被火冲克 applied to water, or 大运干支紧接一个十神, or a palace the pack never states. */
function reversedStrikeOrGlue(clause: string, priorElement: string, pack: string): boolean {
  if (
    new RegExp(
      `(?:大运|流年|流月)[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥](?:${TEN_GOD_AFTER_GANZHI})`,
    ).test(clause)
  ) {
    return true;
  }
  const palace = clause.match(/[\u4e00-\u9fff]{1,3}宫/);
  if (palace?.[0] && !pack.includes(palace[0])) return true;
  const strike = clause.match(/被[^。]{0,16}([木火土金水])[^。]{0,8}(?:冲克|所克|所冲|克制)/);
  const agent = strike?.[1] ?? "";
  if (agent && priorElement && KE_ELEMENT[agent] !== priorElement) return true;
  return false;
}

function splitRecommendation(clause: string): string[] {
  return clause
    .split(/(?=更宜|不宜|因此)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const CHART_ACTOR_RE =
  /[甲乙丙丁戊己庚辛壬癸]|[子丑寅卯辰巳午未申酉戌亥]|日主|月令|年柱|月柱|日柱|时柱|年干|月干|日干|时干|大运|流年|流月|正印|偏印|食神|伤官|食伤|比肩|劫财|正财|偏财|正官|七杀|印星|财星|官星|用神|喜神|忌神|身强|身弱/g;

const RELATION_VERB_RE =
  /克制|冲克|制官|制杀|相冲|相刑|相害|半合|六合|三合|生扶|透干|透出|为本气|根库|坐支|藏/;

/** One label plus vernacular, or a feeling aimed at a person. A real 生克合冲 stays. */
function isLoneGlossClause(clause: string): boolean {
  if (/不喜|喜欢|于人|感到/.test(clause)) return true;
  if (/^此乃/.test(clause)) return true;
  if (RELATION_VERB_RE.test(clause)) return false;
  const actors = clause.match(CHART_ACTOR_RE)?.length ?? 0;
  return actors === 1;
}

/** 受克 / 被制 / 受损 with no controller named in the same clause. */
function agentlessControl(clause: string): boolean {
  if (!/受克|被制|受损|被克/.test(clause)) return false;
  return !/(?:木|火|土|金|水|正印|偏印|食神|伤官|比肩|劫财|正财|偏财|正官|七杀|印星|财星|官星|日主).{0,8}(?:克制|冲克|克)/.test(
    clause,
  );
}

function branchPairKey(text: string): string | null {
  const adjacent = text.match(
    /([子丑寅卯辰巳午未申酉戌亥])([子丑寅卯辰巳午未申酉戌亥])(?:相冲|相刑|相害|半合|六合|三合)/,
  );
  if (adjacent?.[1] && adjacent[2] && adjacent[1] !== adjacent[2]) {
    return [adjacent[1], adjacent[2]].sort().join("");
  }
  const uniq = [...new Set(text.match(/[子丑寅卯辰巳午未申酉戌亥]/g) ?? [])];
  if (uniq.length !== 2) return null;
  return uniq.sort().join("");
}

/** A 合冲刑害 whose two branches are not this card's claim. */
function extraRelationClause(clause: string, unitClaim: string): boolean {
  if (!unitClaim.trim()) return false;
  if (!/(?:相冲|相刑|相害|半合|六合|三合)/.test(clause)) return false;
  const clausePair = branchPairKey(clause);
  if (!clausePair) return false;
  const claimPair = branchPairKey(unitClaim);
  if (!claimPair) return true;
  return clausePair !== claimPair;
}

function splitGlossTail(clause: string): string[] {
  return clause
    .split(/(?=亦主|之星|之象)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Drop feeling-only sentences, a reversed strike, and a role label the fact pack contradicts. */
export function stripSoftPaddingEvidence(
  evidence: string,
  factPack = "",
  unitClaim = "",
): string {
  const pieces = evidence
    .split(/[，,。！？；;\n]+/)
    .flatMap((part) => splitRecommendation(part.trim()))
    .flatMap((part) => splitGlossTail(part))
    .filter(Boolean);
  const kept: string[] = [];
  let priorElement = "";
  for (const piece of pieces) {
    if (piece.length < 4 && !isJudgmentBearingClause(piece)) continue;
    if (isSoftPaddingClause(piece)) continue;
    if (isLoneGlossClause(piece)) continue;
    if (agentlessControl(piece)) continue;
    if (extraRelationClause(piece, unitClaim)) continue;
    if (factPack && mislabelsElementRole(piece, factPack)) continue;
    if (reversedStrikeOrGlue(piece, priorElement, factPack)) continue;
    kept.push(piece);
    const element = lastElement(piece);
    if (element) priorElement = element;
  }
  if (kept.length === 0) return "";
  return `${kept.join("。")}。`;
}

function clauseCount(evidence: string): number {
  return splitEvidenceClauses(evidence).length;
}

/** Exported for write-chunk gate (same SSOT as merge shallow check). */
export function countDeepEvidenceClauses(evidence: string): number {
  return clauseCount(evidence);
}

/**
 * Per-unit depth checks shared by write chunk + merge.
 * Returns first failure reason or null if ok.
 *
 * Plain judgment (empty chart_anchors = step-1 fact-pack): category gates only —
 * unmarked 命理句读, no soft frames, no cite echo. Not a per-case phrase list.
 */
export function assessDeepEvidenceUnitDepth(
  u: Pick<DeepEvidenceUnit, "path" | "evidence" | "chart_anchors"> & {
    calc_cite?: string | null;
  },
): string | null {
  const ev = (u.evidence ?? "").trim();
  if (ev.length < MIN_EVIDENCE_CHARS) {
    return `deep_evidence_too_short:${u.path}`;
  }
  if (clauseCount(ev) < 2) {
    return `deep_evidence_shallow:${u.path}`;
  }
  // Soft-repair intimacy/partnership one-liner must not ship (Lab P5 write 假绿).
  if (
    /^(?:就你侧的结构感受而言|就本案表象在你侧的压力而言)[:：]/.test(ev) &&
    !/[。！？]/.test(ev.replace(/^(?:就你侧的结构感受而言|就本案表象在你侧的压力而言)[:：]/, ""))
  ) {
    return `deep_evidence_friction_shell:${u.path}`;
  }
  const plainJudgment = u.chart_anchors.length === 0;
  if (plainJudgment && /⟦/.test(ev)) {
    return `deep_evidence_marked:${u.path}`;
  }
  if (plainJudgment) {
    if (SOFT_FRAME_RE.test(ev)) {
      return `deep_evidence_shell:${u.path}`;
    }
    const clauses = splitEvidenceClauses(ev);
    if (clauses.some((c) => isSoftPaddingClause(c))) {
      return `deep_evidence_soft_padding:${u.path}`;
    }
    const judgmentClauses = clauses.filter((c) => isJudgmentBearingClause(c));
    if (judgmentClauses.length < 2) {
      return `deep_evidence_not_judgment:${u.path}`;
    }
    if (citeEchoedInEvidence(ev, u.calc_cite)) {
      return `deep_evidence_cite_paste:${u.path}`;
    }
    return null;
  }
  const slots = wordSlotInners(ev);
  if (slots.size < 1) {
    return `deep_evidence_missing_w_slot:${u.path}`;
  }
  if (slots.size === 1 && slots.has("该结构")) {
    return `deep_evidence_shell:${u.path}`;
  }
  const bare = ev.replace(/⟦w:该结构⟧/g, "");
  if (
    /配合位|让步位/.test(ev) &&
    !/[甲乙丙丁戊己庚辛壬癸]/.test(bare) &&
    !/日主|用神|喜神|忌神/.test(bare)
  ) {
    return `deep_evidence_shell:${u.path}`;
  }
  for (const a of u.chart_anchors) {
    if (!anchorAppearsInEvidence(a, ev, slots)) {
      return `deep_evidence_anchor_mismatch:${a}@${u.path}`;
    }
  }
  return null;
}

function wordSlotInners(evidence: string): Set<string> {
  const out = new Set<string>();
  WORD_SLOT_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WORD_SLOT_PATTERN.exec(evidence)) !== null) {
    const inner = String(m[1] ?? "").trim();
    if (inner) out.add(inner);
  }
  return out;
}

function anchorAppearsInEvidence(anchor: string, evidence: string, slots: Set<string>): boolean {
  const a = anchor.trim();
  if (!a) return false;
  if (slots.has(a)) return true;
  if (evidence.includes(a)) return true;
  for (const s of slots) {
    if (s.includes(a) || a.includes(s)) return true;
  }
  return false;
}

/**
 * Qualify-first: drop chart_anchors that never appear in evidence / ⟦w:⟧.
 * Invented aux (e.g. forceDiversify pool fill) must not trip
 * deep_evidence_anchor_mismatch — strip instead of LLM retry (rule 11).
 */
export function softStripUnmatchedDeepEvidenceAnchors<
  T extends { evidence?: string; chart_anchors: string[] },
>(units: readonly T[]): { units: T[]; stripped: boolean } {
  let stripped = false;
  const next = units.map((u) => {
    const evidence = u.evidence ?? "";
    const slots = wordSlotInners(evidence);
    const kept = u.chart_anchors.filter((a) =>
      anchorAppearsInEvidence(a, evidence, slots),
    );
    if (kept.length === u.chart_anchors.filter((a) => a.trim()).length) {
      return u;
    }
    stripped = true;
    if (kept.length > 0) {
      return { ...u, chart_anchors: kept };
    }
    // Prefer first ⟦w:⟧ inner so primary still matches evidence after diversify.
    const slotPrimary = [...slots][0];
    if (slotPrimary) {
      return { ...u, chart_anchors: [slotPrimary] };
    }
    const fallback = u.chart_anchors[0]?.trim();
    return { ...u, chart_anchors: fallback ? [fallback] : [] };
  });
  return { units: next, stripped };
}

function jaccard(a: readonly string[], b: readonly string[]): number {
  const A = new Set(a.map((x) => x.trim()).filter(Boolean));
  const B = new Set(b.map((x) => x.trim()).filter(Boolean));
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Within-page unit anchor Jaccard hard gate (≥3 units). */
export const DEEP_EVIDENCE_ANCHOR_JACCARD_MAX = 0.85;

function maxPairwiseAnchorJaccard(units: readonly DeepEvidenceUnit[]): number {
  let max = 0;
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const jv = jaccard(units[i]!.chart_anchors, units[j]!.chart_anchors);
      if (jv > max) max = jv;
    }
  }
  return max;
}

/** Assign-time / tests: pairwise chart_anchors Jaccard across units. */
export function maxAssignmentAnchorJaccard(
  units: readonly { chart_anchors: readonly string[] }[],
): number {
  let max = 0;
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const jv = jaccard(units[i]!.chart_anchors, units[j]!.chart_anchors);
      if (jv > max) max = jv;
    }
  }
  return max;
}

/** Collapse whitespace / punctuation for echo compare (keeps Han + slots). */
export function normalizeEvidenceForEcho(evidence: string): string {
  return (evidence ?? "")
    .replace(/\s+/g, "")
    .replace(/[，。；、,.!?！？：:（）()【】\[\]「」""'']/g, "");
}

function bigrams(s: string): Set<string> {
  const out = new Set<string>();
  if (s.length < 2) {
    if (s) out.add(s);
    return out;
  }
  for (let i = 0; i < s.length - 1; i++) {
    out.add(s.slice(i, i + 2));
  }
  return out;
}

/**
 * Similarity in [0,1]. Exact normalized match → 1.
 * Otherwise character-bigram Jaccard (catches near-paste).
 */
export function evidenceTextSimilarity(a: string, b: string): number {
  const A = normalizeEvidenceForEcho(a);
  const B = normalizeEvidenceForEcho(b);
  if (!A || !B) return 0;
  if (A === B) return 1;
  const ba = bigrams(A);
  const bb = bigrams(B);
  if (ba.size === 0 || bb.size === 0) return 0;
  let inter = 0;
  for (const x of ba) if (bb.has(x)) inter++;
  return inter / (ba.size + bb.size - inter);
}

export function maxPairwiseEvidenceSimilarity(units: readonly DeepEvidenceUnit[]): {
  max: number;
  pair: string | null;
  exact: boolean;
} {
  let max = 0;
  let pair: string | null = null;
  let exact = false;
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const ui = units[i]!;
      const uj = units[j]!;
      const sim = evidenceTextSimilarity(ui.evidence, uj.evidence);
      if (sim > max) {
        max = sim;
        pair = `${ui.path}↔${uj.path}`;
        exact = sim >= 1;
      }
    }
  }
  return { max, pair, exact };
}

/**
 * Timing moat must cite a phase *mechanism* (duration / turn / switch),
 * not mere atmosphere words like 纪元 alone (Batch3 B).
 */
export function unitMentionsMoatClass(
  u: DeepEvidenceUnit,
  cls: "timing" | "polarity" | "archetype",
): boolean {
  const blob = `${u.chart_anchors.join(" ")} ${u.evidence}`;
  if (cls === "timing") {
    const hasEraOrCycle = /大运|岁运|流年|运程|阶段窗|纪元|岁环/.test(blob);
    if (!hasEraOrCycle) return false;
    // Mechanism: how long / turn / switch / wait-window — not “正处于纪元” alone.
    return /多久|转折|切换|窗口|起运|交运|换运|阶段切换|等待|再图|节奏变化|运势转折|岁运交接/.test(
      blob,
    );
  }
  if (cls === "polarity") {
    return /用神|忌神|喜神|补泄|虚旺|五行/.test(blob);
  }
  return /(比肩|劫财|食神|伤官|偏财|正财|七杀|正官|偏印|正印|十神|官杀|格局)/.test(blob);
}

function primaryAnchorsFromPlan(plan: DeepEvidencePlan): string[] {
  // First two anchors per unit = primary load-bearing; de-dupe preserve order.
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of plan.units) {
    for (const a of u.chart_anchors.slice(0, 2)) {
      const t = a.trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

/**
 * Soft/hard quality checks after shape parse. Failures trigger one corrective resend.
 */
export function assessDeepEvidenceQuality(
  key: DeliverySegmentKey,
  plan: DeepEvidencePlan,
  opts?: {
    eastern_calc_slice?: string | null;
    core_conclusion?: string | null;
    prior_chart_anchors?: readonly string[];
    category_token_sets?: CategoryTokenSets | null;
    /** Job prealloc reuse cap (default 2). */
    primary_reuse_cap?: number;
  },
): DeepEvidenceQualityResult {
  const notes: string[] = [];
  const reuseCap = opts?.primary_reuse_cap ?? DEFAULT_PRIMARY_REUSE_CAP;

  for (const u of plan.units) {
    const unitFail = assessDeepEvidenceUnitDepth(u);
    if (unitFail) {
      notes.push(unitFail);
      return { ok: false, reason: unitFail, notes };
    }
  }

  // Batch2 A: exact / near-dup evidence across units (incl. P4 dim2≡dim3 paste).
  const echo = maxPairwiseEvidenceSimilarity(plan.units);
  notes.push(
    `deep_evidence_max_evidence_sim:${echo.max.toFixed(2)}${echo.pair ? `@${echo.pair}` : ""}`,
  );
  if (echo.max >= UNIT_ECHO_SIMILARITY_THRESHOLD) {
    return {
      ok: false,
      reason: echo.exact
        ? `deep_evidence_unit_echo:exact:${echo.pair ?? "?"}`
        : `deep_evidence_unit_echo:${echo.pair ?? "?"}`,
      notes,
    };
  }

  if (plan.units.length >= 3) {
    const anyAnchors = plan.units.some((u) =>
      u.chart_anchors.some((a) => a.trim().length > 0),
    );
    if (anyAnchors) {
      const maxJ = maxPairwiseAnchorJaccard(plan.units);
      notes.push(`deep_evidence_max_anchor_jaccard:${maxJ.toFixed(2)}`);
      if (maxJ >= DEEP_EVIDENCE_ANCHOR_JACCARD_MAX) {
        return {
          ok: false,
          reason: "deep_evidence_anchor_reuse",
          notes,
        };
      }
    } else {
      notes.push("deep_evidence_anchor_jaccard:skipped_fact_pack");
    }
  }

  // Batch2 A: cross-page primary-anchor hard reuse (no new category).
  const prior = (opts?.prior_chart_anchors ?? []).map((x) => x.trim()).filter(Boolean);
  const pagePrimaries = plan.units
    .map((u) => u.chart_anchors[0]?.trim() ?? "")
    .filter(Boolean);
  const reuseCheck = validatePrimaryReuseCap([...prior, ...pagePrimaries], {
    cap: reuseCap,
  });
  notes.push(`deep_evidence_primary_reuse_cap:${reuseCap}`);
  if (!reuseCheck.ok) {
    return {
      ok: false,
      reason: `deep_evidence_primary_reuse_cap:${reuseCheck.offenders[0] ?? "overflow"}`,
      notes: [...notes, ...reuseCheck.offenders],
    };
  }

  const cross = assessCrossPagePrimaryAnchorReuse({
    page_primaries: primaryAnchorsFromPlan(plan),
    prior_chart_anchors: prior,
    category_token_sets: opts?.category_token_sets,
  });
  notes.push(...cross.notes);
  if (!cross.ok) {
    return { ok: false, reason: cross.reason, notes };
  }

  // Soft topic hint note only (hard fail would need per-path topic model)
  const conclusion = (opts?.core_conclusion ?? "").trim();
  if (conclusion.length >= 8) {
    const hit = plan.units.some((u) => {
      const head = conclusion.slice(0, 12);
      return u.evidence.includes(head.slice(0, 4)) || conclusion.includes(u.path);
    });
    notes.push(hit ? "deep_evidence_topic_soft_hit" : "deep_evidence_topic_soft_miss");
  }

  if (key === "metaphysics_action") {
    const eligible = inferP4MoatEligibleTypes(opts?.eastern_calc_slice);
    if (eligible.size >= 2) {
      const covered = [...eligible].filter((cls) =>
        plan.units.some((u) => unitMentionsMoatClass(u, cls)),
      );
      notes.push(
        `deep_evidence_p4_moat_eligible:${[...eligible].join(",")}`,
        `deep_evidence_p4_moat_covered:${covered.join(",") || "(none)"}`,
      );
      if (covered.length < 2) {
        return {
          ok: false,
          reason: "deep_evidence_p4_moat_thin",
          notes,
        };
      }
    }
  }

  return { ok: true, notes };
}

/** Metrics helper for analyze script / tests. */
export function summarizeDeepEvidenceQuality(plan: DeepEvidencePlan): {
  unit_count: number;
  avg_evidence_chars: number;
  avg_clauses: number;
  max_anchor_jaccard: number;
  max_evidence_similarity: number;
  unique_anchors: number;
} {
  const chars = plan.units.map((u) => u.evidence.length);
  const clauses = plan.units.map((u) => clauseCount(u.evidence));
  const allAnchors = new Set(plan.units.flatMap((u) => u.chart_anchors));
  return {
    unit_count: plan.units.length,
    avg_evidence_chars:
      chars.length === 0 ? 0 : chars.reduce((a, b) => a + b, 0) / chars.length,
    avg_clauses:
      clauses.length === 0 ? 0 : clauses.reduce((a, b) => a + b, 0) / clauses.length,
    max_anchor_jaccard: maxPairwiseAnchorJaccard(plan.units),
    max_evidence_similarity: maxPairwiseEvidenceSimilarity(plan.units).max,
    unique_anchors: allAnchors.size,
  };
}
