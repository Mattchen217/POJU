import type { GetBaziChartOutput } from "shunshi-bazi-core";

import type { ProfileStrength } from "@/lib/calculations/build-profile-structured";

const WU_XING = ["金", "木", "水", "火", "土"] as const;
type WuXing = (typeof WU_XING)[number];

const WUXING_TO_ELEMENT_KEY: Record<WuXing, string> = {
  木: "bazi.element.wood",
  火: "bazi.element.fire",
  土: "bazi.element.earth",
  金: "bazi.element.metal",
  水: "bazi.element.water",
};

const WUXING_TO_EN: Record<WuXing, string> = {
  木: "Wood",
  火: "Fire",
  土: "Earth",
  金: "Metal",
  水: "Water",
};

/** Element that generates `target` (印 / resource). */
const RESOURCE_OF: Record<WuXing, WuXing> = {
  木: "水",
  火: "木",
  土: "火",
  金: "土",
  水: "金",
};

/** Element that `source` generates (食伤 / output). */
const OUTPUT_OF: Record<WuXing, WuXing> = {
  木: "火",
  火: "土",
  土: "金",
  金: "水",
  水: "木",
};

/** Element that `source` controls (财 / wealth). */
const WEALTH_OF: Record<WuXing, WuXing> = {
  木: "土",
  火: "金",
  土: "水",
  金: "木",
  水: "火",
};

/** Element that controls `target` (官杀 / officer). */
const OFFICER_OF: Record<WuXing, WuXing> = {
  木: "金",
  火: "水",
  土: "木",
  金: "火",
  水: "土",
};

export type YongshenAnalysis = {
  status: string;
  status_strength: "strong" | "weak" | "balanced";
  elements: string[];
  elements_en: string[];
  elements_han: WuXing[];
};

type WuXingScores = Partial<Record<WuXing, { 分值: number; 占比?: string }>> & {
  日主五行?: string;
};

function scorePct(scores: WuXingScores, element: WuXing): number {
  const total = WU_XING.reduce((sum, k) => sum + (scores[k]?.分值 ?? 0), 0);
  if (total <= 0) return 0;
  return ((scores[element]?.分值 ?? 0) / total) * 100;
}

function pickWeakest(candidates: WuXing[], scores: WuXingScores): WuXing[] {
  const nonZero = candidates.filter((e) => (scores[e]?.分值 ?? 0) > 0);
  const pool = nonZero.length > 0 ? nonZero : candidates;
  const sorted = [...pool].sort((a, b) => (scores[a]?.分值 ?? 0) - (scores[b]?.分值 ?? 0));
  return sorted.slice(0, 2);
}

function pickSupportive(dm: WuXing, resource: WuXing, scores: WuXingScores): WuXing[] {
  const candidates = dm === resource ? [dm] : [dm, resource];
  const sorted = [...candidates].sort((a, b) => (scores[a]?.分值 ?? 0) - (scores[b]?.分值 ?? 0));
  return sorted.slice(0, 2);
}

/**
 * Quantitative 喜用神 heuristic from 五行分值.
 * Strong (身旺): DM + Resource > 45% → favor output / wealth / officer (weakest first).
 * Weak (身弱): else → favor self / resource.
 */
export function computeYongshenAnalysis(chart: GetBaziChartOutput): YongshenAnalysis {
  const scores = chart.八字?.五行分值 as WuXingScores | undefined;
  const dmElement = scores?.日主五行 as WuXing | undefined;

  if (!scores || !dmElement) {
    return {
      status: "bazi.strength.balanced",
      status_strength: "balanced",
      elements: [],
      elements_en: [],
      elements_han: [],
    };
  }

  const resource = RESOURCE_OF[dmElement];
  const dmPct = scorePct(scores, dmElement);
  const resourcePct = scorePct(scores, resource);
  const isStrong = dmPct + resourcePct > 45;

  let chosen: WuXing[];
  let statusStrength: ProfileStrength;

  if (isStrong) {
    statusStrength = "strong";
    const draining = [OUTPUT_OF[dmElement], WEALTH_OF[dmElement], OFFICER_OF[dmElement]];
    chosen = pickWeakest(draining, scores);
  } else if (dmPct + resourcePct < 35) {
    statusStrength = "weak";
    chosen = pickSupportive(dmElement, resource, scores);
  } else {
    statusStrength = "balanced";
    const draining = [OUTPUT_OF[dmElement], WEALTH_OF[dmElement], OFFICER_OF[dmElement]];
    const supporting = pickSupportive(dmElement, resource, scores);
    chosen = dmPct >= 20 ? pickWeakest(draining, scores) : supporting;
  }

  const statusKey =
    statusStrength === "strong"
      ? "bazi.strength.strong"
      : statusStrength === "weak"
        ? "bazi.strength.weak"
        : "bazi.strength.balanced";

  return {
    status: statusKey,
    status_strength: statusStrength,
    elements: chosen.map((e) => WUXING_TO_ELEMENT_KEY[e]),
    elements_en: chosen.map((e) => WUXING_TO_EN[e]),
    elements_han: chosen,
  };
}

export function yongshenToDiagnosisElements(analysis: YongshenAnalysis): {
  favorableElements: string[];
  challengingElements: string[];
} {
  const favorable = analysis.elements_en.map((e) => e.toLowerCase());
  const allEn = Object.values(WUXING_TO_EN).map((e) => e.toLowerCase());
  const challenging = allEn.filter((e) => !favorable.includes(e));
  return { favorableElements: favorable, challengingElements: challenging.slice(0, 2) };
}
