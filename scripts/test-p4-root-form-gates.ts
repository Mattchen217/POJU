/**
 * P4 root fix regression: menu ritual uniqueness · deliverable gate ·
 * ritual pillar name · ten-god enrich · dayun near-window · #20 ban-tail scrub.
 * Run: pnpm exec tsx scripts/test-p4-root-form-gates.ts
 */

import assert from "node:assert/strict";
import { buildMetaphysicsMoatFeedBlock } from "../lib/llm/pro/delivery/metaphysics-moat-feed";
import { stampPageChartAnchorsFromDeepPlan } from "../lib/llm/pro/delivery/page-schema/anchor-quality";
import { assessP4DayunTimingNearWindow } from "../lib/llm/pro/delivery/page-schema/assign-fact-pack-claim-gate";
import {
  findP4RitualStemReuse,
  gateP4DimensionDensity,
  gateP4StrategyMoat,
  isP4CoachPmMean,
  isP4DeliverableSwapMean,
  isP4P3ToolWordFamilyMean,
  P4_RITUAL_ACTION_STEMS,
  scrubP4MeansInstructionNoise,
  softRepairP4DropP3ToolSentences,
  softStripP4CoachPmMeans,
} from "../lib/llm/pro/delivery/page-schema/p4-means-gate";
import { castDeliveryQimenFactPack } from "../lib/llm/pro/delivery/page-schema/qimen-fact-pack";
import type { DeepEvidencePlan } from "../lib/llm/pro/delivery/page-schema/deep-evidence-prompt";
import type { BreakthroughCore } from "../lib/poju/agent-state";

const lockAt = new Date("2026-09-25T15:30:00.000Z");
const qimen = castDeliveryQimenFactPack({ castAt: lockAt });

const core = {
  metaphysics_pack: {
    yong_shen: {
      primary_yong_shen: "water",
      ji_shen: ["fire", "earth"],
    },
  },
  energy_retune_frame: {
    timing_ripeness: "未熟",
    structural_basis: "大运壬寅气候交织",
    direction_fit: "",
    daily_retune: "",
    complementary: "",
  },
  multi_dimension_reckoning: [
    {
      dimension: "十神格局",
      judgment: "食神透干偏显，偏印内守对照",
      chart_basis: "时柱辛未食神；年柱偏印",
    },
  ],
} as unknown as BreakthroughCore;

const { block } = buildMetaphysicsMoatFeedBlock(core, null, {
  original_question: "前同事拉我进项目",
  desired_outcome: "兼职试水",
  qimen,
});

assert.ok(block.includes("【仪轨互斥"), "menu header ritual mutex");
assert.ok(block.includes("【站位禁交付物"), "menu bans deliverable");
assert.ok(block.includes("【一句话动作锚"), "one-line action speech allowed");
assert.ok(block.includes("行为仪轨"), "ritual pillar in menu");
assert.ok(
  !/技术方案|技术文档|架构说明/.test(block.replace(/禁[^\n]*/g, "")),
  "deliverable stems must not appear as means drafts",
);

const meansBodies = [...block.matchAll(/means\d:\s*([^\n]+)/g)].map(
  (m) => m[1] ?? "",
);
const stemOwner = new Map<string, number>();
for (let i = 0; i < meansBodies.length; i++) {
  const body = meansBodies[i]!;
  for (const stem of P4_RITUAL_ACTION_STEMS) {
    if (!stem.re.test(body)) continue;
    const prev = stemOwner.get(stem.id);
    if (prev !== undefined && prev !== i) {
      assert.fail(
        `menu ritual stem "${stem.id}" reused across means[${prev}] and means[${i}]`,
      );
    }
    stemOwner.set(stem.id, i);
  }
}
assert.ok(
  stemOwner.size >= 3,
  `expected ≥3 ritual stems in menu, got ${stemOwner.size}`,
);

assert.equal(isP4DeliverableSwapMean("我先整理一份技术方案，明天发你"), true);
assert.equal(
  isP4P3ToolWordFamilyMean("通过交付技术文档、架构说明来展示价值"),
  true,
);
assert.equal(isP4DeliverableSwapMean("拉开时空差，明天给你答复"), false);
const stripped = softRepairP4DropP3ToolSentences(
  "先稳住气场。我先整理一份技术方案，明天发你。再背靠实墙。",
);
assert.equal(stripped.repaired, true);
assert.equal(/技术方案/.test(stripped.text), false);
assert.ok(/稳住气场|背靠实墙/.test(stripped.text), stripped.text);

