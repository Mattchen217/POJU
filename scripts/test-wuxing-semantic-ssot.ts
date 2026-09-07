/**
 * Wuxing semantic SSOT + P4 means gate.
 * Run: pnpm exec tsx scripts/test-wuxing-semantic-ssot.ts
 */

import assert from "node:assert/strict";
import {
  WUXING_ELEMENTS,
  WUXING_SEMANTIC_SSOT,
  classifyMeansActionType,
  formatWuxingSemanticForPrompt,
  textHitsBlacklist,
  textHitsWhitelist,
} from "../lib/glossary/wuxing-semantic-ssot";
import { gateP4DimensionMeans, gateP4PageMoatCoverage, inferP4MoatEligibleTypes } from "../lib/llm/pro/delivery/page-schema/p4-means-gate";
import { sanitizePageJson } from "../lib/llm/pro/delivery/page-schema/sanitize";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

for (const el of WUXING_ELEMENTS) {
  const row = WUXING_SEMANTIC_SSOT[el];
  assert.ok(row.ontology.length > 8, `${el} ontology`);
  assert.ok(row.deficiency.direction.rhythm, `${el} rhythm direction`);
  assert.ok(row.excess.drain.includes("泄") || row.excess.drain.length > 4, `${el} drain`);
  assert.ok(row.blacklist_patterns.length >= 3, `${el} blacklist`);
  assert.ok(row.whitelist_anchors.length >= 3, `${el} whitelist`);
}

assert.ok(textHitsBlacklist("去水边散步补气场", ["水"]));
assert.ok(textHitsBlacklist("窗边种一盆水仙", ["木"]));
assert.ok(textHitsBlacklist("选择靠近湖泊的住所", ["水"]));
assert.ok(textHitsBlacklist("养绿植", ["水"]), "shared blacklist");

assert.ok(textHitsWhitelist("保证睡眠与独处蓄力", ["水"]));
assert.equal(classifyMeansActionType("去水边散步", null, ["水"]), "literal_object");
assert.equal(classifyMeansActionType("固定止损检查点清理无效事项", null, ["金"]), "rhythm");
assert.equal(
  classifyMeansActionType("当前大运还剩三年，转折前先切换策略", null, []),
  "timing",
);
assert.equal(
  classifyMeansActionType("靠近能补给你的合作方式，远离消耗型关系", null, ["水"]),
  "polarity",
);
assert.equal(
  classifyMeansActionType("官杀重时宜借势体制内通道，不宜硬单干", null, []),
  "archetype",
);

const prompt = formatWuxingSemanticForPrompt(["水"]);
assert.ok(prompt.includes("水（智）"));
assert.ok(prompt.includes("方向短语"));
assert.ok(prompt.includes("timing") || prompt.includes("护城河"));
assert.ok(!prompt.includes("本周请你"), "no plot few-shot");

{
  const gated = gateP4DimensionMeans({
    meansRaw: [
      { text: "去水边散步补水", type: "field" },
      { text: "摆流水摆件", type: "symbol" },
      { text: "保证收敛型休息与睡眠降档", type: "rhythm" },
      { text: "冲突时先不硬顶找迂回", type: "mindset" },
    ],
    chart_anchors: ["用神·水"],
    strategy: "需要缓冲与恢复",
    notes: [],
  });
  assert.equal(gated.structural, false);
  assert.ok(gated.means.some((m) => m.includes("休息") || m.includes("降档")));
  assert.ok(!gated.means.some((m) => m.includes("水边") || m.includes("流水")));
}

{
  const gated = gateP4DimensionMeans({
    meansRaw: ["去江河湖海泡一泡", "用加湿器补水"],
    chart_anchors: ["用神·水"],
    strategy: "缺水",
    notes: [],
  });
  assert.equal(gated.structural, true);
  assert.equal(gated.structural_reason, "p4_literal_wuxing_means");
}

