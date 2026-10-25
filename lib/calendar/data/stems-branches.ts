// lib/match/data/stems-branches.ts

export type HeavenlyStem = '甲' | '乙' | '丙' | '丁' | '戊' | '己' | '庚' | '辛' | '壬' | '癸';
export type EarthlyBranch = '子' | '丑' | '寅' | '卯' | '辰' | '巳' | '午' | '未' | '申' | '酉' | '戌' | '亥';
export type WuXing = '木' | '火' | '土' | '金' | '水';
export type YinYang = '阳' | '阴';

export interface StemInfo {
  stem: HeavenlyStem;
  wuxing: WuXing;
  yinyang: YinYang;
}

export const STEMS: Record<HeavenlyStem, StemInfo> = {
  '甲': { stem: '甲', wuxing: '木', yinyang: '阳' },
  '乙': { stem: '乙', wuxing: '木', yinyang: '阴' },
  '丙': { stem: '丙', wuxing: '火', yinyang: '阳' },
  '丁': { stem: '丁', wuxing: '火', yinyang: '阴' },
  '戊': { stem: '戊', wuxing: '土', yinyang: '阳' },
  '己': { stem: '己', wuxing: '土', yinyang: '阴' },
  '庚': { stem: '庚', wuxing: '金', yinyang: '阳' },
  '辛': { stem: '辛', wuxing: '金', yinyang: '阴' },
  '壬': { stem: '壬', wuxing: '水', yinyang: '阳' },
  '癸': { stem: '癸', wuxing: '水', yinyang: '阴' }
};

export const BRANCHES: Record<EarthlyBranch, {
  branch: EarthlyBranch;
  wuxing: WuXing;
  yinyang: YinYang;
  hidden_stems: HeavenlyStem[];
}> = {
  '子': { branch: '子', wuxing: '水', yinyang: '阳', hidden_stems: ['癸'] },
  '丑': { branch: '丑', wuxing: '土', yinyang: '阴', hidden_stems: ['己', '癸', '辛'] },
  '寅': { branch: '寅', wuxing: '木', yinyang: '阳', hidden_stems: ['甲', '丙', '戊'] },
  '卯': { branch: '卯', wuxing: '木', yinyang: '阴', hidden_stems: ['乙'] },
  '辰': { branch: '辰', wuxing: '土', yinyang: '阳', hidden_stems: ['戊', '乙', '癸'] },
  '巳': { branch: '巳', wuxing: '火', yinyang: '阴', hidden_stems: ['丙', '戊', '庚'] },
  '午': { branch: '午', wuxing: '火', yinyang: '阳', hidden_stems: ['丁', '己'] },
  '未': { branch: '未', wuxing: '土', yinyang: '阴', hidden_stems: ['己', '丁', '乙'] },
  '申': { branch: '申', wuxing: '金', yinyang: '阳', hidden_stems: ['庚', '壬', '戊'] },
  '酉': { branch: '酉', wuxing: '金', yinyang: '阴', hidden_stems: ['辛'] },
  '戌': { branch: '戌', wuxing: '土', yinyang: '阳', hidden_stems: ['戊', '辛', '丁'] },
  '亥': { branch: '亥', wuxing: '水', yinyang: '阴', hidden_stems: ['壬', '甲'] }
};

export type TenGod =
  | '比肩' | '劫财'
  | '食神' | '伤官'
  | '偏财' | '正财'
  | '七杀' | '正官'
  | '偏印' | '正印';

const SHENG: Record<WuXing, WuXing> = {
  '木': '火', '火': '土', '土': '金', '金': '水', '水': '木'
};

const KE: Record<WuXing, WuXing> = {
  '木': '土', '土': '水', '水': '火', '火': '金', '金': '木'
};

export function calculateTenGod(dayMaster: HeavenlyStem, otherStem: HeavenlyStem): TenGod {
  const dm = STEMS[dayMaster];
  const ot = STEMS[otherStem];

  const sameYinYang = dm.yinyang === ot.yinyang;

  if (dm.wuxing === ot.wuxing) {
    return sameYinYang ? '比肩' : '劫财';
  }

  if (SHENG[dm.wuxing] === ot.wuxing) {
    return sameYinYang ? '食神' : '伤官';
  }

  if (SHENG[ot.wuxing] === dm.wuxing) {
    return sameYinYang ? '偏印' : '正印';
  }

  if (KE[dm.wuxing] === ot.wuxing) {
    return sameYinYang ? '偏财' : '正财';
  }

  if (KE[ot.wuxing] === dm.wuxing) {
    return sameYinYang ? '七杀' : '正官';
  }

  return '比肩';
}

export const TEN_GOD_NATURE: Record<TenGod, {
  category: 'helpful' | 'neutral' | 'challenging';
  base_score: number;
}> = {
  '比肩': { category: 'neutral', base_score: 3 },
  '劫财': { category: 'challenging', base_score: -3 },
  '食神': { category: 'helpful', base_score: 7 },
  '伤官': { category: 'neutral', base_score: 2 },
  '偏财': { category: 'helpful', base_score: 5 },
  '正财': { category: 'helpful', base_score: 7 },
  '七杀': { category: 'challenging', base_score: -2 },
  '正官': { category: 'helpful', base_score: 5 },
  '偏印': { category: 'neutral', base_score: 1 },
  '正印': { category: 'helpful', base_score: 7 }
};
