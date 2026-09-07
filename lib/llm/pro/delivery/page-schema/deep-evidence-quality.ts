/**
 * Deep-evidence quality gates (Batch 3 hardening):
 * depth (≥2 mechanism clauses), anchor↔evidence consistency, soft anti-reuse.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { WORD_SLOT_PATTERN } from "@/lib/llm/sanitize/term-marking";
import { inferP4MoatEligibleTypes } from "./p4-means-gate";
import type { DeepEvidencePlan, DeepEvidenceUnit } from "./deep-evidence-prompt";

export type DeepEvidenceQualityResult =
  | { ok: true; notes: string[] }
  | { ok: false; reason: string; notes: string[] };

const MIN_EVIDENCE_CHARS = 36;

function clauseCount(evidence: string): number {
  const parts = evidence
    .split(/[。！？；;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);
  return parts.length;
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

function jaccard(a: readonly string[], b: readonly string[]): number {
  const A = new Set(a.map((x) => x.trim()).filter(Boolean));
  const B = new Set(b.map((x) => x.trim()).filter(Boolean));
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

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

function unitMentionsMoatClass(
  u: DeepEvidenceUnit,
  cls: "timing" | "polarity" | "archetype",
): boolean {
  const blob = `${u.chart_anchors.join(" ")} ${u.evidence}`;
  if (cls === "timing") {
    return /大运|岁运|流年|运程|阶段窗|纪元/.test(blob);
  }
  if (cls === "polarity") {
    return /用神|忌神|喜神|补泄|虚旺|五行/.test(blob);
  }
  return /(比肩|劫财|食神|伤官|偏财|正财|七杀|正官|偏印|正印|十神|官杀|格局)/.test(blob);
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
  },
): DeepEvidenceQualityResult {
  const notes: string[] = [];

  for (const u of plan.units) {
    const ev = u.evidence.trim();
    if (ev.length < MIN_EVIDENCE_CHARS) {
      notes.push(`deep_evidence_too_short:${u.path}`);
      return { ok: false, reason: `deep_evidence_too_short:${u.path}`, notes };
    }
    if (clauseCount(ev) < 2) {
      notes.push(`deep_evidence_shallow:${u.path}`);
      return { ok: false, reason: `deep_evidence_shallow:${u.path}`, notes };
    }
    const slots = wordSlotInners(ev);
    if (slots.size < 1) {
      notes.push(`deep_evidence_missing_w_slot:${u.path}`);
      return { ok: false, reason: `deep_evidence_missing_w_slot:${u.path}`, notes };
    }
    for (const a of u.chart_anchors) {
      if (!anchorAppearsInEvidence(a, ev, slots)) {
        notes.push(`deep_evidence_anchor_mismatch:${a}@${u.path}`);
        return {
          ok: false,
          reason: `deep_evidence_anchor_mismatch:${a}`,
          notes,
        };
      }
    }
  }

  if (plan.units.length >= 3) {
    const maxJ = maxPairwiseAnchorJaccard(plan.units);
    notes.push(`deep_evidence_max_anchor_jaccard:${maxJ.toFixed(2)}`);
    if (maxJ >= 0.85) {
      return {
        ok: false,
        reason: "deep_evidence_anchor_reuse",
        notes,
      };
    }
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
    unique_anchors: allAnchors.size,
  };
}
