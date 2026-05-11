import rules from "../data/directions-rules.json";
import type {
  Direction8,
  DirectionRating,
  DirectionRatingLevel,
  DirectionsOutput,
  FiveElement,
  YongShenOutput,
} from "../types";

const DIRECTIONS: Direction8[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/** 五行相生：a 生 b */
function generates(a: FiveElement, b: FiveElement): boolean {
  const map: Record<FiveElement, FiveElement> = {
    wood: "fire",
    fire: "earth",
    earth: "metal",
    metal: "water",
    water: "wood",
  };
  return map[a] === b;
}

/** 五行相克：a 克 b */
function controls(a: FiveElement, b: FiveElement): boolean {
  const map: Record<FiveElement, FiveElement> = {
    wood: "earth",
    earth: "water",
    water: "fire",
    fire: "metal",
    metal: "wood",
  };
  return map[a] === b;
}

function scoreToRating(score: number): DirectionRatingLevel {
  if (score >= 1.5) return "highly_favorable";
  if (score >= 0.5) return "supportive";
  if (score >= -0.5) return "neutral";
  if (score >= -1.5) return "challenging";
  return "oppressive";
}

function briefFor(dir: Direction8, rating: DirectionRatingLevel, hourEl: FiveElement): string {
  const base = rules.base_elements[dir] as FiveElement;
  const tone: Record<DirectionRatingLevel, string> = {
    highly_favorable: "Strong alignment for focus and clear next steps.",
    supportive: "Gentle support — steady progress without forcing.",
    neutral: "Balanced — neither pushing nor blocking; good for maintenance.",
    challenging: "Friction possible — slow down and simplify commitments.",
    oppressive: "Heavy or draining — avoid high-stakes moves facing this way.",
  };
  return `${tone[rating]} (this hour’s field leans ${hourEl}; base tone ${base}).`;
}

/** 由本地时间推算当前时辰地支（传统两小时划分，23–1 为子） */
export function getHourBranchFromDate(d: Date): keyof typeof rules.hour_elements {
  const h = d.getHours();
  const m = d.getMinutes();
  const minutes = h * 60 + m;
  const branches = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;
  // 子 23:00–00:59
  if (minutes >= 23 * 60 || minutes < 1 * 60) return "子";
  const idx = Math.floor((minutes - 60) / 120) + 1;
  return branches[Math.min(11, Math.max(1, idx))];
}

/** 下一个传统时辰整点边界（与 SyncroMobileFlow 一致的两小时步进） */
export function getNextShichenBoundary(d: Date): Date {
  const h = d.getHours();
  const nextHour = h % 2 === 0 ? h + 1 : h + 2;
  const next = new Date(d);
  next.setMinutes(0, 0, 0);
  next.setHours(nextHour, 0, 0, 0);
  return next;
}

function headingToDirection8(deg: number | undefined): Direction8 | null {
  if (deg == null || Number.isNaN(deg)) return null;
  const a = ((deg % 360) + 360) % 360;
  const idx = Math.round(a / 45) % 8;
  return DIRECTIONS[idx];
}

export interface DirectionsInput {
  yong_shen: YongShenOutput;
  current_time: string;
  device_orientation?: number;
}

/**
 * Syncro 浏览模式 · M6 方位评分（Batch2 §5.2 / Implementation §4.5）
 * 纯本机、无 LLM；用神来自上层（暂可由出生年占位推算）。
 */
export function calculateDirections(input: DirectionsInput): DirectionsOutput {
  const now = new Date(input.current_time);
  const branch = getHourBranchFromDate(now);
  const hourElement = rules.hour_elements[branch] as FiveElement;
  const period = rules.hour_periods[branch as keyof typeof rules.hour_periods] ?? "";

  const primary = input.yong_shen.primary_yong_shen;
  const ji0 = input.yong_shen.ji_shen[0] ?? ("earth" as FiveElement);

  const ratings = {} as Record<Direction8, DirectionRating>;

  for (const direction of DIRECTIONS) {
    const baseElement = rules.base_elements[direction] as FiveElement;
    let score = 0;

    if (baseElement === primary) score += 2;
    else if (generates(baseElement, primary)) score += 1.5;
    else if (generates(primary, baseElement)) score += 0;
    else if (baseElement === ji0) score -= 1.5;
    else if (generates(ji0, baseElement)) score -= 2;

    if (hourElement === baseElement) score *= 1.2;
    else if (generates(hourElement, baseElement)) score *= 1.1;
    else if (controls(hourElement, baseElement)) score *= 0.8;

    const rating = scoreToRating(score);
    ratings[direction] = {
      base_element: baseElement,
      combined_score: Math.round(score * 100) / 100,
      rating,
      brief_note: briefFor(direction, rating, hourElement),
    };
  }

  const facing = headingToDirection8(input.device_orientation);

  return {
    current_hour: {
      branch,
      element: hourElement,
      period,
    },
    ratings,
    current_facing: facing,
    validity: {
      valid_until: getNextShichenBoundary(now).toISOString(),
      is_current_zhi_shi: branch === "子",
    },
  };
}
