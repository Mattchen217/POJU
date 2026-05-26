// lib/match/calculations/yong-shen-match.ts

import type { WuXing } from '../data/stems-branches';

export interface YongShenMatchResult {
  a_yong_shen_in_b: 'abundant' | 'sufficient' | 'lacking';
  b_yong_shen_in_a: 'abundant' | 'sufficient' | 'lacking';
  a_supports_b: boolean;
  b_supports_a: boolean;
  score: number;
  description_zh: string;
  description_en: string;
}

export function calculateYongShenMatch(input: {
  a_yong_shen_primary: WuXing;
  a_yong_shen_secondary?: WuXing;
  b_yong_shen_primary: WuXing;
  b_yong_shen_secondary?: WuXing;
  a_wuxing_distribution: Record<WuXing, number>;
  b_wuxing_distribution: Record<WuXing, number>;
}): YongShenMatchResult {

  const aYsInB = input.b_wuxing_distribution[input.a_yong_shen_primary] || 0;
  let aYsInBState: 'abundant' | 'sufficient' | 'lacking';
  if (aYsInB >= 3) aYsInBState = 'abundant';
  else if (aYsInB >= 1) aYsInBState = 'sufficient';
  else aYsInBState = 'lacking';

  const bYsInA = input.a_wuxing_distribution[input.b_yong_shen_primary] || 0;
  let bYsInAState: 'abundant' | 'sufficient' | 'lacking';
  if (bYsInA >= 3) bYsInAState = 'abundant';
  else if (bYsInA >= 1) bYsInAState = 'sufficient';
  else bYsInAState = 'lacking';

  const aSupportsB = bYsInA >= 2;
  const bSupportsA = aYsInB >= 2;

  let score = 0;
  if (aYsInBState === 'abundant') score += 8;
  else if (aYsInBState === 'sufficient') score += 4;
  else score -= 5;

  if (bYsInAState === 'abundant') score += 8;
  else if (bYsInAState === 'sufficient') score += 4;
  else score -= 5;

  if (aSupportsB && bSupportsA) score += 5;

  return {
    a_yong_shen_in_b: aYsInBState,
    b_yong_shen_in_a: bYsInAState,
    a_supports_b: aSupportsB,
    b_supports_a: bSupportsA,
    score: Math.max(-20, Math.min(20, score)),
    description_zh: buildYongShenDescriptionZh(aYsInBState, bYsInAState, aSupportsB, bSupportsA, input),
    description_en: buildYongShenDescriptionEn(aYsInBState, bYsInAState, aSupportsB, bSupportsA, input)
  };
}

function buildYongShenDescriptionZh(
  aInB: string, bInA: string, aHelps: boolean, bHelps: boolean,
  input: {
    a_yong_shen_primary: WuXing;
    b_yong_shen_primary: WuXing;
  }
): string {
  let desc = `A 的用神为${input.a_yong_shen_primary},在 B 命盘中${aInB === 'abundant' ? '充沛' : aInB === 'sufficient' ? '适中' : '缺乏'}。`;
  desc += `B 的用神为${input.b_yong_shen_primary},在 A 命盘中${bInA === 'abundant' ? '充沛' : bInA === 'sufficient' ? '适中' : '缺乏'}。`;
  if (aHelps && bHelps) desc += '互为补足,相辅相成。';
  else if (aHelps) desc += 'A 能给 B 带来其所需。';
  else if (bHelps) desc += 'B 能给 A 带来其所需。';
  else desc += '彼此需要的元素都不在对方,需主动经营。';
  return desc;
}

function buildYongShenDescriptionEn(
  aInB: string, bInA: string, aHelps: boolean, bHelps: boolean,
  input: {
    a_yong_shen_primary: WuXing;
    b_yong_shen_primary: WuXing;
  }
): string {
  let desc = `A's favorable element (${input.a_yong_shen_primary}) is ${aInB} in B's chart. `;
  desc += `B's favorable element (${input.b_yong_shen_primary}) is ${bInA} in A's chart. `;
  if (aHelps && bHelps) desc += 'Mutual nourishment — you complete each other.';
  else if (aHelps) desc += 'A brings what B needs.';
  else if (bHelps) desc += 'B brings what A needs.';
  else desc += 'Neither chart fully provides what the other lacks — relationship needs intentional cultivation.';
  return desc;
}
