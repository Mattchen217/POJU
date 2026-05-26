// lib/match/data/shensha.ts

import type { HeavenlyStem, EarthlyBranch } from './stems-branches';

export const TIAN_YI_GUI_REN: Record<HeavenlyStem, EarthlyBranch[]> = {
  '甲': ['丑', '未'],
  '戊': ['丑', '未'],
  '庚': ['丑', '未'],
  '乙': ['子', '申'],
  '己': ['子', '申'],
  '丙': ['亥', '酉'],
  '丁': ['亥', '酉'],
  '壬': ['卯', '巳'],
  '癸': ['卯', '巳'],
  '辛': ['午', '寅']
};

export const WEN_CHANG: Record<HeavenlyStem, EarthlyBranch> = {
  '甲': '巳', '乙': '午',
  '丙': '申', '丁': '酉',
  '戊': '申', '己': '酉',
  '庚': '亥', '辛': '子',
  '壬': '寅', '癸': '卯'
};

export const TAO_HUA_MAP: Record<EarthlyBranch, EarthlyBranch> = {
  '申': '酉', '子': '酉', '辰': '酉',
  '亥': '子', '卯': '子', '未': '子',
  '寅': '卯', '午': '卯', '戌': '卯',
  '巳': '午', '酉': '午', '丑': '午'
};

export const YI_MA_MAP: Record<EarthlyBranch, EarthlyBranch> = {
  '申': '寅', '子': '寅', '辰': '寅',
  '亥': '巳', '卯': '巳', '未': '巳',
  '寅': '申', '午': '申', '戌': '申',
  '巳': '亥', '酉': '亥', '丑': '亥'
};

export const HUA_GAI_MAP: Record<EarthlyBranch, EarthlyBranch> = {
  '申': '辰', '子': '辰', '辰': '辰',
  '亥': '未', '卯': '未', '未': '未',
  '寅': '戌', '午': '戌', '戌': '戌',
  '巳': '丑', '酉': '丑', '丑': '丑'
};

export const GU_CHEN: Record<EarthlyBranch, EarthlyBranch> = {
  '亥': '寅', '子': '寅', '丑': '寅',
  '寅': '巳', '卯': '巳', '辰': '巳',
  '巳': '申', '午': '申', '未': '申',
  '申': '亥', '酉': '亥', '戌': '亥'
};

export const GUA_SU: Record<EarthlyBranch, EarthlyBranch> = {
  '亥': '戌', '子': '戌', '丑': '戌',
  '寅': '丑', '卯': '丑', '辰': '丑',
  '巳': '辰', '午': '辰', '未': '辰',
  '申': '未', '酉': '未', '戌': '未'
};

export type ShenShaName = '天乙贵人' | '文昌' | '桃花' | '驿马' | '华盖' | '孤辰' | '寡宿';

export interface ShenShaCheck {
  name: ShenShaName;
  found: boolean;
  positions: ('year' | 'month' | 'day' | 'hour')[];
}

export function checkAllShenSha(input: {
  dayMaster: HeavenlyStem;
  yearBranch: EarthlyBranch;
  dayBranch: EarthlyBranch;
  branches: Record<'year' | 'month' | 'day' | 'hour', EarthlyBranch>;
}): ShenShaCheck[] {
  const checks: ShenShaCheck[] = [];
  const positions: ('year' | 'month' | 'day' | 'hour')[] = ['year', 'month', 'day', 'hour'];

  const guiRenBranches = TIAN_YI_GUI_REN[input.dayMaster];
  const guiRenPositions = positions.filter(p => guiRenBranches.includes(input.branches[p]));
  checks.push({
    name: '天乙贵人',
    found: guiRenPositions.length > 0,
    positions: guiRenPositions
  });

  const wenChangBranch = WEN_CHANG[input.dayMaster];
  const wenChangPositions = positions.filter(p => input.branches[p] === wenChangBranch);
  checks.push({
    name: '文昌',
    found: wenChangPositions.length > 0,
    positions: wenChangPositions
  });

  const taoHuaBranchFromYear = TAO_HUA_MAP[input.yearBranch];
  const taoHuaBranchFromDay = TAO_HUA_MAP[input.dayBranch];
  const taoHuaPositions = positions.filter(p =>
    input.branches[p] === taoHuaBranchFromYear || input.branches[p] === taoHuaBranchFromDay
  );
  checks.push({
    name: '桃花',
    found: taoHuaPositions.length > 0,
    positions: taoHuaPositions
  });

  const yiMaBranch = YI_MA_MAP[input.yearBranch] || YI_MA_MAP[input.dayBranch];
  const yiMaPositions = positions.filter(p => input.branches[p] === yiMaBranch);
  checks.push({
    name: '驿马',
    found: yiMaPositions.length > 0,
    positions: yiMaPositions
  });

  const huaGaiBranch = HUA_GAI_MAP[input.yearBranch] || HUA_GAI_MAP[input.dayBranch];
  const huaGaiPositions = positions.filter(p => input.branches[p] === huaGaiBranch);
  checks.push({
    name: '华盖',
    found: huaGaiPositions.length > 0,
    positions: huaGaiPositions
  });

  const guChenBranch = GU_CHEN[input.yearBranch];
  const guChenPositions = positions.filter(p => input.branches[p] === guChenBranch);
  checks.push({
    name: '孤辰',
    found: guChenPositions.length > 0,
    positions: guChenPositions
  });

  const guaSuBranch = GUA_SU[input.yearBranch];
  const guaSuPositions = positions.filter(p => input.branches[p] === guaSuBranch);
  checks.push({
    name: '寡宿',
    found: guaSuPositions.length > 0,
    positions: guaSuPositions
  });

  return checks;
}
