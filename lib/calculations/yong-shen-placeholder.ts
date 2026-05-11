import type { FiveElement, YongShenOutput } from "./types";

const ELEMENTS: FiveElement[] = ["wood", "fire", "earth", "metal", "water"];

/**
 * 在 shunshi-bazi-core + M5 未接入前，用出生年生成稳定占位用神，供 M6 浏览模式使用。
 * 上线后由 calculateProfile() 替换。
 */
export function approximateYongShenFromBirthYear(year: number): YongShenOutput {
  const y = Number.isFinite(year) ? Math.abs(Math.floor(year)) : 1990;
  const primary = ELEMENTS[y % 5];
  const ji = ELEMENTS[(y + 2) % 5];
  return {
    primary_yong_shen: primary,
    ji_shen: [ji],
  };
}
