// lib/match/data/branch-relations.ts

import type { EarthlyBranch } from './stems-branches';

export const LIU_HE: Array<[EarthlyBranch, EarthlyBranch, string]> = [
  ['子', '丑', '合化土'],
  ['寅', '亥', '合化木'],
  ['卯', '戌', '合化火'],
  ['辰', '酉', '合化金'],
  ['巳', '申', '合化水'],
  ['午', '未', '合化太阳太阴']
];

export const LIU_CHONG: Array<[EarthlyBranch, EarthlyBranch]> = [
  ['子', '午'],
  ['丑', '未'],
  ['寅', '申'],
  ['卯', '酉'],
  ['辰', '戌'],
  ['巳', '亥']
];

export const SAN_XING: Array<{
  branches: EarthlyBranch[];
  type: string;
}> = [
  { branches: ['寅', '巳', '申'], type: '无恩之刑' },
  { branches: ['丑', '戌', '未'], type: '恃势之刑' },
  { branches: ['子', '卯'], type: '无礼之刑' },
  { branches: ['辰', '辰'], type: '自刑' },
  { branches: ['午', '午'], type: '自刑' },
  { branches: ['酉', '酉'], type: '自刑' },
  { branches: ['亥', '亥'], type: '自刑' }
];

export const LIU_HAI: Array<[EarthlyBranch, EarthlyBranch]> = [
  ['子', '未'],
  ['丑', '午'],
  ['寅', '巳'],
  ['卯', '辰'],
  ['申', '亥'],
  ['酉', '戌']
];

export const SAN_HE: Array<{
  branches: EarthlyBranch[];
  element: string;
}> = [
  { branches: ['申', '子', '辰'], element: '水局' },
  { branches: ['亥', '卯', '未'], element: '木局' },
  { branches: ['寅', '午', '戌'], element: '火局' },
  { branches: ['巳', '酉', '丑'], element: '金局' }
];

export function isLiuHe(a: EarthlyBranch, b: EarthlyBranch): { isHe: boolean; element?: string } {
  for (const [x, y, element] of LIU_HE) {
    if ((a === x && b === y) || (a === y && b === x)) {
      return { isHe: true, element };
    }
  }
  return { isHe: false };
}

export function isLiuChong(a: EarthlyBranch, b: EarthlyBranch): boolean {
  for (const [x, y] of LIU_CHONG) {
    if ((a === x && b === y) || (a === y && b === x)) {
      return true;
    }
  }
  return false;
}

export function isLiuHai(a: EarthlyBranch, b: EarthlyBranch): boolean {
  for (const [x, y] of LIU_HAI) {
    if ((a === x && b === y) || (a === y && b === x)) {
      return true;
    }
  }
  return false;
}

export function isXing(a: EarthlyBranch, b: EarthlyBranch): { isXing: boolean; type?: string } {
  for (const { branches, type } of SAN_XING) {
    if (branches.length === 2) {
      if (branches[0] === branches[1]) {
        // 自刑: 同支
        if (a === branches[0] && b === branches[0]) {
          return { isXing: true, type };
        }
      } else {
        // 二元刑(如子卯)
        if (
          (a === branches[0] && b === branches[1]) ||
          (a === branches[1] && b === branches[0])
        ) {
          return { isXing: true, type };
        }
      }
    } else {
      if (branches.includes(a) && branches.includes(b) && a !== b) {
        return { isXing: true, type };
      }
    }
  }
  return { isXing: false };
}

export interface BranchInteraction {
  a_branch: EarthlyBranch;
  a_position: 'year' | 'month' | 'day' | 'hour';
  b_branch: EarthlyBranch;
  b_position: 'year' | 'month' | 'day' | 'hour';

  liu_he: boolean;
  liu_he_element?: string;
  liu_chong: boolean;
  xing: boolean;
  xing_type?: string;
  liu_hai: boolean;
}

export function analyzeAllBranchInteractions(
  aBranches: Record<'year' | 'month' | 'day' | 'hour', EarthlyBranch>,
  bBranches: Record<'year' | 'month' | 'day' | 'hour', EarthlyBranch>
): BranchInteraction[] {
  const positions: ('year' | 'month' | 'day' | 'hour')[] = ['year', 'month', 'day', 'hour'];
  const interactions: BranchInteraction[] = [];

  for (const posA of positions) {
    for (const posB of positions) {
      const a = aBranches[posA];
      const b = bBranches[posB];

      const he = isLiuHe(a, b);
      const chong = isLiuChong(a, b);
      const xing = isXing(a, b);
      const hai = isLiuHai(a, b);

      if (he.isHe || chong || xing.isXing || hai) {
        interactions.push({
          a_branch: a,
          a_position: posA,
          b_branch: b,
          b_position: posB,
          liu_he: he.isHe,
          liu_he_element: he.element,
          liu_chong: chong,
          xing: xing.isXing,
          xing_type: xing.type,
          liu_hai: hai
        });
      }
    }
  }

  return interactions;
}
