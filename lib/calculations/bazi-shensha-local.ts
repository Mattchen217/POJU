/**
 * Local 神煞 computation — merges with shunshi chart 神煞 arrays.
 * Reuses match-engine tables; maps to i18n keys for UI.
 * Block 62: expanded deterministic lookup (9 → 24).
 */

import { getLifeStage } from "@/lib/calculations/chang-sheng";
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
  将星: "bazi.shensha.jiang_xing",
  劫煞: "bazi.shensha.jie_sha",
  亡神: "bazi.shensha.wang_shen",
  灾煞: "bazi.shensha.zai_sha",
  国印: "bazi.shensha.guo_yin",
  金舆: "bazi.shensha.jin_yu",
  天德: "bazi.shensha.tian_de",
  月德: "bazi.shensha.yue_de",
  福星贵人: "bazi.shensha.fu_xing_gui_ren",
  太极贵人: "bazi.shensha.tai_ji_gui_ren",
  天医: "bazi.shensha.tian_yi_star",
  学堂: "bazi.shensha.xue_tang",
  词馆: "bazi.shensha.ci_guan",
  红鸾: "bazi.shensha.hong_luan",
  天喜: "bazi.shensha.tian_xi",
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

/** 国印 — day stem → branch */
const GUO_YIN: Record<string, string> = {
  甲: "戌",
  乙: "亥",
  丙: "丑",
  丁: "寅",
  戊: "丑",
  己: "寅",
  庚: "辰",
  辛: "巳",
  壬: "未",
  癸: "申",
};

/** 金舆 — day stem → branch */
const JIN_YU: Record<string, string> = {
  甲: "辰",
  乙: "巳",
  丙: "未",
  丁: "申",
  戊: "未",
  己: "申",
  庚: "戌",
  辛: "亥",
  壬: "丑",
  癸: "寅",
};

/** 红鸾 — year branch → branch */
const HONG_LUAN: Record<string, string> = {
  子: "卯",
  丑: "寅",
  寅: "丑",
  卯: "子",
  辰: "亥",
  巳: "戌",
  午: "酉",
  未: "申",
  申: "未",
  酉: "午",
  戌: "巳",
  亥: "辰",
};

/** 天喜 — 红鸾对冲 */
const TIAN_XI: Record<string, string> = {
  子: "酉",
  丑: "申",
  寅: "未",
  卯: "午",
  辰: "巳",
  巳: "辰",
  午: "卯",
  未: "寅",
  申: "丑",
  酉: "子",
  戌: "亥",
  亥: "戌",
};

/** 福星贵人 — day stem → branch */
const FU_XING: Record<string, string> = {
  甲: "寅",
  乙: "丑",
  丙: "寅",
  丁: "亥",
  戊: "申",
  己: "未",
  庚: "午",
  辛: "巳",
  壬: "辰",
  癸: "丑",
};

/** 太极贵人 — stem → branches */
const TAI_JI: Record<string, string[]> = {
  甲: ["子", "午"],
  乙: ["子", "午"],
  丙: ["卯", "酉"],
  丁: ["卯", "酉"],
  戊: ["辰", "戌", "丑", "未"],
  己: ["辰", "戌", "丑", "未"],
  庚: ["寅", "亥"],
  辛: ["寅", "亥"],
  壬: ["巳", "申"],
  癸: ["巳", "申"],
};

/** 天德 — month branch → stem */
const TIAN_DE: Record<string, string> = {
  寅: "丁",
  卯: "申",
  辰: "壬",
  巳: "辛",
  午: "亥",
  未: "甲",
  申: "癸",
  酉: "寅",
  戌: "丙",
  亥: "乙",
  子: "巳",
  丑: "庚",
};

/** 月德 — month branch group → stem */
const YUE_DE: Record<string, string> = {
  寅: "丙",
  午: "丙",
  戌: "丙",
  申: "壬",
  子: "壬",
  辰: "壬",
  亥: "甲",
  卯: "甲",
  未: "甲",
  巳: "庚",
  酉: "庚",
  丑: "庚",
};

/** 天医 — month branch → branch */
const TIAN_YI_STAR: Record<string, string> = {
  寅: "丑",
  卯: "寅",
  辰: "卯",
  巳: "辰",
  午: "巳",
  未: "午",
  申: "未",
  酉: "申",
  戌: "酉",
  亥: "戌",
  子: "亥",
  丑: "子",
};

type SanheGroup = "fire" | "water" | "wood" | "metal";

