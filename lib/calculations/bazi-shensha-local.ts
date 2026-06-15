/**
 * Local 神煞 computation — merges with shunshi chart 神煞 arrays.
 * Reuses match-engine tables; maps to i18n keys for UI.
 */

import { TIAN_YI_GUI_REN, WEN_CHANG, checkAllShenSha } from "@/lib/match/data/shensha";

export const SHENSHA_I18N_KEY: Record<string, string> = {
  天乙贵人: "bazi.shensha.tian_yi_gui_ren",
  禄神: "bazi.shensha.lu_shen",
  飞刃: "bazi.shensha.fei_ren",
  文昌: "bazi.shensha.wen_chang",
  桃花: "bazi.shensha.tao_hua",
  驿马: "bazi.shensha.yi_ma",
  华盖: "bazi.shensha.hua_gai",
  孤辰: "bazi.shensha.gu_chen",
  寡宿: "bazi.shensha.gua_su",
};

/** 禄神 — day stem → prosperity branch */
export const LU_SHEN: Record<string, string> = {
  甲: "寅",
  乙: "卯",
  丙: "巳",
  丁: "午",
  戊: "巳",
  己: "午",
  庚: "申",
  辛: "酉",
  壬: "亥",
  癸: "子",
};

/** 飞刃 (羊刃) — day stem → blade branch */
export const FEI_REN: Record<string, string> = {
  甲: "卯",
  乙: "寅",
  丙: "午",
  丁: "巳",
  戊: "午",
  己: "巳",
  庚: "酉",
  辛: "申",
  壬: "子",
  癸: "亥",
};

export type PillarKey = "year" | "month" | "day" | "hour";

export function shenshaHanToI18nKey(han: string): string {
  return SHENSHA_I18N_KEY[han] ?? `bazi.shensha.${han}`;
}

export function computeLocalShenShaForPillars(input: {
  dayMasterStem: string;
  branches: Record<PillarKey, string>;
  yearBranch: string;
  dayBranch: string;
}): Record<PillarKey, string[]> {
  const result: Record<PillarKey, string[]> = {
    year: [],
    month: [],
    day: [],
    hour: [],
  };

  const positions: PillarKey[] = ["year", "month", "day", "hour"];

  const guiRenBranches = TIAN_YI_GUI_REN[input.dayMasterStem as keyof typeof TIAN_YI_GUI_REN];
  if (guiRenBranches) {
    for (const p of positions) {
      if (guiRenBranches.includes(input.branches[p] as never)) {
        result[p].push("天乙贵人");
      }
    }
  }

  const luBranch = LU_SHEN[input.dayMasterStem];
  if (luBranch) {
    for (const p of positions) {
      if (input.branches[p] === luBranch) result[p].push("禄神");
    }
  }

  const feiBranch = FEI_REN[input.dayMasterStem];
  if (feiBranch) {
    for (const p of positions) {
      if (input.branches[p] === feiBranch) result[p].push("飞刃");
    }
  }

  const wenChangBranch = WEN_CHANG[input.dayMasterStem as keyof typeof WEN_CHANG];
  if (wenChangBranch) {
    for (const p of positions) {
      if (input.branches[p] === wenChangBranch) result[p].push("文昌");
    }
  }

  const matchChecks = checkAllShenSha({
    dayMaster: input.dayMasterStem as never,
    yearBranch: input.yearBranch as never,
    dayBranch: input.dayBranch as never,
    branches: input.branches as never,
  });

  for (const check of matchChecks) {
    if (!check.found) continue;
    for (const pos of check.positions) {
      if (!result[pos].includes(check.name)) {
        result[pos].push(check.name);
      }
    }
  }

  return result;
}

export function mergeShenSha(existing: string[], computed: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const name of [...existing, ...computed]) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    merged.push(name);
  }
  return merged;
}

export function shenShaListToI18nKeys(hanList: string[]): string[] {
  return hanList.map(shenshaHanToI18nKey);
}
