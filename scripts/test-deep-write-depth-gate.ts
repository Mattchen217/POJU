/**
 * Write depth gate SSOT (same as merge shallow) + prompt contract smoke.
 * Run: pnpm exec tsx scripts/test-deep-write-depth-gate.ts
 */
import assert from "node:assert/strict";
import {
  assessDeepEvidenceUnitDepth,
  countDeepEvidenceClauses,
  assessDeepEvidenceQuality,
} from "@/lib/llm/pro/delivery/page-schema/deep-evidence-quality";
import { buildDeepEvidenceWriteChunkPrompt } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-write";
import type { DeepEvidenceAssignmentUnit } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-assign";

const shallow =
  "就本案表象在你侧的压力而言：⟦w:比肩⟧藏于月时支而不透，同辈助力微弱，导致我面对每月2-3万硬支出时，只能独自硬扛，无法分摊风险，因此对创业初期低薪极度敏感。";
assert.equal(countDeepEvidenceClauses(shallow), 1);
assert.equal(
  assessDeepEvidenceUnitDepth({
    path: "why_cards[1]",
    evidence: shallow,
    chart_anchors: ["比肩"],
  }),
  "deep_evidence_shallow:why_cards[1]",
);

const withSemicolon =
  "⟦w:比肩⟧藏于月时支而不透，同辈助力微弱；面对每月硬支出只能独自硬扛，因此对创业初期低薪极度敏感。";
assert.ok(countDeepEvidenceClauses(withSemicolon) >= 2);
assert.equal(
  assessDeepEvidenceUnitDepth({
    path: "why_cards[1]",
    evidence: withSemicolon,
    chart_anchors: ["比肩"],
  }),
  null,
);

const twoPeriods =
  "⟦w:正财⟧深藏地支，稳定收入需求内化。正因为牵制，你仍能腾出时间深度思考。";
assert.ok(countDeepEvidenceClauses(twoPeriods) >= 2);

const hollowLiuhe =
  "就本案表象在你侧的压力而言：⟦w:六合⟧你在结构上更易感到绑定与投入压力。";
assert.equal(countDeepEvidenceClauses(hollowLiuhe), 1);
assert.equal(
  assessDeepEvidenceUnitDepth({
    path: "why_cards[3]",
    evidence: hollowLiuhe,
    chart_anchors: ["六合"],
  }),
  "deep_evidence_shallow:why_cards[3]",
);

const planFail = assessDeepEvidenceQuality("foundation", {
  page: "foundation",
  units: [
    {
      path: "why_cards[1]",
      chart_anchors: ["比肩"],
      evidence: shallow,
      mechanism_tag: "surface_why",
    },
  ],
});
assert.equal(planFail.ok, false);
if (!planFail.ok) {
  assert.equal(planFail.reason, "deep_evidence_shallow:why_cards[1]");
}

const chunk: DeepEvidenceAssignmentUnit[] = [
  {
    path: "why_cards[0]",
    chart_anchors: ["比肩"],
    calc_cite: "财务底线",
    means_candidate_ref: "表象候选2",
    unit_claim: "比劫藏而不显导致独扛硬支出",
    necessary_signals: [
      {
        slug: "比肩",
        dimension_id: "interpersonal_pattern",
        inference_zh: "软腔一句",
        role: "独扛",
        why_needed: "解释硬支出焦虑",
      },
    ],
  },
];
const { system } = buildDeepEvidenceWriteChunkPrompt("foundation", {
  locale: "zh",
  core_conclusion: "测",
}, chunk);
assert.match(system, /deep_evidence_shallow|句读深度/);
assert.match(system, /仅用逗号/);
assert.match(system, /unit_claim/);
assert.match(system, /配合位|绑定与投入压力|就你侧/);

console.log("ok deep-write-depth-gate");
