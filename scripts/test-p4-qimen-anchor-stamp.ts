/**
 * P4 L1–L3: qimen structure survives assign→write→fill chart_anchors.
 *   pnpm exec tsx scripts/test-p4-qimen-anchor-stamp.ts
 */
import assert from "node:assert/strict";
import {
  extractChartStructureAnchorsFromProse,
  stampPageChartAnchorsFromDeepPlan,
} from "../lib/llm/pro/delivery/page-schema/anchor-quality";
import { anchorsServeMoatClass } from "../lib/llm/pro/delivery/page-schema/p4-means-gate";
import {
  assessP4QimenTimingBinding,
  factPackAssignClaimRetryHint,
} from "../lib/llm/pro/delivery/page-schema/assign-fact-pack-claim-gate";
import {
  qimenStarDoorPalaceRetentionFail,
} from "../lib/llm/pro/delivery/page-schema/deep-evidence-quality";
import type { DeepEvidencePlan } from "../lib/llm/pro/delivery/page-schema/deep-evidence-prompt";

const qimenJudgment =
  "陰遁一局，值使開門落坎一宮，值符遁干壬克时干己，客克主，主方受制。己土克壬水。";

const extracted = extractChartStructureAnchorsFromProse(qimenJudgment, 3);
assert.ok(
  extracted.some((a) => /值使|開門|客克主|陰遁|坎一宮/.test(a)),
  `qimen stamp: ${extracted.join(",")}`,
);
assert.ok(
  extracted[0] && /值使|開門|客克主|陰遁|坎一宮|值符/.test(extracted[0]),
  `qimen preferred first: ${extracted.join(",")}`,
);

assert.equal(anchorsServeMoatClass(["客克主", "值使"], "timing"), true);
assert.equal(anchorsServeMoatClass(["開門", "坎一宮"], "timing"), true);
assert.equal(anchorsServeMoatClass(["陰遁一局"], "timing"), true);
assert.equal(anchorsServeMoatClass(["食神"], "timing"), false);

const plan: DeepEvidencePlan = {
  page: "metaphysics_action",
  units: [
    {
      path: "dimensions[0]",
      chart_anchors: [],
      evidence: qimenJudgment,
      unit_claim: "陰遁一局值使開門客克主，主方受制",
      calc_cite: "陰遁一局，值使開門落坎一宮，客克主",
      moat_class: "timing",
    },
  ],
};
const page: Record<string, unknown> = {
  dimensions: [
    {
      name: "局势",
      strategy: "门开进取",
      means: ["气定"],
      chart_anchors: ["壬寅", "丙午", "火"],
    },
  ],
};
const notes = stampPageChartAnchorsFromDeepPlan("metaphysics_action", page, plan);
assert.ok(
  notes.some((n) => n.startsWith("enriched_chart_anchors_with_qimen")),
  `enrich notes: ${notes.join(";")}`,
);
const anchors = (page.dimensions as Array<{ chart_anchors: string[] }>)[0]!
  .chart_anchors;
assert.ok(
  anchors.some((a) => /值使|開門|客克主|陰遁|坎一宮/.test(a)),
  `enriched: ${anchors.join(",")}`,
);

const claimHg =
  "陰遁一局值使開門落坎一宮，值符遁干壬水，时干己土，形成客克主之势，主方行动受制";
const citeHg =
  "值使: 開門落坎一宮 主客：值符遁干壬(水) · 时干己(土) → 客克主";
assert.equal(
  qimenStarDoorPalaceRetentionFail(
    "时干己土为客。值符遁干壬水为主。己土克壬水。客克主成立。主方受制。",
    claimHg,
    citeHg,
  ),
  "qimen_star_door_palace_missing",
);
assert.equal(
  qimenStarDoorPalaceRetentionFail(
    "陰遁一局。值使開門落坎一宮。时干己土克值符遁干壬水。客克主，主方受制。",
    claimHg,
    citeHg,
  ),
  null,
);

const qimenPack = [
  "【奇门锁盘·交付起局】",
  "局: 陰遁一局",
  "值符: 天蓬落坎一宮",
  "值使: 開門落坎一宮",
  "客克主，主方受制",
  "局势取向: 宜进取",
  "当前大运壬寅",
  "当前流年丙午",
].join("\n");
assert.equal(
  assessP4QimenTimingBinding(
    [
      {
        path: "dimensions[1]",
        unit_claim: "当前大运壬寅水透干，流年丙午助忌，运岁窗口未熟",
        calc_cite: "当前大运壬寅",
        moat_class: "timing",
      },
      {
        path: "dimensions[4]",
        unit_claim: "流年丙午火旺加剧忌神势",
        calc_cite: "当前流年丙午",
        moat_class: "timing",
      },
    ],
    { chart_fact_pack: qimenPack },
  ),
  "assign:timing_missing_qimen_bind",
);
assert.equal(
  assessP4QimenTimingBinding(
    [
      {
        path: "dimensions[1]",
        unit_claim: "值使開門客克主，主方受制",
        calc_cite: "客克主，主方受制",
        moat_class: "timing",
      },
      {
        path: "dimensions[4]",
        unit_claim: "当前大运壬寅水透干，流年丙午助忌",
        calc_cite: "当前大运壬寅",
        moat_class: "timing",
      },
    ],
    { chart_fact_pack: qimenPack },
  ),
  null,
);
assert.ok(
  factPackAssignClaimRetryHint("assign:timing_missing_qimen_bind").includes("奇门"),
);

console.log("test-p4-qimen-anchor-stamp: ok");
