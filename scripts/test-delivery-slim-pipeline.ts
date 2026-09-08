/**
 * Slim Pipeline contracts: no narrative degrade, 护身 map, mark seal skip, P3 excerpt helper.
 * Run: pnpm exec tsx scripts/test-delivery-slim-pipeline.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PLAIN_FALLBACK_BODY_SINGLES,
  PLAIN_FALLBACK_COMPOUNDS,
} from "../lib/base-analysis-v2/compute/plain-fallback-map";
import { repairMarkConnectivePlainJargon } from "../lib/llm/pro/delivery/mark-evidence-prompt";
import { pickMarkEvidenceInput } from "../lib/llm/pro/delivery/mark-evidence-prompt";
import { formatDeepEvidencePlanForCompress } from "../lib/llm/pro/delivery/page-schema/deep-evidence-call";
import { repairCompressPageJargon } from "../lib/llm/pro/delivery/page-schema/compress-jargon-repair";
import { buildFoundationSurfaceFeedBlock } from "../lib/llm/pro/delivery/foundation-surface-feed";
import { buildScienceMeansFeedBlock } from "../lib/llm/pro/delivery/science-means-feed";
import { buildMetaphysicsMoatFeedBlock } from "../lib/llm/pro/delivery/metaphysics-moat-feed";
import { buildRiskFuseFeedBlock } from "../lib/llm/pro/delivery/risk-fuse-feed";
import { buildCloseRitualFeedBlock } from "../lib/llm/pro/delivery/close-ritual-feed";
import { inferP4MoatEligibleTypes } from "../lib/llm/pro/delivery/page-schema/p4-means-gate";
import { SEGMENT_HEAVY_FILL_KEYS } from "../lib/llm/pro/delivery/run-segment-chain";
import { makeTestBreakthroughCore } from "../lib/poju/test-breakthrough-core-fixture";
import type { P5ActionBrief } from "../lib/llm/pro/delivery/page-schema/types";

assert.equal(PLAIN_FALLBACK_BODY_SINGLES["护身"], "【护持感】");
assert.equal(PLAIN_FALLBACK_COMPOUNDS["护身符"], "【护持感】");
assert.equal(PLAIN_FALLBACK_COMPOUNDS["印绶护身"], "【有靠山的护持感】");

{
  const { text, repaired_terms } = repairMarkConnectivePlainJargon(
    "人脉和硬功夫是你的护身符，不是赌注",
  );
  assert.ok(repaired_terms.includes("护身符") || text.includes("护持"));
  assert.ok(!text.includes("护身符"));
}

{
  const input = pickMarkEvidenceInput(
    {
      signals_close: [
        { body: "identity", evidence: "⟦w:正印⟧ 机制" },
        { body: "quote seal", evidence: "" },
        { body: "tonight", evidence: "⟦w:忌神⟧ 机制" },
        { body: "takeaways seal", evidence: "" },
      ],
    },
    ["signals_close"],
  );
  assert.equal(input.signals_close?.arguments.length, 2);
}

{
  const notes: string[] = [];
  const page = {
    page: "risk_guard",
    page_title: "守住基本盘",
    page_subtitle: "执行刹车",
    red_lights: [],
    traps: [],
    switch_to_backup: {},
    protection_rules: [],
  } as Record<string, unknown>;
  // narrative-like string field via page_title path — 护身 should auto-repair
  page.page_title = "别把护身当赌注";
  const r = repairCompressPageJargon("risk_guard", page, notes, null);
  assert.equal(r.ok, true, `jargon should repair 护身: ${notes.join(",")}`);
  assert.ok(String(page.page_title).includes("护持") || !String(page.page_title).includes("护身"));
}

{
  const dump = formatDeepEvidencePlanForCompress({
    page: "metaphysics_action",
    units: [
      {
        path: "dimensions[0]",
        chart_anchors: ["用神"],
        evidence: "⟦w:用神⟧ x",
        moat_class: "polarity",
      },
      {
        path: "dimensions[1]",
        chart_anchors: ["正印"],
        evidence: "⟦w:正印⟧ y",
        moat_class: "archetype",
      },
    ],
  });
  assert.ok(dump.includes("moat_class=archetype"));
}

const chainSrc = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/run-segment-chain.ts"),
  "utf8",
);
assert.ok(!chainSrc.includes("runNarrativeTask("));
assert.ok(chainSrc.includes("refuse_narrative_fallback"));
assert.ok(chainSrc.includes("missing_page_schema_refuse_ready"));
assert.ok(chainSrc.includes('"foundation", // 4–5 why_cards'));
assert.ok(chainSrc.includes('"science_action", // 3+3 angles'));
assert.ok(chainSrc.includes("foundation_surface_feed"));
assert.ok(chainSrc.includes("science_means_feed"));
assert.ok(chainSrc.includes("metaphysics_moat_feed"));
assert.ok(chainSrc.includes("risk_fuse_feed"));
assert.ok(chainSrc.includes("close_ritual_feed"));
assert.ok(SEGMENT_HEAVY_FILL_KEYS.has("foundation"));
assert.ok(SEGMENT_HEAVY_FILL_KEYS.has("science_action"));
assert.ok(SEGMENT_HEAVY_FILL_KEYS.has("metaphysics_action"));
assert.ok(SEGMENT_HEAVY_FILL_KEYS.has("risk_guard"));
assert.ok(SEGMENT_HEAVY_FILL_KEYS.has("signals_close"));

const deepSrc = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/page-schema/deep-evidence-call.ts"),
  "utf8",
);
assert.ok(deepSrc.includes('"foundation", // 4–5 why_cards'));
assert.ok(deepSrc.includes("P3：按锁定 path"));
assert.ok(deepSrc.includes('"signals_close"'));

{
  const feed = buildFoundationSurfaceFeedBlock(
    [
      { label: "睡眠", answer: "连续两周不足四小时，血压也在晃" },
      { label: "赞助", answer: "催结果但不给边界" },
    ],
    {
      original_question: "该不该继续硬扛海外一线？",
      real_fork: "守结果权 vs 卸火线",
      situation_conclusion: "结果权焊在火线上",
    },
  );
  assert.ok(feed.includes("P2 表象候选菜单"));
  assert.ok(feed.includes("睡眠"));
  assert.ok(feed.includes("候选"));
  assert.ok(feed.includes("分叉面") || feed.includes("局势面"));
}

{
  const core = makeTestBreakthroughCore({
    action_plan: { primary: "在岗重谈边界", backup: "安静止损" },
  });
  const means = buildScienceMeansFeedBlock(
    core,
    [{ label: "年限", answer: "大厂十年，不做手作" }],
    {
      original_question: "该不该继续硬扛？",
      desired_outcome: "六个月守结果权且睡眠回升",
      primary_backup_hint: "主:在位重谈 / 辅:安静退出",
    },
  );
  assert.ok(means.includes("P3 科学手段候选菜单"));
  assert.ok(means.includes("action_plan") || means.includes("在岗"));
  assert.ok(means.includes("大厂十年") || means.includes("收集事实"));
}

{
  const core = makeTestBreakthroughCore();
  const { block, eligible } = buildMetaphysicsMoatFeedBlock(
    core,
    [{ label: "身体", answer: "睡眠碎、血压晃" }],
    {
      original_question: "如何守结果权又不硬扛一线？",
      desired_outcome: "远程指挥可持续",
    },
  );
  assert.ok(block.includes("P4 护城河手段候选菜单"));
  assert.ok(eligible.length >= 1, `eligible=${eligible.join(",")}`);
  assert.ok(block.includes("eligible_moat_classes"));
  const inferred = inferP4MoatEligibleTypes(block);
  assert.ok(inferred.size >= 1, "feed markers should make eligibility visible");
}

{
  const planish =
    "energy_retune_frame:\n- timing: 近阶宜守不宜冲\n【大运/阶段节奏 SSOT · 内部】\n- 藏: 守（极性提示:藏/守）\nyong: water\nji: fire";
  const el = inferP4MoatEligibleTypes(planish);
  assert.ok(el.has("timing"), "plan-path timing: + dayun SSOT");
  assert.ok(el.has("polarity"), "yong: polarity");
}

{
  const core = makeTestBreakthroughCore({
    key_crossroads: {
      real_fork: "守结果权 vs 卸火线",
      path_costs: "硬扛一线会把睡眠与血压一并烧掉",
      decision_traits: "一被催就加塞英雄戏",
      structural_basis: "身弱用神水 · 官杀显",
      needs_validation: "睡眠是否已破底线；结果权是否仍在手",
    },
  });
  const brief: P5ActionBrief = {
    primary_name: "守结果权",
    backup_name: "安静止损",
    primary_when: "身体未红灯",
    backup_when: "睡眠碎/血压晃",
    p3_primary_steps: ["今晚写出边界邮件草稿", "把催促改成书面优先级"],
    p3_backup_steps: ["暂停一线承诺"],
    p3_hard_metrics: [],
    p4_leverage: [],
    p4_avoid: ["硬冲忌神火线"],
    p4_field_matrix: [],
    p4_primary_means: ["大运窗宜守不宜冲"],
    p4_backup_means: [],
    source_anchors: ["正印", "七杀"],
  };
  const fuse = buildRiskFuseFeedBlock(
    core,
    brief,
    [{ label: "身体", answer: "睡眠碎、血压晃" }],
    {
      original_question: "该不该继续硬扛？",
      desired_outcome: "守结果权且睡眠回升",
      primary_backup_hint: "Primary: 守结果权",
    },
  );
  assert.ok(fuse.includes("P5 熔断候选菜单"));
  assert.ok(fuse.includes("执行面"));
  assert.ok(fuse.includes("边界邮件") || fuse.includes("P3主"));
  assert.ok(fuse.includes("建议槽位映射"));
}

{
  const core = makeTestBreakthroughCore({
    action_plan: { primary: "在岗重谈边界", backup: "安静止损" },
  });
  const brief: P5ActionBrief = {
    primary_name: "守结果权",
    backup_name: "安静止损",
    primary_when: "身体未红灯",
    backup_when: "睡眠碎/血压晃",
    p3_primary_steps: ["今晚写出边界邮件草稿", "把催促改成书面优先级"],
    p3_backup_steps: ["暂停一线承诺"],
    p3_hard_metrics: ["本周睡眠≥6h×3"],
    p4_leverage: [],
    p4_avoid: ["硬冲忌神火线"],
    p4_field_matrix: [],
    p4_primary_means: ["大运窗宜守不宜冲"],
    p4_backup_means: [],
    source_anchors: ["正印", "七杀"],
  };
  const close = buildCloseRitualFeedBlock(
    core,
    brief,
    [{ label: "身体", answer: "睡眠碎、血压晃" }],
    {
      original_question: "该不该继续硬扛？",
      desired_outcome: "守结果权且睡眠回升",
      primary_backup_hint: "Primary: 守结果权",
    },
  );
  assert.ok(close.includes("P6 出门候选菜单"));
  assert.ok(close.includes("今晚候选"));
  assert.ok(close.includes("近7日") || close.includes("近阶"));
  assert.ok(close.includes("建议槽位映射"));
}

const fillSrc = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/page-schema/fill-call.ts"),
  "utf8",
);
assert.ok(fillSrc.includes("p1_core_logic_too_thin") || fillSrc.includes("【纠错·P1 质量】"));
assert.ok(fillSrc.includes("p1_"));
assert.ok(fillSrc.includes("【纠错·P2 质量·兜底】"));
assert.ok(fillSrc.includes("【纠错·P3 质量·兜底】"));
assert.ok(fillSrc.includes("【纠错·P4 质量·兜底】") || fillSrc.includes("P4 护城河手段候选菜单"));
assert.ok(fillSrc.includes("【纠错·P5 质量·兜底】") || fillSrc.includes("P5 熔断候选菜单"));
assert.ok(fillSrc.includes("【纠错·P6 质量·兜底】") || fillSrc.includes("P6 出门候选菜单"));

const p1Prompt = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/page-prompts/p1-direct-answer.ts"),
  "utf8",
);
assert.ok(p1Prompt.includes("禁止降级出货"));
assert.ok(p1Prompt.includes("core_logic 必须写厚"));

const p2Prompt = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/page-prompts/p2-foundation.ts"),
  "utf8",
);
assert.ok(p2Prompt.includes("表象候选菜单"));
assert.ok(p2Prompt.includes("禁止编造生活剧情"));

const p3Prompt = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/page-prompts/p3-science-action.ts"),
  "utf8",
);
assert.ok(p3Prompt.includes("科学手段候选菜单"));
assert.ok(p3Prompt.includes("今晚可完成的可出示交付物"));

const p4Prompt = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/page-prompts/p4-metaphysics-action.ts"),
  "utf8",
);
assert.ok(p4Prompt.includes("护城河手段候选菜单"));
assert.ok(p4Prompt.includes("means 源(硬)"));

const p5Prompt = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/page-prompts/p5-risk-guard.ts"),
  "utf8",
);
assert.ok(p5Prompt.includes("熔断候选菜单"));
assert.ok(p5Prompt.includes("执行面"));

const p6Prompt = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/page-prompts/p6-signals-close.ts"),
  "utf8",
);
assert.ok(p6Prompt.includes("出门候选菜单"));
assert.ok(p6Prompt.includes("生长源"));

const sanitizeSrc = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/page-schema/sanitize.ts"),
  "utf8",
);
assert.ok(sanitizeSrc.includes("p1_core_logic_too_thin"));
assert.ok(sanitizeSrc.includes("require_thick_core_logic"));
assert.ok(sanitizeSrc.includes("p1_track_placeholder"));
assert.ok(sanitizeSrc.includes("p1_missing_chart_anchors"));

const finSrc = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/finalize-prompt.ts"),
  "utf8",
);
assert.ok(!finSrc.includes("POJU_IDENTITY"));
assert.ok(finSrc.includes("交付定稿 · 薄身份"));

console.log("test-delivery-slim-pipeline: ok");
