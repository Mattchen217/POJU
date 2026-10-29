import type { POJUAgentState, BreakthroughCore } from "@/lib/poju/agent-state";
import { type DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { V1_DELIVERY_SEGMENT_KEYS } from "@/lib/llm/pro/delivery/segment-key-alias";
import {
  filterMultiDimIndicesForP4,
  filterMultiDimIndicesForRisk,
} from "./multi-dim-filter";
import { splitSelfCheckSignals } from "./self-check-split";
import type {
  DeliveryPagePlan,
  DeliveryPagePlanEntry,
  PageMustUseField,
} from "./types";

export type BuildDeliveryPagePlanInput = {
  core: BreakthroughCore;
  agent_v2: POJUAgentState;
};

function entry(
  key: DeliverySegmentKey,
  goal: string,
  must_use: PageMustUseField[],
  forbid: string[],
  multi_dim_indices?: number[],
): DeliveryPagePlanEntry {
  return {
    key,
    goal,
    must_use,
    forbid,
    ...(multi_dim_indices && multi_dim_indices.length > 0 ? { multi_dim_indices } : {}),
  };
}

/**
 * Deterministic six-page dispatch from breakthrough_core + agent context.
 * Does not invent new calc — only routes existing spine fields.
 */
export function buildDeliveryPagePlan(input: BuildDeliveryPagePlanInput): DeliveryPagePlan {
  const { core, agent_v2 } = input;
  const q = agent_v2.original_question?.trim() ?? "";
  const want =
    agent_v2.context_collected?.desired_outcome?.trim() ??
    agent_v2.desired_direction?.wants?.trim() ??
    "";

  const p4Indices = filterMultiDimIndicesForP4(core, q, want);
  const p5Indices = filterMultiDimIndicesForRisk(core);
  const { negative: selfNeg, positive: selfPos } = splitSelfCheckSignals(
    core.self_check_signals ?? [],
  );

  const pages = {
    decision_brief: entry(
      "decision_brief",
      "正面直答：该不该/怎么走 + 一句主路径 + 一句为什么",
      ["situation_conclusion", "key_crossroads", "primary_path", "action_plan", "question_expectation"],
      ["multi_dim_all", "metaphysics_pack_full", "东方/科学药方展开"],
    ),
    situation_analysis: entry(
      "foundation",
      "多表象对症论证（收集菜单→why_cards），收束到主辅成立",
      [
        "energy_structure",
        "multi_dim_all",
        "metaphysics_pack_dashboard",
        "situation_conclusion",
        "key_crossroads",
        "question_expectation",
      ],
      ["metaphysics_pack_full", "执行步骤", "复读P1结论头", "编造生活剧情"],
    ),
    execution_guidance: entry(
      "execution_guidance",
      "科学破局策略+手段，从主辅与多维/手段菜单生长",
      [
        "primary_path",
        "backup_path",
        "action_plan",
        "multi_dim_all",
        "modern_action_frames",
        "metaphysics_pack_polarity",
        "question_expectation",
      ],
      ["metaphysics_pack_full", "东方色向清单", "复读P1口号", "合同话术长剧本"],
    ),
    self_regulation: entry(
      "self_regulation",
      "锚定问题+期望的东方多维行动；pack 东方维唯此页全量",
      [
        "question_expectation",
        "multi_dim_filtered",
        "energy_retune_frame",
        "metaphysics_pack_full",
      ],
      ["主辅双轨", "复读P3科学手段", "物化补泻"],
      p4Indices,
    ),
    personal_decision_patterns: entry(
      "personal_decision_patterns",
      "本题相关决策模式与可纠正假设",
      ["energy_structure", "multi_dim_filtered", "question_expectation"],
      ["泛人格报告", "怎么办处方"],
    ),
    bottleneck_analysis: entry(
      "bottleneck_analysis",
      "优先 1–3 障碍与维持机制",
      ["energy_structure", "key_crossroads", "multi_dim_filtered", "self_check_negative"],
      ["复读处境", "执行处方"],
    ),
    strategic_options: entry(
      "strategic_options",
      "2–4 现实选项比较（收益/成本/风险/可逆）",
      ["primary_path", "backup_path", "modern_action_frames", "key_crossroads"],
      ["编造假路", "任务表"],
    ),
    recommended_strategy: entry(
      "recommended_strategy",
      "主策略+备选+前提+退出",
      ["primary_path", "backup_path", "action_plan", "situation_conclusion"],
      ["第二份执行清单", "拧轴"],
    ),
    validation_risk: entry(
      "validation_risk",
      "盯住 P3/P4 手段的结构红灯与熔断",
      [
        "multi_dim_risk",
        "metaphysics_pack_polarity",
        "self_check_negative",
        "primary_path",
        "backup_path",
        "question_expectation",
        "action_brief",
      ],
      ["metaphysics_pack_full", "新开药方", "无关KPI"],
      p5Indices,
    ),
    validation_close: entry(
      "validation_close",
      "近阶节奏与微行动，不复读第三套药方",
      [
        "self_check_positive",
        "rhythm_frame",
        "action_plan",
        "primary_path",
        "backup_path",
        "action_brief",
      ],
      ["第三套药方", "四周表", "逐字复读P3"],
    ),
    thirty_day: entry("thirty_day", "(legacy)", [], []),
    // legacy aliases → same entries as remapped v1 keys
    direct_answer: null as unknown as DeliveryPagePlanEntry,
    foundation: null as unknown as DeliveryPagePlanEntry,
    science_action: null as unknown as DeliveryPagePlanEntry,
    metaphysics_action: null as unknown as DeliveryPagePlanEntry,
    risk_guard: null as unknown as DeliveryPagePlanEntry,
    signals_close: null as unknown as DeliveryPagePlanEntry,
  };

  pages.direct_answer = pages.decision_brief;
  pages.foundation = pages.situation_analysis;
  pages.science_action = pages.execution_guidance;
  pages.metaphysics_action = pages.self_regulation;
  pages.risk_guard = pages.validation_risk;
  pages.signals_close = pages.validation_close;

  // Attach self_check split hints for downstream formatters (unused in entry type but logged in tests)
  void selfNeg;
  void selfPos;

  // Page-plan still keys legacy papers; face books use face-prompt + sliceForPage.
  for (const k of V1_DELIVERY_SEGMENT_KEYS) {
    if (!(pages as Record<string, unknown>)[k]) {
      throw new Error(`missing page plan: ${k}`);
    }
  }

  return {
    version: "delivery_page_plan_v1",
    pages: pages as Partial<Record<DeliverySegmentKey, DeliveryPagePlanEntry>> as Record<
      DeliverySegmentKey,
      DeliveryPagePlanEntry
    >,
  };
}

export function getPagePlanEntry(
  plan: DeliveryPagePlan,
  key: DeliverySegmentKey,
): DeliveryPagePlanEntry {
  return plan.pages[key];
}
