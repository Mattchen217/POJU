// lib/match/calculations/spouse-star.ts

import { calculateTenGod, type HeavenlyStem } from '../data/stems-branches';

export interface SpouseStarResult {
  a_spouse_star_type: '正财' | '正官' | null;
  a_spouse_star_present: boolean;
  a_spouse_star_in_pillars: ('year' | 'month' | 'day' | 'hour')[];
  b_spouse_star_type: '正财' | '正官' | null;
  b_spouse_star_present: boolean;
  b_spouse_star_in_pillars: ('year' | 'month' | 'day' | 'hour')[];
  a_is_b_spouse_star: boolean;
  b_is_a_spouse_star: boolean;
  score: number;
  description_zh: string;
  description_en: string;
}

export function calculateSpouseStar(input: {
  a_day_master: HeavenlyStem;
  a_gender: 'M' | 'F';
  a_all_stems: Record<'year' | 'month' | 'day' | 'hour', HeavenlyStem>;
  b_day_master: HeavenlyStem;
  b_gender: 'M' | 'F';
  b_all_stems: Record<'year' | 'month' | 'day' | 'hour', HeavenlyStem>;
}): SpouseStarResult {

  const aSpouseType = input.a_gender === 'M' ? '正财' : '正官';

  const aSpouseInPillars: ('year' | 'month' | 'day' | 'hour')[] = [];
  for (const pos of ['year', 'month', 'hour'] as const) {
    const tenGod = calculateTenGod(input.a_day_master, input.a_all_stems[pos]);
    if (tenGod === aSpouseType) aSpouseInPillars.push(pos);
  }

  const bSpouseType = input.b_gender === 'M' ? '正财' : '正官';

  const bSpouseInPillars: ('year' | 'month' | 'day' | 'hour')[] = [];
  for (const pos of ['year', 'month', 'hour'] as const) {
    const tenGod = calculateTenGod(input.b_day_master, input.b_all_stems[pos]);
    if (tenGod === bSpouseType) bSpouseInPillars.push(pos);
  }

  const aAsBOther = calculateTenGod(input.b_day_master, input.a_day_master);
  const bAsAOther = calculateTenGod(input.a_day_master, input.b_day_master);

  const aIsBSpouseStar = aAsBOther === bSpouseType;
  const bIsASpouseStar = bAsAOther === aSpouseType;

  let score = 0;
  if (aIsBSpouseStar && bIsASpouseStar) score += 18;
  else if (aIsBSpouseStar || bIsASpouseStar) score += 10;

  if (aSpouseInPillars.length > 0) score += 5;
  if (bSpouseInPillars.length > 0) score += 5;

  if (aSpouseInPillars.length === 0 && bSpouseInPillars.length === 0) score -= 8;

  return {
    a_spouse_star_type: aSpouseType,
    a_spouse_star_present: aSpouseInPillars.length > 0,
    a_spouse_star_in_pillars: aSpouseInPillars,
    b_spouse_star_type: bSpouseType,
    b_spouse_star_present: bSpouseInPillars.length > 0,
    b_spouse_star_in_pillars: bSpouseInPillars,
    a_is_b_spouse_star: aIsBSpouseStar,
    b_is_a_spouse_star: bIsASpouseStar,
    score: Math.max(-20, Math.min(20, score)),
    description_zh: buildSpouseDescriptionZh(aIsBSpouseStar, bIsASpouseStar, aAsBOther, bAsAOther),
    description_en: buildSpouseDescriptionEn(aIsBSpouseStar, bIsASpouseStar, aAsBOther, bAsAOther)
  };
}

function buildSpouseDescriptionZh(aIsB: boolean, bIsA: boolean, aAsB: string, bAsA: string): string {
  if (aIsB && bIsA) {
    return `双向配偶星(A 为 B 的${aAsB},B 为 A 的${bAsA}),天作之合。`;
  }
  if (aIsB) return `A 是 B 的${aAsB},A 满足 B 对配偶的期待。`;
  if (bIsA) return `B 是 A 的${bAsA},B 满足 A 对配偶的期待。`;
  return `相互不是对方的配偶星,关系需自行经营。`;
}

function buildSpouseDescriptionEn(aIsB: boolean, bIsA: boolean, aAsB: string, bAsA: string): string {
  if (aIsB && bIsA) {
    return `Mutual spouse-star alignment — natural partner archetype for each other.`;
  }
  if (aIsB) return `A fits B's spouse archetype (${aAsB}).`;
  if (bIsA) return `B fits A's spouse archetype (${bAsA}).`;
  return `Neither fits the other's spouse archetype — relationship requires conscious cultivation.`;
}
