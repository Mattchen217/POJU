import type { POJUAgentState, BreakthroughCore } from "@/lib/poju/agent-state";
import { DELIVERY_SEGMENT_KEYS, type DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
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
    direct_answer: entry(
      "direct_answer",
      "正面直答：该不该/怎么走 + 一句主路径 + 一句为什么",
      ["situation_conclusion", "key_crossroads", "primary_path", "action_plan", "question_expectation"],
      ["multi_dim_all", "metaphysics_pack_full", "东方/科学药方展开"],
    ),
    foundation: entry(
      "foundation",
      "多表象对症论证，收束到主辅成立；仪表盘三真分",
      ["energy_structure", "multi_dim_all", "metaphysics_pack_dashboard"],
      ["metaphysics_pack_full", "执行步骤", "复读P1结论头"],
    ),
    science_action: entry(
      "science_action",
      "科学破局策略+手段，从主辅与多维生长",
      [
        "primary_path",
        "backup_path",
        "action_plan",
        "multi_dim_all",
        "modern_action_frames",
        "metaphysics_pack_polarity",
      ],
      ["metaphysics_pack_full", "东方色向清单", "复读P1口号"],
    ),
    metaphysics_action: entry(
      "metaphysics_action",
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
    risk_guard: entry(
      "risk_guard",
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
    signals_close: entry(
      "signals_close",
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
  } satisfies Record<DeliverySegmentKey, DeliveryPagePlanEntry>;

  // Attach self_check split hints for downstream formatters (unused in entry type but logged in tests)
  void selfNeg;
  void selfPos;

  for (const k of DELIVERY_SEGMENT_KEYS) {
    if (!pages[k]) {
      throw new Error(`missing page plan: ${k}`);
    }
  }

  return { version: "delivery_page_plan_v1", pages };
}

export function getPagePlanEntry(
  plan: DeliveryPagePlan,
  key: DeliverySegmentKey,
): DeliveryPagePlanEntry {
  return plan.pages[key];
}
