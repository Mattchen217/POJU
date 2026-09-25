/**
 * Bug #3 + judgment stamp + P4 coach/depth gates.
 *   pnpm exec tsx scripts/test-bug3-anchor-gate.ts
 */
import assert from "node:assert/strict";
import {
  allowEmptyChartAnchorsOnFill,
  assessUnitAnchorQuality,
  collectPageAnchorUnits,
  extractChartStructureAnchorsFromProse,
  hygienizeChartAnchorsRawLayer,
  stampPageChartAnchorsFromDeepPlan,
} from "../lib/llm/pro/delivery/page-schema/anchor-quality";
import {
  gateP4DimensionDensity,
  gateP4PageMoatCoverage,
  isP4CoachPmMean,
  meansFailsDeCalcTest,
  softStripP4CoachPmMeans,
  softStripP4DeCalcGenericMeans,
  softStripP4GenericLeverageMeans,
  stampP4MeansTypesFromDeepPlan,
} from "../lib/llm/pro/delivery/page-schema/p4-means-gate";
import {
  extractP5ActionBrief,
  formatP3MeansBriefForP4Retune,
} from "../lib/llm/pro/delivery/page-schema/action-extractor";
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

// Soft-strip coach → keep ≥2 Eastern means → stamp → moat pass.
const stripLab = softStripP4CoachPmMeans([
  {
    strategy: "外部环境过旺时须靠近冷静补给场，远离持续掏空的过耗场",
    means: [
      "选择在冷静时段做关键决定，靠近补给场再拍板",
      "远离持续过耗场，先把急躁泄成可交付路径",
      "多与能提供策略建议的前辈或律师交流",
    ],
  },
  {
    strategy: "当前运程窗口内先切换策略，转折后再加大投入",
    means: [
      "设定一个观察期只以兼职参与",
      "项目出现客观冷静需求时再提出加大投入，等到阶段切换后再扩",
      "未熟窗口内只做守成准备，不加码跳步",
    ],
  },
  {
    strategy: "借势输出者角色定位建立话语权，不开创硬刚",
    means: [
      "主动提出技术方案用专业输出借势占据主动",
      "按食神气质守输出席位，不硬刚冲锋",
      "将技术贡献文档化作为股权依据",
    ],
  },
]);
assert.ok(stripLab.stripped >= 3, `expected coach strips, got ${stripLab.stripped}`);
assert.ok(stripLab.dimensions.length >= 2, "need ≥2 dims after coach strip");
for (const d of stripLab.dimensions) {
  assert.ok(
    Array.isArray(d.means) && d.means.length >= 2,
    `need ≥2 means after coach strip: ${JSON.stringify(d.means)}`,
  );
}
const stampRoot = { dimensions: stripLab.dimensions };
stampP4MeansTypesFromDeepPlan(stampRoot, {
  page: "metaphysics_action",
  units: [
    { path: "dimensions[0]", moat_class: "polarity" },
    { path: "dimensions[1]", moat_class: "timing" },
    { path: "dimensions[2]", moat_class: "archetype" },
  ],
});
const afterStrip = gateP4PageMoatCoverage({
  dimensions: (stampRoot.dimensions as Array<Record<string, unknown>>).map(
    (d) => ({
      means: d.means,
      strategy: d.strategy,
      chart_anchors: ["大运", "食神", "水"],
    }),
  ),
  eastern_calc_slice:
    "timing_ripeness: ok\nyong: 水\n【十神语义】食神\n【大运语义】壬寅",
});
assert.equal(
  afterStrip.structural,
  false,
  `after coach strip should pass, got ${afterStrip.structural_reason} notes=${afterStrip.notes.join("|")}`,
);

// Anchors: vernacular + raw duplicate → strip vernacular.
const hy = hygienizeChartAnchorsRawLayer([
  "年柱丁卯偏印",
  "深度直觉觉察",
  "大运壬寅",
]);
assert.ok(
  hy.anchors.some((a) => a.includes("偏印") || a.includes("丁卯")),
  `raw kept: ${hy.anchors}`,
);
assert.ok(!hy.anchors.includes("深度直觉觉察"), `vernacular gone: ${hy.anchors}`);
assert.ok(hy.stripped >= 1, "expected vernacular strip");

