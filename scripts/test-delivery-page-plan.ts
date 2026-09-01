/**
 * Delivery page plan + thin-feed + A0 slice smoke tests.
 * Run: pnpm exec tsx scripts/test-delivery-page-plan.ts
 */

import assert from "node:assert/strict";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import { makeTestBreakthroughCore } from "@/lib/poju/test-breakthrough-core-fixture";
import { buildMetaphysicsPack, type ProfileStructured } from "@/lib/calculations";
import {
  buildDeliveryPagePlan,
  formatPagePlanSliceForPrompt,
  splitSelfCheckSignals,
} from "@/lib/llm/pro/delivery/page-plan";
import {
  buildDashboardScoreHintsForFill,
  buildEasternCalcSliceForFill,
  buildRiskCalcSliceForFill,
  formatSpineSliceForSegment,
} from "@/lib/llm/pro/delivery/format-spine-for-finalize";
import { buildDeliveryFinalizePrompt } from "@/lib/llm/pro/delivery/finalize-prompt";
import { buildPageSchemaFillPrompt } from "@/lib/llm/pro/delivery/page-schema/fill-prompt";
import {
  fallbackCalcRelevancePlan,
  parseCalcRelevancePlan,
} from "@/lib/llm/deepseek/calc-relevance-plan";
import {
  buildCompactInventoryIndex,
  buildSliceFromRelevancePlan,
  validatePlanAnchorsInIndex,
} from "@/lib/calculations/build-calc-slice-from-plan";

const structured: ProfileStructured = {
  day_master: "甲木",
  pattern: "test",
  yong_shen: "水",
  xi_shen: ["金"],
  ji_shen: ["火"],
  strength: "身弱",
  four_pillars: { year: "甲子", month: "丙寅", day: "戊午", hour: "癸亥" },
  pillars_detail: {
    year: {
      ganzhi: "甲子",
      stem: "甲",
      branch: "子",
      ten_god: "比肩",
      hidden_stems: ["癸"],
      shen_sha: [],
    },
    month: {
      ganzhi: "丙寅",
      stem: "丙",
      branch: "寅",
      ten_god: "食神",
      hidden_stems: ["甲", "丙", "戊"],
      shen_sha: ["驿马"],
    },
    day: {
      ganzhi: "戊午",
      stem: "戊",
      branch: "午",
      ten_god: "日主",
      hidden_stems: ["丁", "己"],
      shen_sha: [],
    },
    hour: {
      ganzhi: "癸亥",
      stem: "癸",
      branch: "亥",
      ten_god: "正财",
      hidden_stems: ["壬", "甲"],
      shen_sha: [],
    },
  },
  da_yun: [{ ganzhi: "丁卯", start_age: 32, end_age: 41 }],
};

const pack = buildMetaphysicsPack({ structured, element_scores_raw: null });
const core = makeTestBreakthroughCore({
  self_check_signals: [
    "能连续两周不靠硬扛也能完成关键动作",
    "一谈推进就失眠或回避",
    "外部反馈从催促变成协作",
  ],
});
core.metaphysics_pack = pack;
if (core.metaphysics_pack) {
  core.metaphysics_pack = {
    ...core.metaphysics_pack,
    dashboard: { output_capacity: 72, sustain_capacity: 55, resistance_load: 38 },
    element_scores_source: "computed",
  };
}

const careerAgent = createInitialAgentState({
  original_question: "我该不该换工作去创业？",
});
careerAgent.context_collected = {
  ...careerAgent.context_collected,
  desired_outcome: "想确认是否该all-in",
};
careerAgent.question_category = "career";

const relAgent = createInitialAgentState({
  original_question: "这段关系还要不要继续？",
});
relAgent.context_collected = {
  ...relAgent.context_collected,
  desired_outcome: "想知道止损还是修复",
};
relAgent.question_category = "relationship";

// --- plan build: six pages, mutual exclusion ---
{
  const plan = buildDeliveryPagePlan({ core, agent_v2: careerAgent });
  assert.equal(plan.version, "delivery_page_plan_v1");
  assert.ok(plan.pages.direct_answer.must_use.includes("action_plan"));
  assert.ok(plan.pages.foundation.must_use.includes("multi_dim_all"));
  assert.ok(plan.pages.foundation.must_use.includes("metaphysics_pack_dashboard"));
  assert.ok(!plan.pages.foundation.must_use.includes("metaphysics_pack_full"));
  assert.ok(plan.pages.science_action.must_use.includes("metaphysics_pack_polarity"));
  assert.ok(!plan.pages.science_action.must_use.includes("metaphysics_pack_full"));
  assert.ok(plan.pages.metaphysics_action.must_use.includes("metaphysics_pack_full"));
  assert.ok(plan.pages.risk_guard.must_use.includes("self_check_negative"));
  assert.ok(plan.pages.signals_close.must_use.includes("self_check_positive"));
  console.log("ok plan must_use / forbid mutual exclusion");
}

