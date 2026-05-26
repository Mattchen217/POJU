// lib/match/calculations/luck-cycle-sync.ts

import { STEMS, type HeavenlyStem, type EarthlyBranch, type WuXing } from '../data/stems-branches';
import { isLiuHe, isLiuChong } from '../data/branch-relations';

export interface LuckCycleSyncResult {
  a_current_dayun_stem?: HeavenlyStem;
  a_current_dayun_branch?: EarthlyBranch;
  b_current_dayun_stem?: HeavenlyStem;
  b_current_dayun_branch?: EarthlyBranch;
  stems_sheng: boolean;
  branches_he: boolean;
  branches_chong: boolean;
  both_rising: boolean;
  both_declining: boolean;
  score: number;
  description_zh: string;
  description_en: string;
}

const SHENG: Record<WuXing, WuXing> = {
  '木': '火', '火': '土', '土': '金', '金': '水', '水': '木'
};

export function calculateLuckCycleSync(input: {
  a_current_dayun_stem?: string;
  a_current_dayun_branch?: string;
  a_dayun_rising?: boolean;
  b_current_dayun_stem?: string;
  b_current_dayun_branch?: string;
  b_dayun_rising?: boolean;
}): LuckCycleSyncResult {

  if (!input.a_current_dayun_stem || !input.b_current_dayun_stem) {
    return {
      stems_sheng: false,
      branches_he: false,
      branches_chong: false,
      both_rising: false,
      both_declining: false,
      score: 0,
      description_zh: '大运信息不足,无法精确判断同步度。',
      description_en: 'Insufficient luck cycle data for precise sync analysis.'
    };
  }

  const aStem = input.a_current_dayun_stem as HeavenlyStem;
  const bStem = input.b_current_dayun_stem as HeavenlyStem;
  const aBranch = input.a_current_dayun_branch as EarthlyBranch;
  const bBranch = input.b_current_dayun_branch as EarthlyBranch;

  const aStemWx = STEMS[aStem]?.wuxing;
  const bStemWx = STEMS[bStem]?.wuxing;
  const stemsSheng = (aStemWx && bStemWx) ?
    (SHENG[aStemWx] === bStemWx || SHENG[bStemWx] === aStemWx) : false;

  const heCheck = isLiuHe(aBranch, bBranch);
  const branchesHe = heCheck.isHe;
  const branchesChong = isLiuChong(aBranch, bBranch);

  const bothRising = !!(input.a_dayun_rising && input.b_dayun_rising);
  const bothDeclining = !!(input.a_dayun_rising === false && input.b_dayun_rising === false);

  let score = 0;
  if (stemsSheng) score += 5;
  if (branchesHe) score += 8;
  if (branchesChong) score -= 6;
  if (bothRising) score += 6;
  if (bothDeclining) score -= 4;

  const stats = {
    stemsSheng,
    branchesHe,
    branchesChong,
    bothRising,
    bothDeclining,
    aStem,
    bStem,
    aBranch,
    bBranch
  };

  return {
    a_current_dayun_stem: aStem,
    a_current_dayun_branch: aBranch,
    b_current_dayun_stem: bStem,
    b_current_dayun_branch: bBranch,
    stems_sheng: stemsSheng,
    branches_he: branchesHe,
    branches_chong: branchesChong,
    both_rising: bothRising,
    both_declining: bothDeclining,
    score: Math.max(-15, Math.min(15, score)),
    description_zh: buildLuckSyncDescriptionZh(stats),
    description_en: buildLuckSyncDescriptionEn(stats)
  };
}

function buildLuckSyncDescriptionZh(s: {
  stemsSheng: boolean;
  branchesHe: boolean;
  branchesChong: boolean;
  bothRising: boolean;
  bothDeclining: boolean;
  aStem: HeavenlyStem;
  bStem: HeavenlyStem;
  aBranch: EarthlyBranch;
  bBranch: EarthlyBranch;
}): string {
  const parts: string[] = [];
  parts.push(`A 当前大运 ${s.aStem}${s.aBranch},B 当前大运 ${s.bStem}${s.bBranch}`);
  if (s.stemsSheng) parts.push('大运天干相生');
  if (s.branchesHe) parts.push('大运地支相合(同步)');
  if (s.branchesChong) parts.push('大运地支相冲(节奏不一)');
  if (s.bothRising) parts.push('双方运势同向上升');
  if (s.bothDeclining) parts.push('双方运势同向衰退');
  return parts.join(';') + '。';
}

function buildLuckSyncDescriptionEn(s: {
  stemsSheng: boolean;
  branchesHe: boolean;
  branchesChong: boolean;
  bothRising: boolean;
  bothDeclining: boolean;
  aStem: HeavenlyStem;
  bStem: HeavenlyStem;
  aBranch: EarthlyBranch;
  bBranch: EarthlyBranch;
}): string {
  const parts: string[] = [];
  parts.push(`A's current luck phase: ${s.aStem}${s.aBranch}; B's: ${s.bStem}${s.bBranch}`);
  if (s.stemsSheng) parts.push('Heavenly stems harmonize');
  if (s.branchesHe) parts.push('Earthly branches bond (synced cycles)');
  if (s.branchesChong) parts.push('Earthly branches clash (out of sync)');
  if (s.bothRising) parts.push('Both rising together');
  if (s.bothDeclining) parts.push('Both declining together');
  return parts.join('; ') + '.';
}
