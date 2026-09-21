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

export type DeepEvidenceQualityResult =
  | { ok: true; notes: string[] }
  | { ok: false; reason: string; notes: string[] };

const MIN_EVIDENCE_CHARS = 36;
/** Near-duplicate evidence between units (Batch2 A). Exact = 1.0. */
export const UNIT_ECHO_SIMILARITY_THRESHOLD = 0.92;
/** Re-export SSOT for write/assign/fill callers. */
export { CROSS_PAGE_PRIMARY_ANCHOR_JACCARD, assessCrossPagePrimaryAnchorReuse };

function clauseCount(evidence: string): number {
  const parts = evidence
    .split(/[。！？；;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);
  return parts.length;
}

/** Exported for write-chunk gate (same SSOT as merge shallow check). */
export function countDeepEvidenceClauses(evidence: string): number {
  return clauseCount(evidence);
}

/**
 * Per-unit depth checks shared by write chunk + merge.
 * Returns first failure reason or null if ok.
 */
export function assessDeepEvidenceUnitDepth(
  u: Pick<DeepEvidenceUnit, "path" | "evidence" | "chart_anchors">,
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
  const slots = wordSlotInners(ev);
  if (slots.size < 1) {
    return `deep_evidence_missing_w_slot:${u.path}`;
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
    const maxJ = maxPairwiseAnchorJaccard(plan.units);
    notes.push(`deep_evidence_max_anchor_jaccard:${maxJ.toFixed(2)}`);
    if (maxJ >= DEEP_EVIDENCE_ANCHOR_JACCARD_MAX) {
      return {
        ok: false,
        reason: "deep_evidence_anchor_reuse",
        notes,
      };
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