// --- self_check split ---
{
  const { negative, positive } = splitSelfCheckSignals(core.self_check_signals ?? []);
  assert.ok(negative.some((s) => s.includes("失眠")));
  assert.ok(positive.some((s) => s.includes("连续两周")));
  const p5 = formatPagePlanSliceForPrompt("risk_guard", buildDeliveryPagePlan({ core, agent_v2: careerAgent }), core);
  const p6 = formatPagePlanSliceForPrompt("signals_close", buildDeliveryPagePlan({ core, agent_v2: careerAgent }), core);
  assert.ok(p5.includes("self_check(负向)"));
  assert.ok(!p5.includes("连续两周"));
  assert.ok(p6.includes("self_check(正向)"));
  assert.ok(!p6.includes("失眠"));
  console.log("ok self_check positive/negative split");
}

// --- thin finalize spine: plan slice vs legacy full dump ---
{
  const plan = buildDeliveryPagePlan({ core, agent_v2: careerAgent });
  const p1Plan = formatSpineSliceForSegment(core, "direct_answer", { pagePlan: plan });
  const p1Legacy = formatSpineSliceForSegment(core, "direct_answer");
  assert.ok(p1Plan.includes("action_plan"));
  assert.ok(!p1Plan.includes("multi_dimension_reckoning"));
  assert.ok(!p1Legacy.includes("multi_dimension_reckoning"));
  const p4Plan = formatSpineSliceForSegment(core, "metaphysics_action", { pagePlan: plan });
  assert.ok(p4Plan.includes("metaphysics_pack"));
  assert.ok(p4Plan.includes("preferred_dirs") || p4Plan.includes("favorable_hours"));
  const p2Plan = formatSpineSliceForSegment(core, "foundation", { pagePlan: plan });
  assert.ok(p2Plan.includes("multi_dimension_reckoning"));
  assert.ok(!p2Plan.includes("preferred_dirs"));
  console.log("ok finalize thin spine per page plan");
}

// --- no double-feed: eastern/risk slices use plan ---
{
  const plan = buildDeliveryPagePlan({ core, agent_v2: careerAgent });
  const qe = "问题: 换工作\n期望: all-in";
  const eastern = buildEasternCalcSliceForFill(core, plan, qe);
  const risk = buildRiskCalcSliceForFill(core, plan, qe);
  assert.ok(eastern.includes("本页派工"));
  assert.ok(eastern.includes("metaphysics_pack"));
  assert.ok(!eastern.includes("backup_path(辅)"));
  assert.ok(risk.includes("self_check(负向)"));
  assert.ok(!risk.includes("preferred_dirs"));
  assert.ok(!risk.includes("favorable_hours"));
  console.log("ok eastern/risk plan slices no double-feed");
}

// --- P2 dashboard hints ---
{
  const hints = buildDashboardScoreHintsForFill(core);
  assert.ok(hints.includes("output_capacity="));
  const { user } = buildPageSchemaFillPrompt("foundation", {
    locale: "zh",
    core_conclusion: "test",
    dashboard_score_hints: hints,
    page_plan_slice: formatPagePlanSliceForPrompt(
      "foundation",
      buildDeliveryPagePlan({ core, agent_v2: careerAgent }),
      core,
    ),
  });
  assert.ok(user.includes("dashboard 真分"));
  assert.ok(user.includes("本页派工料"));
  console.log("ok P2 dashboard + page_plan_slice in fill");
}

// --- finalize prompt includes plan summary ---
{
  const plan = buildDeliveryPagePlan({ core, agent_v2: careerAgent });
  const { system, user } = buildDeliveryFinalizePrompt({
    breakthrough_core: core,
    covered_agenda: [],
    agent_v2: careerAgent,
    locale: "zh",
    delivery_mode: "full",
    paths: ["direct_answer"],
    page_plan: plan,
  });
  assert.ok(system.includes("六页派工表"));
  assert.ok(user.includes("action_plan"));
  console.log("ok finalize prompt plan summary");
}

// --- A0 parse + slice ---
{
  const raw = JSON.stringify({
    problem_focus: "职业转折",
    desired_outcome_lens: "确认是否创业",
    calc_families: ["topic_typed", "dayun_pace", "pack_yong_ji"],
    reckoning_dimensions: [
      { dimension: "身强弱", required_anchors: ["食神", "比肩"] },
    ],
  });
  const plan = parseCalcRelevancePlan(raw);
  assert.equal(plan.problem_focus, "职业转折");
  assert.ok(plan.calc_families.includes("dayun_pace"));
  const index = buildCompactInventoryIndex(structured, { questionCategory: "career" });
  const missing = validatePlanAnchorsInIndex(plan, index);
  assert.ok(Array.isArray(missing));
  const slice = buildSliceFromRelevancePlan({
    structured,
    plan,
    questionCategory: "career",
    pack,
  });
  assert.ok(slice.includes("优先真算"));
  assert.ok(slice.includes("闭集兜底"));
  console.log("ok A0 parse + calc slice");
}

// --- A0 fallback differs by category ---
{
  const career = fallbackCalcRelevancePlan("career", "换工作");
  const rel = fallbackCalcRelevancePlan("relationship", "要不要分手");
  assert.notDeepEqual(career.calc_families.sort(), rel.calc_families.sort());
  console.log("ok A0 fallback category variance");
}

console.log("\nAll delivery page plan tests passed.");