{
  const richSlice = [
    "current_da_yun_cycle(当前阶段 · 节奏松紧依据):",
    "- timing_ripeness: 本步大运后半，转折将近",
    "- retune_basis: 水木交织",
    "metaphysics_pack:",
    "- yong: 水; ji: 火",
    "【十神语义 SSOT】伤官：表达锐度",
  ].join("\n");
  const eligible = inferP4MoatEligibleTypes(richSlice);
  assert.ok(eligible.has("timing"), "timing eligible");
  assert.ok(eligible.has("polarity"), "polarity eligible");
  assert.ok(eligible.has("archetype"), "archetype eligible");

  const failMoat = gateP4PageMoatCoverage({
    dimensions: [
      {
        strategy: "通用精力管理",
        means: [
          { text: "每天固定独处恢复时段", type: "rhythm" },
          { text: "冲突时先不硬顶", type: "mindset" },
        ],
        chart_anchors: ["用神·水"],
      },
      {
        strategy: "再补一条节奏",
        means: [{ text: "周固定检查点清理无效事项", type: "rhythm" }],
        chart_anchors: ["身弱"],
      },
    ],
    eastern_calc_slice: richSlice,
  });
  assert.equal(failMoat.structural, true);
  assert.equal(failMoat.structural_reason, "p4_missing_moat_means");

  const passMoat = gateP4PageMoatCoverage({
    dimensions: [
      {
        strategy: "大运窗口将近转折",
        means: [
          {
            text: "当前大运还剩窗口，转折前先切换扩张策略为蓄力",
            type: "timing",
          },
          {
            text: "靠近补给型合作，远离消耗型催促局",
            type: "polarity",
          },
        ],
        chart_anchors: ["用神·水"],
      },
      {
        strategy: "伤官表达定位",
        means: [
          {
            text: "伤官重时宜靠个人表达开创，少硬借陌生体制通道",
            type: "archetype",
          },
          { text: "北侧工位仅作次要场域偏好", type: "field" },
          { text: "北侧再加一条场域偏好不因条数失败", type: "field" },
        ],
        chart_anchors: ["伤官"],
      },
    ],
    eastern_calc_slice: richSlice,
  });
  assert.equal(passMoat.structural, false, "moat pass");

  const thinSlice = "metaphysics_pack:\n- yong: 水; ji: 火\n(无大运专维)";
  const thinEligible = inferP4MoatEligibleTypes(thinSlice);
  assert.ok(thinEligible.has("polarity"));
  assert.equal(thinEligible.has("timing"), false);
  const thinPass = gateP4PageMoatCoverage({
    dimensions: [
      {
        strategy: "用忌取舍",
        means: [
          { text: "靠近能补给你的协作方式，远离忌神式消耗催促", type: "polarity" },
        ],
        chart_anchors: ["用神·水"],
      },
    ],
    eastern_calc_slice: thinSlice,
  });
  assert.equal(thinPass.structural, false, "eligible=1 polarity covered");
}

{
  const bad = sanitizePageJson("metaphysics_action", {
    page_title: "场域调频",
    page_subtitle: "测试",
    question_anchor: "要不要换跑道",
    desired_outcome: "稳住输出权",
    dimensions: [
      {
        name: "空间心理 · 专注场域与采光阻尼",
        strategy: "用神水需要缓冲，不是物件。",
        means: ["去水边散步", "摆流水摆件"],
        chart_anchors: ["用神·水"],
      },
      {
        name: "精力管理 · 认知恢复与损耗隔离",
        strategy: "同样缺缓冲。",
        means: ["去海边"],
        chart_anchors: ["用神·水"],
      },
    ],
  });
  assert.equal(bad.ok, false);
  if (!bad.ok) {
    assert.ok(
      bad.reason === "p4_literal_wuxing_means" || bad.reason === "eastern_dimensions_lt_2",
      bad.reason,
    );
  }
}

