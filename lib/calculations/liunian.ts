import { Solar } from "lunar-typescript";

import type { EarthlyBranch, HeavenlyStem } from "@/lib/match/data/stems-branches";

export type LiuNianGanzhi = {
  stem: HeavenlyStem;
  branch: EarthlyBranch;
  ganzhi: string;
};

/** 当前流年干支（立春换年 · lunar-typescript，非手写查表）。 */
export function getCurrentLiunian(date = new Date()): LiuNianGanzhi {
  const solar = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const lunar = solar.getLunar();
  const stem = lunar.getYearGanByLiChun() as HeavenlyStem;
  const branch = lunar.getYearZhiByLiChun() as EarthlyBranch;
  return { stem, branch, ganzhi: `${stem}${branch}` };
}
