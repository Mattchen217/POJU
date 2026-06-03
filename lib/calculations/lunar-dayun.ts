import { Solar } from "lunar-typescript";

export type TrueSolarParts = {
  y: number;
  m: number;
  d: number;
  h: number;
  min: number;
};

export type DaYunEntry = {
  start_age: number;
  start_year: number;
  ganzhi: string;
};

/** shunshi / lunar 共用：1 = 男，0 = 女 */
export function lunarGenderFromBirth(gender: "M" | "F"): 0 | 1 {
  return gender === "M" ? 1 : 0;
}

/** Parse `chart.真太阳时.真太阳时` or `YYYY-MM-DD HH:mm` TST meta fields. */
export function parseTrueSolarTimeString(raw: string): TrueSolarParts {
  const [datePart, timePart = "00:00"] = raw.trim().split(/\s+/);
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, min] = timePart.split(":").map(Number);
  return { y, m, d, h, min: min ?? 0 };
}

/**
 * 大运（lunar-typescript），基于 shunshi 输出的真太阳时，sect=1 与 shunshi 一致。
 * Index 0 为小运占位（无干支），已过滤。
 */
export function calcDaYun(input: {
  trueSolarTime: TrueSolarParts;
  gender: 0 | 1;
}): DaYunEntry[] {
  const { y, m, d, h, min } = input.trueSolarTime;
  const solar = Solar.fromYmdHms(y, m, d, h, min, 0);
  const ec = solar.getLunar().getEightChar();
  ec.setSect(1);
  const yun = ec.getYun(input.gender, 1);

  return yun
    .getDaYun()
    .map((row) => ({
      start_age: row.getStartAge(),
      start_year: row.getStartYear(),
      ganzhi: row.getGanZhi(),
    }))
    .filter((row) => row.ganzhi.length > 0);
}
