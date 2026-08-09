/**
 * Shared BreakthroughCore fixture for tests / scripts.
 */
import type { BreakthroughCore } from "@/lib/poju/agent-state";

export function makeTestBreakthroughCore(
  overrides: Partial<BreakthroughCore> & {
    situation_conclusion?: string;
  } = {},
): BreakthroughCore {
  const situation =
    overrides.situation_conclusion?.trim() ||
    "你在结构上卡在进退之间。";
  const needs = "他过去独立做事 vs 团队协作哪个成果更好";
  return {
    situation_conclusion: situation,
    response:
      overrides.response?.trim() ||
      `我看了你的情况：${situation}\n\n关键不在表面那一步，而在你怎么站位。我心里有几条路，但得先了解你几件事，才能把走法落到你身上。`,
    key_crossroads: {
      real_fork: "真正分岔是要不要先稳住根基",
      path_costs: "猛攻耗印星，守势慢但稳",
      decision_traits: "这类人直觉快但容易过冲",
      structural_basis: "印星护身",
      needs_validation: needs,
      ...overrides.key_crossroads,
    },
    modern_action_frames: overrides.modern_action_frames ?? [
      {
        direction: "靠专业深度建立壁垒",
        why_fits: "适合用输出换边界",
        structural_basis: "食伤为用",
        needs_validation: "他现有专业积累到什么程度",
        status: "hypothesis",
      },
      {
        direction: "先把火浇灭再谈扩张",
        why_fits: "避免硬碰",
        structural_basis: "忌神过旺",
        needs_validation: "最近哪一次冲突最伤精力",
        status: "hypothesis",
      },
    ],
    primary_path: overrides.primary_path ?? {
      direction: "靠专业深度建立壁垒",
      why_fits: "适合用输出换边界",
      structural_basis: "食伤为用",
      needs_validation: "他现有专业积累到什么程度",
      status: "hypothesis",
    },
    backup_path: overrides.backup_path ?? {
      direction: "先把火浇灭再谈扩张",
      why_fits: "同一目标下的退路:先止损再谈壁垒",
      structural_basis: "忌神过旺",
      needs_validation: "最近哪一次冲突最伤精力",
      status: "hypothesis",
    },
    energy_retune_frame: {
      direction_fit: "能量往稳根基使力",
      timing_ripeness: "情绪回稳后再推进",
      daily_retune: "固定恢复节律",
      complementary: "靠近能落地的人，避开空耗催促",
      structural_basis: "用神喜静",
      needs_validation: "他日常恢复方式是什么",
      status: "hypothesis",
      ...overrides.energy_retune_frame,
    },
    rhythm_frame: {
      phase1_observe: "观察卡点触发条件",
      phase2_adjust: "小步调整边界",
      phase3_consolidate: "巩固已验证方向",
      ...overrides.rhythm_frame,
    },
    self_check_signals: overrides.self_check_signals ?? [
      "能连续两周不靠硬扛也能完成关键动作",
      "一谈推进就失眠或回避",
      "外部反馈从催促变成协作",
    ],
    first_question: overrides.first_question,
    generated_at: overrides.generated_at ?? new Date().toISOString(),
    evolved_at: overrides.evolved_at,
  };
}
