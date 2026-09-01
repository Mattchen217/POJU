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

/** 月支 → 当令五行（调候粗锚）。 */
const BRANCH_SEASON: Record<string, WuXing> = {
  寅: "木",
  卯: "木",
  辰: "土",
  巳: "火",
  午: "火",
  未: "土",
  申: "金",
  酉: "金",
  戌: "土",
  亥: "水",
  子: "水",
  丑: "土",
};

export type YongshenAnalysis = {
  status: string;
  status_strength: "strong" | "weak" | "balanced";
  elements: string[];
  elements_en: string[];
  elements_han: WuXing[];
  /** 忌神五行（相对用神/扶抑，确定性） */
  ji_elements_han: WuXing[];
  /** 调候：月令当令五行；无月支则为 null */
  season_element: WuXing | null;
  /** 是否因调候微调了用神候选 */
  tiaohou_adjusted: boolean;
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

function pickStrongest(candidates: WuXing[], scores: WuXingScores, n = 2): WuXing[] {
  const sorted = [...candidates].sort(
    (a, b) => (scores[b]?.分值 ?? 0) - (scores[a]?.分值 ?? 0),
  );
  return sorted.slice(0, n);
}

function pickSupportive(dm: WuXing, resource: WuXing, scores: WuXingScores): WuXing[] {
  const candidates = dm === resource ? [dm] : [dm, resource];
  const sorted = [...candidates].sort((a, b) => (scores[a]?.分值 ?? 0) - (scores[b]?.分值 ?? 0));
  return sorted.slice(0, 2);
}

function monthBranchFromChart(chart: GetBaziChartOutput): string | null {
  const raw =
    chart.八字?.柱位详细?.月柱?.地支 ??
    (typeof chart.八字?.四柱 === "string"
      ? chart.八字.四柱.split(/\s+/)[1]?.charAt(1)
      : null);
  const b = String(raw ?? "").trim().charAt(0);
  return b && BRANCH_SEASON[b] ? b : null;
}

/**
 * 调候粗调：月令极寒/极燥时，把「暖/润」侧轻轻抬进用神候选（不推翻扶抑主轴）。
 */
function applyTiaohouBoost(
  dm: WuXing,
  season: WuXing | null,
  chosen: WuXing[],
  scores: WuXingScores,
): { chosen: WuXing[]; adjusted: boolean } {
  if (!season) return { chosen, adjusted: false };
  // 冬水旺 → 喜火暖；夏火旺 → 喜水润（对日主而言）
  let boost: WuXing | null = null;
  if (season === "水" && (dm === "火" || dm === "土")) boost = "火";
  if (season === "火" && (dm === "水" || dm === "金")) boost = "水";
  if (season === "金" && dm === "木") boost = "水"; // 金令木弱，稍补水
  if (season === "木" && dm === "土") boost = "火"; // 木令土虚，稍补火
  if (!boost || chosen.includes(boost)) return { chosen, adjusted: false };
  // 仅当 boost 分值不是垫底时才插入，避免硬塞无关行
  if (scorePct(scores, boost) <= 0 && (scores[boost]?.分值 ?? 0) <= 0) {
    return { chosen, adjusted: false };
  }
  return { chosen: [boost, ...chosen].slice(0, 2), adjusted: true };
}

function resolveJi(
  dm: WuXing,
  status: ProfileStrength,
  yong: WuXing[],
  scores: WuXingScores,
): WuXing[] {
  const yongSet = new Set(yong);
  // 身弱：官杀/过旺耗泄易成忌；身旺：印比过壅易成忌；均衡：取与用神对冲最强者
  let pool: WuXing[];
  if (status === "weak") {
    pool = [OFFICER_OF[dm], WEALTH_OF[dm], OUTPUT_OF[dm]];
  } else if (status === "strong") {
    pool = [RESOURCE_OF[dm], dm];
  } else {
    pool = [OFFICER_OF[dm], WEALTH_OF[dm], RESOURCE_OF[dm]];
  }
  const filtered = pool.filter((e) => !yongSet.has(e));
  const picked = pickStrongest(filtered.length ? filtered : pool, scores, 2);
  return picked.filter((e) => !yongSet.has(e)).slice(0, 2);
}

/**
 * Quantitative 喜用神 heuristic from 五行分值 + 月令调候粗调。
 * Strong (身旺): DM + Resource > 45% → favor output / wealth / officer (weakest first).
 * Weak (身弱): else → favor self / resource.
 */
export function computeYongshenAnalysis(chart: GetBaziChartOutput): YongshenAnalysis {
  const scores = chart.八字?.五行分值 as WuXingScores | undefined;
  const dmElement = scores?.日主五行 as WuXing | undefined;
  const monthBranch = monthBranchFromChart(chart);
  const season_element = monthBranch ? BRANCH_SEASON[monthBranch]! : null;

  if (!scores || !dmElement) {
    return {
      status: "bazi.strength.balanced",
      status_strength: "balanced",
      elements: [],
      elements_en: [],
      elements_han: [],
      ji_elements_han: [],
      season_element,
      tiaohou_adjusted: false,
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

  const tiao = applyTiaohouBoost(dmElement, season_element, chosen, scores);
  chosen = tiao.chosen;

  const ji = resolveJi(dmElement, statusStrength, chosen, scores);

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
    ji_elements_han: ji,
    season_element,
    tiaohou_adjusted: tiao.adjusted,
  };
}

export function yongshenToDiagnosisElements(analysis: YongshenAnalysis): {
  favorableElements: string[];
  challengingElements: string[];
} {
  const favorable = analysis.elements_en.map((e) => e.toLowerCase());
  if (analysis.ji_elements_han.length > 0) {
    return {
      favorableElements: favorable,
      challengingElements: analysis.ji_elements_han.map((e) => WUXING_TO_EN[e].toLowerCase()),
    };
  }
  const allEn = Object.values(WUXING_TO_EN).map((e) => e.toLowerCase());
  const challenging = allEn.filter((e) => !favorable.includes(e));
  return { favorableElements: favorable, challengingElements: challenging.slice(0, 2) };
}