const baseDim = {
  strategy:
    "对方气场偏强时，先守成不硬顶；拉开时空缓冲，待气定后再应，守住兼职试水的身心结界。",
  means: [
    { text: "关键表态前先拉开时空差，气定后再应", type: "timing" },
    { text: "走到通风开阔处切断高压场", type: "polarity" },
  ],
  chart_anchors: ["客克主", "值使"],
};

{
  const bad = gateP4StrategyMoat({
    dimensions: [
      { ...baseDim, name: "局势交锋 · 客强主弱" },
      { ...baseDim, name: "意象调频 · 涵养" },
      { ...baseDim, name: "站位借势 · 侧翼" },
    ],
    eastern_calc_slice: "【奇门锁盘·交付起局】\n局: 陰遁一局\n客克主",
  });
  assert.equal(bad.structural, true);
  assert.equal(bad.structural_reason, "p4_missing_ritual_pillar");
}

{
  const ok = gateP4StrategyMoat({
    dimensions: [
      {
        name: "局势交锋 · 客强主弱",
        strategy: "客克主局中宜看清虚高声势，近窗未熟时先守气口再借势。",
        means: [
          {
            text: "拉开时空差，可用一句「我考虑一下，明天给你答复」",
            type: "timing",
          },
          { text: "进取前换到背靠实墙的清静场", type: "timing" },
        ],
        chart_anchors: ["客克主", "值使"],
      },
      {
        name: "意象调频 · 静润",
        strategy: "用神水偏弱、忌火偏旺时，先静润降温，不入催促火阵。",
        means: [
          { text: "靠近用神水意象——静润降温", type: "polarity" },
          { text: "燥气上涌时先温凉饮一口", type: "polarity" },
        ],
        chart_anchors: ["用神水", "忌神火"],
      },
      {
        name: "行为仪轨 · 场域锚点",
        strategy: "忌火燥热时，用空间动线切断高压场，让急躁落地。",
        means: [
          { text: "走到通风开阔处站立片刻", type: "polarity" },
          { text: "深呼吸三轮泄掉燥气", type: "polarity" },
        ],
        chart_anchors: ["忌神火"],
      },
    ],
    eastern_calc_slice: "【奇门锁盘·交付起局】\n局: 陰遁一局\n客克主\n用神: 水",
  });
  assert.equal(ok.structural, false, ok.notes.join(";"));
}

{
  const reuse = findP4RitualStemReuse([
    { name: "a", strategy: "x", means: ["静坐片刻回稳"] },
    { name: "b", strategy: "y", means: ["独坐三分钟再应"] },
  ]);
  assert.equal(reuse, "静坐");
  const gated = gateP4StrategyMoat({
    dimensions: [
      {
        name: "局势交锋",
        strategy: "客克主局中近窗未熟先守。",
        means: ["静坐片刻", "拉开时空差"],
        chart_anchors: ["客克主"],
      },
      {
        name: "意象调频",
        strategy: "用神水偏弱。",
        means: ["温凉饮一口"],
        chart_anchors: ["用神水"],
      },
      {
        name: "行为仪轨",
        strategy: "切断高压场。",
        means: ["独坐回稳", "通风开阔处"],
        chart_anchors: ["忌神火"],
      },
    ],
    eastern_calc_slice: "【奇门锁盘·交付起局】\n客克主\n用神: 水",
  });
  assert.equal(gated.structural_reason, "p4_ritual_stem_reuse");
}

{
  const deliverableGate = gateP4StrategyMoat({
    dimensions: [
      {
        name: "局势交锋",
        strategy: "客克主局中近窗未熟先守。",
        means: ["拉开时空差"],
        chart_anchors: ["客克主"],
      },
      {
        name: "意象调频",
        strategy: "用神水偏弱。",
        means: ["温凉饮一口"],
        chart_anchors: ["用神水"],
      },
      {
        name: "行为仪轨",
        strategy: "站位借势。",
        means: ["我先整理一份技术方案，明天发你"],
        chart_anchors: ["食神"],
      },
    ],
    eastern_calc_slice: "【奇门锁盘·交付起局】\n客克主\n用神: 水",
  });
  assert.equal(deliverableGate.structural_reason, "p4_p3_tool_word_family");
}

{
  const plan: DeepEvidencePlan = {
    page: "metaphysics_action",
    units: [
      {
        path: "dimensions[0]",
        chart_anchors: [],
        evidence: "食神透干偏显，格局以食神为泄秀主轴。",
        unit_claim: "食神透干偏显，格局以食神为显",
        calc_cite: "时柱辛未食神",
        moat_class: "archetype",
      },
    ],
  };
  const page: Record<string, unknown> = {
    dimensions: [
      {
        name: "站位借势 · 输出疏导表达者",
        strategy: "内在按泄秀节律者借势",
        means: ["体态半步退"],
        chart_anchors: ["壬寅", "丙午"],
      },
    ],
  };
  const notes = stampPageChartAnchorsFromDeepPlan(
    "metaphysics_action",
    page,
    plan,
  );
  assert.ok(
    notes.some((n) => n.startsWith("enriched_chart_anchors_with_ten_god")),
    notes.join(";"),
  );
  const anchors = (page.dimensions as Array<{ chart_anchors: string[] }>)[0]!
    .chart_anchors;
  assert.ok(anchors.includes("食神"), anchors.join(","));
}

