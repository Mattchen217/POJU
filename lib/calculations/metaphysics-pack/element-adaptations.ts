import adaptations from "@/lib/calculations/data/element-adaptations.json";
import rules from "@/lib/calculations/data/directions-rules.json";
import type { FiveElement } from "@/lib/calculations/types";
import type { WuXing } from "@/lib/syncro/wuxing-utils";

import { fiveElementToWuXing, toFiveElement, wuXingToFiveElement } from "./element-token";

export type ElementColorAnchor = {
  element: FiveElement;
  labels_en: string[];
  labels_zh: string[];
  hex_hints: string[];
  /** Compliance: visual energy anchor — not 吉利色 */
  usage: "visual_energy_anchor";
};

export type ElementCareerDirection = {
  element: FiveElement;
  themes_en: string[];
  themes_zh: string[];
  /** Compliance: domain affinity — not job titles / 职业定性 */
  framing: "domain_affinity_not_job_title";
};

export type FavorableHourSlot = {
  branch: string;
  element: FiveElement;
  period: string;
  /** high = matches primary 用神; soft = matches 喜神 */
  match: "primary" | "xi";
};

export type ElementScoreMap = Record<FiveElement, number>;

export type DashboardCapacities = {
  /** 输出力 — day-master element normalized 0–100 (real score only) */
  output_capacity: number;
  /** 续航力 — primary 用神 element normalized 0–100 */
  sustain_capacity: number;
  /** 阻力 — primary 忌神 element normalized 0–100 */
  resistance_load: number;
};

const WU_XING_KEYS = ["金", "木", "水", "火", "土"] as const;

export type WuXingScoreRaw = Partial<
  Record<(typeof WU_XING_KEYS)[number], { 分值: number; 占比?: string }>
> & { 日主五行?: string };

type ColorRow = (typeof adaptations.color_anchors)[keyof typeof adaptations.color_anchors];
type CareerRow = (typeof adaptations.career_directions)[keyof typeof adaptations.career_directions];

function asFiveKey(el: FiveElement): keyof typeof adaptations.color_anchors {
  return el;
}

export function colorAnchorForElement(element: FiveElement): ElementColorAnchor {
  const row = adaptations.color_anchors[asFiveKey(element)] as ColorRow;
  return {
    element,
    labels_en: [...row.labels_en],
    labels_zh: [...row.labels_zh],
    hex_hints: [...row.hex_hints],
    usage: "visual_energy_anchor",
  };
}

export function careerDirectionForElement(element: FiveElement): ElementCareerDirection {
  const row = adaptations.career_directions[asFiveKey(element)] as CareerRow;
  return {
    element,
    themes_en: [...row.themes_en],
    themes_zh: [...row.themes_zh],
    framing: "domain_affinity_not_job_title",
  };
}

/**
 * Match 时辰 whose hour_elements equal 用神 (primary) or 喜神 (soft).
 * Output = 精力高频时段 — not 吉时.
 */
export function favorableHours(params: {
  primary_yong_shen: FiveElement;
  xi_shen?: FiveElement[];
}): FavorableHourSlot[] {
  const xiSet = new Set((params.xi_shen ?? []).filter((e) => e !== params.primary_yong_shen));
  const out: FavorableHourSlot[] = [];

  for (const [branch, elRaw] of Object.entries(rules.hour_elements)) {
    const el = elRaw as FiveElement;
    const period = rules.hour_periods[branch as keyof typeof rules.hour_periods] ?? "";
    if (el === params.primary_yong_shen) {
      out.push({ branch, element: el, period, match: "primary" });
    } else if (xiSet.has(el)) {
      out.push({ branch, element: el, period, match: "xi" });
    }
  }

  const branchOrder = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
  out.sort((a, b) => {
    if (a.match !== b.match) return a.match === "primary" ? -1 : 1;
    return branchOrder.indexOf(a.branch) - branchOrder.indexOf(b.branch);
  });
  return out;
}

/**
 * Normalize 五行分值 → each element 0–100 share of total.
 * Never invent scores when raw is missing — returns zeros + source flag.
 */
export function normalizeElementScores(raw: WuXingScoreRaw | null | undefined): {
  scores: ElementScoreMap;
  source: "chart" | "empty";
  total_raw: number;
} {
  const empty: ElementScoreMap = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  if (!raw) return { scores: empty, source: "empty", total_raw: 0 };

  const rawByFive: ElementScoreMap = { ...empty };
  let total = 0;
  for (const k of WU_XING_KEYS) {
    const n = raw[k]?.分值;
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0) continue;
    const five = wuXingToFiveElement(k as WuXing);
    rawByFive[five] = n;
    total += n;
  }

  if (total <= 0) return { scores: empty, source: "empty", total_raw: 0 };

  const scores: ElementScoreMap = {
    wood: Math.round((rawByFive.wood / total) * 100),
    fire: Math.round((rawByFive.fire / total) * 100),
    earth: Math.round((rawByFive.earth / total) * 100),
    metal: Math.round((rawByFive.metal / total) * 100),
    water: Math.round((rawByFive.water / total) * 100),
  };
  return { scores, source: "chart", total_raw: total };
}

export function dashboardCapacitiesFromScores(params: {
  scores: ElementScoreMap;
  day_master_element: FiveElement | null;
  primary_yong_shen: FiveElement;
  primary_ji_shen: FiveElement;
}): DashboardCapacities {
  const { scores, day_master_element, primary_yong_shen, primary_ji_shen } = params;
  return {
    output_capacity: day_master_element ? scores[day_master_element] : 0,
    sustain_capacity: scores[primary_yong_shen],
    resistance_load: scores[primary_ji_shen],
  };
}

export function resolveDayMasterElement(token: string | null | undefined): FiveElement | null {
  return toFiveElement(token);
}

export function elementLabelHan(el: FiveElement): string {
  return fiveElementToWuXing(el);
}