function sanheGroup(branch: string): SanheGroup | null {
  if ("寅午戌".includes(branch)) return "fire";
  if ("申子辰".includes(branch)) return "water";
  if ("亥卯未".includes(branch)) return "wood";
  if ("巳酉丑".includes(branch)) return "metal";
  return null;
}

const SANHE_JIANG: Record<SanheGroup, string> = { fire: "午", water: "子", wood: "卯", metal: "酉" };
const SANHE_JIESHA: Record<SanheGroup, string> = { fire: "亥", water: "巳", wood: "申", metal: "寅" };
const SANHE_WANG: Record<SanheGroup, string> = { fire: "巳", water: "亥", wood: "寅", metal: "申" };
const SANHE_ZAI: Record<SanheGroup, string> = { fire: "子", water: "午", wood: "酉", metal: "卯" };

export type PillarKey = "year" | "month" | "day" | "hour";

export function shenshaHanToI18nKey(han: string): string {
  return SHENSHA_I18N_KEY[han] ?? `bazi.shensha.${han}`;
}

function pushBranchMatch(
  result: Record<PillarKey, string[]>,
  branches: Record<PillarKey, string>,
  targetBranch: string,
  name: string,
): void {
  const positions: PillarKey[] = ["year", "month", "day", "hour"];
  for (const p of positions) {
    if (branches[p] === targetBranch && !result[p].includes(name)) {
      result[p].push(name);
    }
  }
}

function pushStemMatch(
  result: Record<PillarKey, string[]>,
  stems: Record<PillarKey, string>,
  targetStem: string,
  name: string,
): void {
  const positions: PillarKey[] = ["year", "month", "day", "hour"];
  for (const p of positions) {
    if (stems[p] === targetStem && !result[p].includes(name)) {
      result[p].push(name);
    }
  }
}

function addSanheShenSha(
  result: Record<PillarKey, string[]>,
  yearBranch: string,
  branches: Record<PillarKey, string>,
): void {
  const g = sanheGroup(yearBranch);
  if (!g) return;
  pushBranchMatch(result, branches, SANHE_JIANG[g], "将星");
  pushBranchMatch(result, branches, SANHE_JIESHA[g], "劫煞");
  pushBranchMatch(result, branches, SANHE_WANG[g], "亡神");
  pushBranchMatch(result, branches, SANHE_ZAI[g], "灾煞");
}

function addStemBranchShenSha(
  result: Record<PillarKey, string[]>,
  dayMasterStem: string,
  branches: Record<PillarKey, string>,
  stems: Record<PillarKey, string>,
  monthBranch: string,
  yearBranch: string,
): void {
  const guo = GUO_YIN[dayMasterStem];
  if (guo) pushBranchMatch(result, branches, guo, "国印");

  const jin = JIN_YU[dayMasterStem];
  if (jin) pushBranchMatch(result, branches, jin, "金舆");

  const fu = FU_XING[dayMasterStem];
  if (fu) pushBranchMatch(result, branches, fu, "福星贵人");

  for (const b of TAI_JI[dayMasterStem] ?? []) {
    pushBranchMatch(result, branches, b, "太极贵人");
  }

  const hong = HONG_LUAN[yearBranch];
  if (hong) pushBranchMatch(result, branches, hong, "红鸾");

  const xi = TIAN_XI[yearBranch];
  if (xi) pushBranchMatch(result, branches, xi, "天喜");

  const tianDeStem = TIAN_DE[monthBranch];
  if (tianDeStem) pushStemMatch(result, stems, tianDeStem, "天德");

  const yueDeStem = YUE_DE[monthBranch];
  if (yueDeStem) pushStemMatch(result, stems, yueDeStem, "月德");

  const tianYiBranch = TIAN_YI_STAR[monthBranch];
  if (tianYiBranch) pushBranchMatch(result, branches, tianYiBranch, "天医");

  const positions: PillarKey[] = ["year", "month", "day", "hour"];
  for (const p of positions) {
    const stage = getLifeStage(dayMasterStem, branches[p]);
    if (stage === "长生" && !result[p].includes("学堂")) result[p].push("学堂");
    if (stage === "临官" && !result[p].includes("词馆")) result[p].push("词馆");
  }
}

export function computeLocalShenShaForPillars(input: {
  dayMasterStem: string;
  branches: Record<PillarKey, string>;
  stems: Record<PillarKey, string>;
  yearBranch: string;
  dayBranch: string;
  monthBranch: string;
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

  addSanheShenSha(result, input.yearBranch, input.branches);
  addStemBranchShenSha(
    result,
    input.dayMasterStem,
    input.branches,
    input.stems,
    input.monthBranch,
    input.yearBranch,
  );

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