assert.equal(
  assessP4DayunTimingNearWindow([
    {
      path: "dimensions[1]",
      unit_claim: "值使開門客克主，主方受制",
      calc_cite: "客克主",
      moat_class: "timing",
    },
    {
      path: "dimensions[4]",
      unit_claim: "当前大运壬寅气候交织，忌神成势",
      calc_cite: "当前大运壬寅",
      moat_class: "timing",
    },
  ]),
  "assign:timing_missing_near_window:dimensions[4]",
);
assert.equal(
  assessP4DayunTimingNearWindow([
    {
      path: "dimensions[1]",
      unit_claim: "值使開門客克主，主方受制",
      calc_cite: "客克主",
      moat_class: "timing",
    },
    {
      path: "dimensions[4]",
      unit_claim: "大运流年忌神交织，运岁近窗未熟",
      calc_cite: "当前大运壬寅",
      moat_class: "timing",
    },
  ]),
  null,
);

// attempt #20: Eastern ritual + trailing「不…股权」must scrub, not gut → means_thin
{
  const noisy =
    "回稳仪轨：深呼吸三轮泄掉燥气，确认气口回稳再继续——不在气浮时做任何关于全职或股权的承诺。";
  const scrubbed = scrubP4MeansInstructionNoise(noisy);
  assert.equal(/股权|全职/.test(scrubbed), false, scrubbed);
  assert.ok(/深呼吸三轮/.test(scrubbed), scrubbed);
  assert.equal(isP4CoachPmMean(scrubbed), false, scrubbed);
  const strip = softStripP4CoachPmMeans([
    {
      name: "行为仪轨",
      strategy:
        "感到燥热上涌时，立刻用空间动线切断高压场，让急躁落地后再决定是否加码回应；气口回稳才继续谈下一步。",
      means: [
        "感到燥热时走到通风开阔处站立片刻，用空间动线切断高压场。",
        noisy,
      ],
    },
  ]);
  assert.equal(strip.stripped, 0, strip.notes.join(";"));
  const means = strip.dimensions[0]!.means as unknown[];
  assert.equal(means.length, 2, JSON.stringify(means));
  // Density only cares means≥2 here; strategy length is a separate note.
  assert.ok(
    means.every((m) => meanTextLen(m) > 0),
    JSON.stringify(means),
  );
  const density = gateP4DimensionDensity({ dimensions: strip.dimensions });
  assert.equal(
    density.notes.some((n) => n.startsWith("p4_means_thin")),
    false,
    density.notes.join(";"),
  );
}

function meanTextLen(item: unknown): number {
  if (typeof item === "string") return item.trim().length;
  if (item && typeof item === "object") {
    return String(
      (item as { text?: unknown }).text ??
        (item as { body?: unknown }).body ??
        "",
    ).trim().length;
  }
  return 0;
}

// #21: compress vernacular「客强压主」must satisfy host-guest gate (零专名正文)
{
  const ok = gateP4StrategyMoat({
    dimensions: [
      {
        name: "局势交锋：拉开时空差",
        strategy:
          "客强压主，对方势头正盛，出手位被压；宜进取却不可躁进，先拉开半步时空差再借势。近窗未熟时先守气口。",
        means: [
          "拉开时空差，可用一句「我考虑一下，明天给你答复」",
          "进取前换到背靠实墙的清静场",
        ],
        chart_anchors: [],
      },
      {
        name: "意象调频",
        strategy: "用神水偏弱、忌火偏旺时，先静润降温，不入催促火阵。",
        means: ["静润降温", "温凉饮一口"],
        chart_anchors: ["用神水"],
      },
      {
        name: "行为仪轨 · 场域",
        strategy: "燥热上涌时用空间动线切断高压场，让急躁落地。",
        means: ["通风开阔处站立", "深呼吸三轮"],
        chart_anchors: ["忌神火"],
      },
    ],
    eastern_calc_slice: "【奇门锁盘·交付起局】\n客克主\n用神: 水",
  });
  assert.equal(
    ok.structural,
    false,
    `vernacular 客强压主 must pass, got ${ok.structural_reason}: ${ok.notes.join(";")}`,
  );
}

console.log("test-p4-root-form-gates: ok");
