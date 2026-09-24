/**
 * Bug #3 + judgment stamp + P4 coach gate.
 *   pnpm exec tsx scripts/test-bug3-anchor-gate.ts
 */
import assert from "node:assert/strict";
import {
  allowEmptyChartAnchorsOnFill,
  assessUnitAnchorQuality,
  collectPageAnchorUnits,
  extractChartStructureAnchorsFromProse,
  stampPageChartAnchorsFromDeepPlan,
} from "../lib/llm/pro/delivery/page-schema/anchor-quality";
import { gateP4PageMoatCoverage } from "../lib/llm/pro/delivery/page-schema/p4-means-gate";
import type { DeepEvidencePlan } from "../lib/llm/pro/delivery/page-schema/deep-evidence-prompt";

const emptyPlan: DeepEvidencePlan = {
  page: "metaphysics_action",
  units: [
    {
      path: "dimensions[0]",
      chart_anchors: [],
      evidence: "大运壬寅。流年丙午。忌神火旺。",
      unit_claim: "己土日主身强，大运壬寅用神水透干，流年丙午忌神火土成势",
      calc_cite: "大运壬寅",
      moat_class: "timing",
    },
    {
      path: "dimensions[1]",
      chart_anchors: [],
      evidence: "时柱辛未食神透干。印星克食神。",
      unit_claim: "己土日主，时柱辛未食神透干，印星克食神",
      calc_cite: "食神",
      moat_class: "archetype",
    },
  ],
};

assert.equal(allowEmptyChartAnchorsOnFill("foundation", emptyPlan), true);
assert.equal(allowEmptyChartAnchorsOnFill("metaphysics_action", emptyPlan), false);
assert.equal(allowEmptyChartAnchorsOnFill("science_action", emptyPlan), false);
assert.equal(allowEmptyChartAnchorsOnFill("risk_guard", emptyPlan), false);
assert.equal(allowEmptyChartAnchorsOnFill("signals_close", emptyPlan), false);

const extracted = extractChartStructureAnchorsFromProse(
  "己土日主身强，大运壬寅用神水透干，流年丙午忌神火土成势，食神受制",
  3,
);
assert.ok(extracted.includes("壬寅") || extracted.includes("丙午"), `ganzhi: ${extracted}`);
assert.ok(
  extracted.some((a) => a === "食神" || a === "用神" || a === "忌神" || a === "身强"),
  `structure: ${extracted}`,
);

const p4Page: Record<string, unknown> = {
  dimensions: [
    { name: "a", strategy: "x", means: ["y"], chart_anchors: [] },
    { name: "b", strategy: "x", means: ["y"], chart_anchors: [] },
  ],
};
const stampNotes = stampPageChartAnchorsFromDeepPlan(
  "metaphysics_action",
  p4Page,
  emptyPlan,
);
assert.ok(stampNotes.some((n) => n.startsWith("stamped_chart_anchors_from_judgment")));
const units = collectPageAnchorUnits("metaphysics_action", p4Page);
assert.ok(units.every((u) => u.anchors.length >= 1), JSON.stringify(units));

const emptyFail = assessUnitAnchorQuality({
  pageKey: "metaphysics_action",
  units: [
    { path: "dimensions[0]", anchors: [] },
    { path: "dimensions[1]", anchors: [] },
  ],
  allowEmptyAnchors: allowEmptyChartAnchorsOnFill("metaphysics_action", emptyPlan),
});
assert.equal(emptyFail.structuralFail, true);
assert.equal(emptyFail.reason, "all_content_units_missing_chart_anchors");

const foundationOk = assessUnitAnchorQuality({
  pageKey: "foundation",
  units: [
    { path: "why_cards[0]", anchors: [] },
    { path: "why_cards[1]", anchors: [] },
  ],
  allowEmptyAnchors: allowEmptyChartAnchorsOnFill("foundation", {
    units: [{ chart_anchors: [] }, { chart_anchors: [] }],
  }),
});
assert.equal(foundationOk.structuralFail, false);

// Lab-shaped coach means must fail (expanded P3_COACH_PM).
const coach = gateP4PageMoatCoverage({
  dimensions: [
    {
      strategy: "节奏窗口",
      means: [
        "利用内心更安定的时段约对方谈兼职；在当前运程窗口内先切换策略，转折前不硬冲",
      ],
      chart_anchors: ["大运"],
    },
    {
      strategy: "角色站位",
      means: [
        "找律师把试水期的权责利白纸黑字写清楚；按借势角色定位推进，不开创硬刚",
      ],
      chart_anchors: ["食神"],
    },
    {
      strategy: "结构守成",
      means: ["设定三个月试水期限，只以兼职身份交付，保护现有收入"],
      chart_anchors: ["忌神"],
    },
  ],
  eastern_calc_slice:
    "timing_ripeness: ok\nyong: 水\n【十神语义】食神\n【大运语义】壬寅",
});
assert.equal(coach.structural, true);
assert.ok(
  coach.structural_reason === "p4_coach_pm_means" ||
    coach.structural_reason === "p4_strategy_moat_thin" ||
    coach.structural_reason === "p4_science_exec_means",
  `coach reason: ${coach.structural_reason}`,
);

console.log("test-bug3-anchor-gate: ok");
