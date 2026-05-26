// lib/match/calculations/branch-interactions.ts

import {
  analyzeAllBranchInteractions,
  type BranchInteraction
} from '../data/branch-relations';
import type { EarthlyBranch } from '../data/stems-branches';

export interface BranchInteractionsResult {
  interactions: BranchInteraction[];
  liu_he_count: number;
  liu_chong_count: number;
  xing_count: number;
  liu_hai_count: number;
  day_branch_he: boolean;
  day_branch_chong: boolean;
  score: number;
  description_zh: string;
  description_en: string;
}

export function calculateBranchInteractions(
  aBranches: Record<'year' | 'month' | 'day' | 'hour', EarthlyBranch>,
  bBranches: Record<'year' | 'month' | 'day' | 'hour', EarthlyBranch>
): BranchInteractionsResult {

  const interactions = analyzeAllBranchInteractions(aBranches, bBranches);

  let liu_he_count = 0;
  let liu_chong_count = 0;
  let xing_count = 0;
  let liu_hai_count = 0;

  let dayBranchHe = false;
  let dayBranchChong = false;

  for (const inter of interactions) {
    if (inter.liu_he) liu_he_count++;
    if (inter.liu_chong) liu_chong_count++;
    if (inter.xing) xing_count++;
    if (inter.liu_hai) liu_hai_count++;

    if (inter.a_position === 'day' && inter.b_position === 'day') {
      if (inter.liu_he) dayBranchHe = true;
      if (inter.liu_chong) dayBranchChong = true;
    }
  }

  let score = 0;

  if (dayBranchHe) score += 12;
  if (dayBranchChong) score -= 12;

  score += liu_he_count * 3;
  score -= liu_chong_count * 3;
  score -= xing_count * 2;
  score -= liu_hai_count * 1;

  const stats = {
    liu_he_count, liu_chong_count, xing_count, liu_hai_count,
    dayBranchHe, dayBranchChong
  };

  return {
    interactions,
    liu_he_count,
    liu_chong_count,
    xing_count,
    liu_hai_count,
    day_branch_he: dayBranchHe,
    day_branch_chong: dayBranchChong,
    score: Math.max(-20, Math.min(20, score)),
    description_zh: buildBranchDescriptionZh(stats),
    description_en: buildBranchDescriptionEn(stats)
  };
}

function buildBranchDescriptionZh(stats: {
  liu_he_count: number;
  liu_chong_count: number;
  xing_count: number;
  liu_hai_count: number;
  dayBranchHe: boolean;
  dayBranchChong: boolean;
}): string {
  const parts: string[] = [];

  if (stats.dayBranchHe) parts.push('日支相合,夫妻宫和合,缘分深厚');
  if (stats.dayBranchChong) parts.push('日支相冲,夫妻宫冲克,需多体谅');

  if (stats.liu_he_count > 0) parts.push(`六合${stats.liu_he_count}处,亲近自然`);
  if (stats.liu_chong_count > 0) parts.push(`六冲${stats.liu_chong_count}处,易生摩擦`);
  if (stats.xing_count > 0) parts.push(`刑${stats.xing_count}处,需化解`);
  if (stats.liu_hai_count > 0) parts.push(`六害${stats.liu_hai_count}处,暗中相损`);

  return parts.length > 0 ? parts.join(';') + '。' : '地支互动平淡,中性。';
}

function buildBranchDescriptionEn(stats: {
  liu_he_count: number;
  liu_chong_count: number;
  xing_count: number;
  liu_hai_count: number;
  dayBranchHe: boolean;
  dayBranchChong: boolean;
}): string {
  const parts: string[] = [];

  if (stats.dayBranchHe) parts.push('Day branches harmonize (marriage palace alignment)');
  if (stats.dayBranchChong) parts.push('Day branches clash (marriage palace tension)');

  if (stats.liu_he_count > 0) parts.push(`${stats.liu_he_count} earthly bonds (closeness)`);
  if (stats.liu_chong_count > 0) parts.push(`${stats.liu_chong_count} clashes (friction)`);
  if (stats.xing_count > 0) parts.push(`${stats.xing_count} punishment relationships`);
  if (stats.liu_hai_count > 0) parts.push(`${stats.liu_hai_count} hidden harms`);

  return parts.length > 0 ? parts.join('; ') + '.' : 'Neutral branch interaction overall.';
}