{
  const good = sanitizePageJson("metaphysics_action", {
    page_title: "场域调频",
    page_subtitle: "测试",
    question_anchor: "要不要换跑道",
    desired_outcome: "稳住输出权",
    dimensions: [
      {
        name: "精力管理 · 认知恢复与损耗隔离",
        strategy: "用神水：系统缺缓冲，要降档恢复。",
        means: [
          { text: "关键硬推日后固定睡眠与独处蓄力时段", type: "rhythm" },
          { text: "冲突先不硬顶，找一条迂回路径再回场", type: "mindset" },
          { text: "北侧工位仅作次要场域偏好", type: "field" },
        ],
        chart_anchors: ["用神·水", "身弱"],
      },
      {
        name: "生物节律 · 昼夜认知峰谷时窗",
        strategy: "把推进窗放在清醒峰，谷段只归档。",
        means: [
          { text: "晚间谷段只做归档不做硬推", type: "rhythm" },
          { text: "先说结论再铺细节，减少空转", type: "mindset" },
        ],
        chart_anchors: ["用神·水"],
      },
      {
        name: "战略周期 · 阶段节奏与时间窗口",
        strategy: "近阶宜蓄力结构，不宜加火线债务。",
        means: [
          { text: "本季每周固定一件交付闭环", type: "rhythm" },
          { text: "止损检查点清理无效战线", type: "mindset" },
        ],
        chart_anchors: ["用神·水"],
      },
    ],
  });
  assert.equal(good.ok, true, good.ok ? "" : good.reason);
}

{
  const richSlice = [
    "current_da_yun_cycle(当前阶段 · 节奏松紧依据):",
    "- timing_ripeness: 本步大运后半，转折将近",
    "- retune_basis: 水木交织",
    "metaphysics_pack:",
    "- yong: 水; ji: 火",
    "【十神语义 SSOT】伤官：表达锐度",
  ].join("\n");
  const rhythmOnly = sanitizePageJson(
    "metaphysics_action",
    {
      page_title: "场域调频标题够长",
      page_subtitle: "测试副题",
      question_anchor: "要不要换跑道继续谈条件",
      desired_outcome: "稳住输出权并减少空转",
      dimensions: [
        {
          name: "精力管理 · 认知恢复与损耗隔离",
          strategy: "只谈作息，没有命理护城河。",
          means: [
            { text: "关键硬推日后固定睡眠与独处蓄力时段", type: "rhythm" },
            { text: "冲突先不硬顶，找一条迂回路径再回场", type: "mindset" },
          ],
          chart_anchors: ["用神·水"],
        },
        {
          name: "生物节律 · 昼夜认知峰谷时窗",
          strategy: "再补节奏。",
          means: [{ text: "晚间谷段只做归档不做硬推", type: "rhythm" }],
          chart_anchors: ["身弱"],
        },
        {
          name: "战略周期 · 阶段节奏",
          strategy: "还是节奏。",
          means: [{ text: "本季每周固定一件交付闭环", type: "rhythm" }],
          chart_anchors: ["用神·水"],
        },
      ],
    },
    { eastern_calc_slice: richSlice },
  );
  assert.equal(rhythmOnly.ok, false);
  if (!rhythmOnly.ok) {
    assert.equal(rhythmOnly.reason, "p4_missing_moat_means");
  }
}

const p4 = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/page-prompts/p4-metaphysics-action.ts"),
  "utf8",
);
assert.ok(p4.includes("反物化"));
assert.ok(p4.includes("timing"));
assert.ok(p4.includes("polarity"));
assert.ok(p4.includes("archetype"));
assert.ok(!p4.includes("直接引用写进 means"));
assert.ok(!p4.includes("前两条必须是 rhythm"));

const mock = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/page-schema/mock-fixture.ts"),
  "utf8",
);
assert.ok(!mock.includes("greenery"));
assert.ok(!mock.includes("Keep water / greenery"));

const slice = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/format-spine-for-finalize.ts"),
  "utf8",
);
assert.ok(slice.includes("formatWuxingSemanticForPrompt"));
assert.ok(slice.includes("不得定义补水") || slice.includes("不得单独定义补泻"));
assert.ok(slice.includes("timing") || slice.includes("护城河"));

console.log("ok wuxing-semantic-ssot + p4 means gate");
