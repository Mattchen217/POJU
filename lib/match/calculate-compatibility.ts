// lib/match/calculate-compatibility.ts

import { calculateDayMasterInteraction } from './calculations/day-master-interaction';
import { calculateYongShenMatch } from './calculations/yong-shen-match';
import { calculateBranchInteractions } from './calculations/branch-interactions';
import { calculateSpouseStar } from './calculations/spouse-star';
import { calculateShenShaResonance } from './calculations/shensha-resonance';
import { calculateLuckCycleSync } from './calculations/luck-cycle-sync';
import type { DayMasterInteractionResult } from './calculations/day-master-interaction';
import type { YongShenMatchResult } from './calculations/yong-shen-match';
import type { BranchInteractionsResult } from './calculations/branch-interactions';
import type { SpouseStarResult } from './calculations/spouse-star';
import type { ShenShaResonanceResult } from './calculations/shensha-resonance';
import type { LuckCycleSyncResult } from './calculations/luck-cycle-sync';
import { parseProfileForMatrix } from './parse-profile-for-matrix';

export type SynergyType =
  | 'full_resonance'
  | 'complementary_flow'
  | 'adaptive_balance'
  | 'dynamic_tension'
  | 'structural_undertow';

export interface ResonanceMatrix {
  day_master_interaction: DayMasterInteractionResult;
  yong_shen_match: YongShenMatchResult;
  branch_interactions: BranchInteractionsResult;
  spouse_star: SpouseStarResult;
  shensha_resonance: ShenShaResonanceResult;
  luck_cycle_sync: LuckCycleSyncResult;

  resonance_index: number;
  synergy_type: SynergyType;

  key_insights: {
    strengths: string[];
    challenges: string[];
  };

  _meta: {
    a_summary: string;
    b_summary: string;
    weights: Record<string, number>;
  };
}

const WEIGHTS = {
  day_master: 0.20,
  yong_shen: 0.20,
  branch: 0.20,
  spouse_star: 0.15,
  shensha: 0.10,
  luck_cycle: 0.15
};

export function calculateCompatibilityMatrix(input: {
  profileA: unknown;
  profileB: unknown;
}): ResonanceMatrix {

  const a = parseProfileForMatrix(input.profileA);
  const b = parseProfileForMatrix(input.profileB);

  const dmInteraction = calculateDayMasterInteraction(a.dayMaster, b.dayMaster);

  const ysMatch = calculateYongShenMatch({
    a_yong_shen_primary: a.yongShen,
    a_yong_shen_secondary: a.yongShenSecondary,
    b_yong_shen_primary: b.yongShen,
    b_yong_shen_secondary: b.yongShenSecondary,
    a_wuxing_distribution: a.wuxingDistribution,
    b_wuxing_distribution: b.wuxingDistribution
  });

  const branchInter = calculateBranchInteractions(a.branches, b.branches);

  const spouseStar = calculateSpouseStar({
    a_day_master: a.dayMaster,
    a_gender: a.gender,
    a_all_stems: a.stems,
    b_day_master: b.dayMaster,
    b_gender: b.gender,
    b_all_stems: b.stems
  });

  const shenshaRes = calculateShenShaResonance({
    a_day_master: a.dayMaster,
    a_year_branch: a.branches.year,
    a_day_branch: a.branches.day,
    a_branches: a.branches,
    b_day_master: b.dayMaster,
    b_year_branch: b.branches.year,
    b_day_branch: b.branches.day,
    b_branches: b.branches
  });

  const luckSync = calculateLuckCycleSync({
    a_current_dayun_stem: a.currentDayunStem,
    a_current_dayun_branch: a.currentDayunBranch,
    a_dayun_rising: a.dayunRising,
    b_current_dayun_stem: b.currentDayunStem,
    b_current_dayun_branch: b.currentDayunBranch,
    b_dayun_rising: b.dayunRising
  });

  const weightedTotal =
    dmInteraction.score * WEIGHTS.day_master * 5 +
    ysMatch.score * WEIGHTS.yong_shen * 5 +
    branchInter.score * WEIGHTS.branch * 5 +
    spouseStar.score * WEIGHTS.spouse_star * 5 +
    shenshaRes.score * WEIGHTS.shensha * 5 +
    luckSync.score * WEIGHTS.luck_cycle * 5;

  const finalScore = Math.max(-100, Math.min(100, weightedTotal));
  const level = resonanceIndexToSynergyType(finalScore);

  const strengths: string[] = [];
  const challenges: string[] = [];

  if (dmInteraction.score >= 10) strengths.push('day_master_strong_bond');
  if (dmInteraction.score <= -10) challenges.push('day_master_clash');

  if (ysMatch.score >= 10) strengths.push('mutual_yong_shen_support');
  if (ysMatch.score <= -8) challenges.push('mutual_yong_shen_lacking');

  if (branchInter.day_branch_he) strengths.push('marriage_palace_bond');
  if (branchInter.day_branch_chong) challenges.push('marriage_palace_clash');
  if (branchInter.liu_chong_count >= 2) challenges.push('multiple_branch_clashes');

  if (spouseStar.a_is_b_spouse_star && spouseStar.b_is_a_spouse_star) {
    strengths.push('mutual_spouse_archetype');
  }

  if (shenshaRes.cross_gui_ren_aid) strengths.push('noble_assistance');
  if (shenshaRes.both_tao_hua) strengths.push('mutual_peach_blossom');
  if (shenshaRes.gu_chen_gua_su_present) challenges.push('gu_chen_gua_su');

  if (luckSync.branches_he) strengths.push('luck_cycles_aligned');
  if (luckSync.branches_chong) challenges.push('luck_cycles_misaligned');

  return {
    day_master_interaction: dmInteraction,
    yong_shen_match: ysMatch,
    branch_interactions: branchInter,
    spouse_star: spouseStar,
    shensha_resonance: shenshaRes,
    luck_cycle_sync: luckSync,
    resonance_index: Math.round(finalScore * 10) / 10,
    synergy_type: level,
    key_insights: {
      strengths,
      challenges
    },
    _meta: {
      a_summary: `${a.dayMaster}${a.branches.day} (用神${a.yongShen})`,
      b_summary: `${b.dayMaster}${b.branches.day} (用神${b.yongShen})`,
      weights: WEIGHTS
    }
  };
}

export function resonanceIndexToSynergyType(resonanceIndex: number): SynergyType {
  if (resonanceIndex >= 40) return 'full_resonance';
  if (resonanceIndex >= 15) return 'complementary_flow';
  if (resonanceIndex >= -15) return 'adaptive_balance';
  if (resonanceIndex >= -40) return 'dynamic_tension';
  return 'structural_undertow';
}

/** @deprecated Use resonanceIndexToSynergyType */
export const scoreToCompatibilityLevel = resonanceIndexToSynergyType;

