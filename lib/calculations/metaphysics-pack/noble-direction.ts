import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import type { Direction8, FiveElement } from "@/lib/calculations/types";
import { TIAN_YI_GUI_REN } from "@/lib/match/data/shensha";
import type { EarthlyBranch, HeavenlyStem } from "@/lib/match/data/stems-branches";
import adaptations from "@/lib/calculations/data/element-adaptations.json";
import { BRANCH_TO_WUXING } from "@/lib/syncro/wuxing-utils";

import { wuXingToFiveElement } from "./element-token";

/** Classic 地支 → 8 方位 primary (docs BRANCH_TO_COMPASS_MAP). */
const BRANCH_TO_DIRECTION8: Record<string, Direction8> = {
  子: "N",
  丑: "NE",
  寅: "NE",
  卯: "E",
  辰: "SE",
  巳: "SE",
  午: "S",
  未: "SW",
  申: "SW",
  酉: "W",
  戌: "NW",
  亥: "NW",
};

const PILLAR_KEYS = ["year", "month", "day", "hour"] as const;

export type NoblePersonSlot = {
  /** 地支 — fact only; never map to 生肖 */
  branch: string;
  direction: Direction8;
  element: FiveElement;
  /** Pillars where 天乙贵人 appears; empty if only theoretical from day master */
  pillar_keys: Array<(typeof PILLAR_KEYS)[number]>;
  traits_en: string[];
  traits_zh: string[];
  /** Compliance: complementary collaborator — not 贵人运 / 属X */
  framing: "complementary_collaborator";
};

export type NobleDirectionResult = {
  shen_sha: "天乙贵人";
  day_master_stem: string | null;
  /** Theoretical branches from day-master table */
  theoretical_branches: string[];
  /** Instances found on pillars (preferred for delivery) */
  instances: NoblePersonSlot[];
  /** Fallback slots from theoretical branches when no pillar instance */
  theoretical_slots: NoblePersonSlot[];
};

function isHeavenlyStem(s: string): s is HeavenlyStem {
  return s in TIAN_YI_GUI_REN;
}

function isEarthlyBranch(s: string): s is EarthlyBranch {
  return s in BRANCH_TO_DIRECTION8;
}

function traitsForElement(el: FiveElement): { traits_en: string[]; traits_zh: string[] } {
  const row = adaptations.noble_traits_by_element[el];
  return {
    traits_en: [...row.traits_en],
    traits_zh: [...row.traits_zh],
  };
}

function slotForBranch(
  branch: string,
  pillar_keys: Array<(typeof PILLAR_KEYS)[number]>,
): NoblePersonSlot | null {
  if (!isEarthlyBranch(branch)) return null;
  const direction = BRANCH_TO_DIRECTION8[branch];
  const wx = BRANCH_TO_WUXING[branch];
  if (!direction || !wx) return null;
  const element = wuXingToFiveElement(wx);
  const traits = traitsForElement(element);
  return {
    branch,
    direction,
    element,
    pillar_keys,
    traits_en: traits.traits_en,
    traits_zh: traits.traits_zh,
    framing: "complementary_collaborator",
  };
}

/**
 * 天乙贵人 → 方位 + 互补特质。
 * 去掉生肖层；只用地支 → Direction8 + 五行特质。
 */
export function nobleDirection(structured: ProfileStructured): NobleDirectionResult {
  const dayStem =
    structured.pillars_detail?.day.stem ??
    (structured.day_master?.length ? structured.day_master.charAt(0) : null);

  const theoretical_branches: string[] =
    dayStem && isHeavenlyStem(dayStem) ? [...TIAN_YI_GUI_REN[dayStem]] : [];

  const instanceMap = new Map<string, Array<(typeof PILLAR_KEYS)[number]>>();
  const detail = structured.pillars_detail;
  if (detail) {
    for (const key of PILLAR_KEYS) {
      const pillar = detail[key];
      if (!pillar?.shen_sha?.includes("天乙贵人")) continue;
      const branch = pillar.branch;
      if (!branch) continue;
      const prev = instanceMap.get(branch) ?? [];
      prev.push(key);
      instanceMap.set(branch, prev);
    }
  }

  const instances: NoblePersonSlot[] = [];
  for (const [branch, keys] of instanceMap) {
    const slot = slotForBranch(branch, keys);
    if (slot) instances.push(slot);
  }

  const theoretical_slots: NoblePersonSlot[] = [];
  for (const branch of theoretical_branches) {
    if (instanceMap.has(branch)) continue;
    const slot = slotForBranch(branch, []);
    if (slot) theoretical_slots.push(slot);
  }

  return {
    shen_sha: "天乙贵人",
    day_master_stem: dayStem,
    theoretical_branches,
    instances,
    theoretical_slots,
  };
}
