// lib/match/calculations/day-master-interaction.ts

import { STEMS, type HeavenlyStem } from '../data/stems-branches';

export type DayMasterInteractionType =
  | 'tianhe'
  | 'sheng_a_to_b'
  | 'sheng_b_to_a'
  | 'ke_a_to_b'
  | 'ke_b_to_a'
  | 'same_wuxing'
  | 'tianchong';

export interface DayMasterInteractionResult {
  type: DayMasterInteractionType;
  a_stem: HeavenlyStem;
  b_stem: HeavenlyStem;
  score: number;
  description_zh: string;
  description_en: string;
}

const TIAN_GAN_WU_HE: Array<[HeavenlyStem, HeavenlyStem, string]> = [
  ['甲', '己', '中正之合'],
  ['乙', '庚', '仁义之合'],
  ['丙', '辛', '威制之合'],
  ['丁', '壬', '淫匿之合'],
  ['戊', '癸', '无情之合']
];

const TIAN_GAN_QI_CHONG: Array<[HeavenlyStem, HeavenlyStem]> = [
  ['甲', '庚'], ['乙', '辛'],
  ['丙', '壬'], ['丁', '癸']
];

const SHENG: Record<string, string> = {
  '木': '火', '火': '土', '土': '金', '金': '水', '水': '木'
};

const KE: Record<string, string> = {
  '木': '土', '土': '水', '水': '火', '火': '金', '金': '木'
};

export function calculateDayMasterInteraction(
  dayMasterA: HeavenlyStem,
  dayMasterB: HeavenlyStem
): DayMasterInteractionResult {

  for (const [x, y, name] of TIAN_GAN_WU_HE) {
    if ((dayMasterA === x && dayMasterB === y) || (dayMasterA === y && dayMasterB === x)) {
      return {
        type: 'tianhe',
        a_stem: dayMasterA,
        b_stem: dayMasterB,
        score: 18,
        description_zh: `${dayMasterA}${dayMasterB}${name},天干相合,基础深度连接。`,
        description_en: `${dayMasterA} and ${dayMasterB} form a heavenly bond — natural attraction and deep compatibility.`
      };
    }
  }

  for (const [x, y] of TIAN_GAN_QI_CHONG) {
    if ((dayMasterA === x && dayMasterB === y) || (dayMasterA === y && dayMasterB === x)) {
      return {
        type: 'tianchong',
        a_stem: dayMasterA,
        b_stem: dayMasterB,
        score: -15,
        description_zh: `${dayMasterA}${dayMasterB}相冲,日主对立,需要更多磨合。`,
        description_en: `${dayMasterA} and ${dayMasterB} clash — fundamental tension between core personalities.`
      };
    }
  }

  const aWx = STEMS[dayMasterA].wuxing;
  const bWx = STEMS[dayMasterB].wuxing;

  if (aWx === bWx) {
    return {
      type: 'same_wuxing',
      a_stem: dayMasterA,
      b_stem: dayMasterB,
      score: 5,
      description_zh: `日主同${aWx},同道但需避免比劫相争。`,
      description_en: `Both day masters are ${aWx}-element — kindred but watch for competition.`
    };
  }

  if (SHENG[aWx] === bWx) {
    return {
      type: 'sheng_a_to_b',
      a_stem: dayMasterA,
      b_stem: dayMasterB,
      score: 10,
      description_zh: `A 的${aWx}生 B 的${bWx},A 滋养 B。`,
      description_en: `A's ${aWx} nourishes B's ${bWx} — A naturally supports B.`
    };
  }

  if (SHENG[bWx] === aWx) {
    return {
      type: 'sheng_b_to_a',
      a_stem: dayMasterA,
      b_stem: dayMasterB,
      score: 10,
      description_zh: `B 的${bWx}生 A 的${aWx},B 滋养 A。`,
      description_en: `B's ${bWx} nourishes A's ${aWx} — B naturally supports A.`
    };
  }

  if (KE[aWx] === bWx) {
    return {
      type: 'ke_a_to_b',
      a_stem: dayMasterA,
      b_stem: dayMasterB,
      score: -8,
      description_zh: `A 的${aWx}克 B 的${bWx},A 容易压制 B。`,
      description_en: `A's ${aWx} dominates B's ${bWx} — risk of A overpowering B.`
    };
  }

  if (KE[bWx] === aWx) {
    return {
      type: 'ke_b_to_a',
      a_stem: dayMasterA,
      b_stem: dayMasterB,
      score: -8,
      description_zh: `B 的${bWx}克 A 的${aWx},B 容易压制 A。`,
      description_en: `B's ${bWx} dominates A's ${aWx} — risk of B overpowering A.`
    };
  }

  return {
    type: 'same_wuxing',
    a_stem: dayMasterA,
    b_stem: dayMasterB,
    score: 0,
    description_zh: '日主无强关系,中性互动。',
    description_en: 'Neutral day master interaction.'
  };
}