// Generic leverage strip.
const gen = softStripP4GenericLeverageMeans([
  {
    strategy: "守成窗口：未熟不加码",
    means: [
      "不把所有鸡蛋放在一个篮子里，降低对单一合作的依赖",
      "运程窗口切换后再加大投入",
    ],
  },
]);
assert.ok(gen.stripped >= 1);
assert.ok(
  (gen.dimensions[0]?.means as unknown[]).length === 1,
  "eggs-basket stripped",
);

// De-calc: calm-then-negotiate fails; window switch keeps.
assert.equal(
  meansFailsDeCalcTest(
    "当感到内心平静、思路清晰时，再谈具体合作条款，避免在压力下做决定。",
  ),
  true,
);
assert.equal(
  meansFailsDeCalcTest(
    "运程窗口切换后再加大投入，未熟先守结构节奏。",
  ),
  false,
);
assert.equal(
  meansFailsDeCalcTest(
    "在火旺的夏季和初秋，只做技术摸底和方案预研，不签署排他性协议。",
  ),
  false,
  "火旺 timing means must survive de-calc",
);
assert.equal(
  meansFailsDeCalcTest(
    "将股权条款正式谈判排到水旺时段，此前只做技术验证。",
  ),
  false,
  "水旺 timing means must survive de-calc",
);
const decalc = softStripP4DeCalcGenericMeans([
  {
    strategy: "守成窗口：未熟不加码，等待阶段切换",
    means: [
      "当感到内心平静、思路清晰时，再谈具体合作条款，避免在压力下做决定。",
      "运程窗口切换后再加大投入，未熟先守结构节奏。",
    ],
  },
]);
assert.ok(decalc.stripped >= 1);

// Density: single mean → fail.
const thin = gateP4DimensionDensity({
  dimensions: [
    {
      strategy: "当前运程窗口内先切换策略，转折后再加大投入，未熟不加码。",
      means: ["运程窗口切换后再加大投入"],
    },
    {
      strategy: "靠近用神补给场，远离忌神过耗场，以泄代克。",
      means: [
        "靠近能补给冷静弹性的状态场",
        "远离持续过耗场",
      ],
    },
  ],
});
assert.equal(thin.structural, true);
assert.equal(thin.structural_reason, "p4_means_thin");

// #7: soft coach — 谈判筹码 + 技术输出 keep; bare 谈判筹码 strip.
assert.equal(
  isP4CoachPmMean(
    "以技术输出者身份用专业交付借势，让依赖成为谈判筹码，不硬刚要股权。",
  ),
  false,
  "Eastern+谈判筹码 keep",
);
assert.equal(
  isP4CoachPmMean("先把谈判筹码准备好再开口谈股权条件。"),
  true,
  "bare 谈判筹码 strip",
);

assert.equal(
  meansFailsDeCalcTest(
    "以观察者姿态进入合作，摸清资源分布后借对方平台或侧翼自开，用深度直觉觉察判断。",
  ),
  false,
  "archetype 观察者/侧翼 must survive de-calc",
);

{
  const brief = extractP5ActionBrief({
    p1: {
      page: "direct_answer",
      primary: { name: "兼职试水", when: "now", chart_anchors: [] },
      backup: { name: "全职硬法律网", when: "if", chart_anchors: [] },
      core_judgment: "先兼职",
    } as never,
    p3: {
      page: "science_action",
      primary_toolkit: {
        angles: [
          {
            name: "主",
            strategy: "s",
            means: ["争取三个月兼职试水期", "开口前先问清楚话语权"],
            chart_anchors: ["大运壬寅"],
          },
        ],
      },
      backup_toolkit: { angles: [] },
    } as never,
    p4: null,
  });
  const block = formatP3MeansBriefForP4Retune(brief);
  assert.ok(block.includes("P3 执行面"), "P4 retune header");
  assert.ok(block.includes("兼职试水"), "primary name");
  assert.ok(
    block.includes("争取三个月兼职试水期"),
    "P3 means hung for P4",
  );
}

console.log("test-bug3-anchor-gate: ok");
