/**
 * Syncro v5 — Current 5 levels (replaces 吉凶 terminology) + 8 compass directions.
 * @see docs/Syncro_v5.0_Refactor.md Step 3
 */

export type CurrentLevel =
  | "open_current"
  | "following_current"
  | "stillwater"
  | "crosscurrent"
  | "undertow";

export interface CurrentLevelInfo {
  level: CurrentLevel;
  name_en: string;
  name_zh: string;
  color_hex: string;
  default_advice_en: string;
  default_advice_zh: string;
  /** 5 = best, 1 = worst */
  score: number;
}

export const CURRENT_LEVELS: Record<CurrentLevel, CurrentLevelInfo> = {
  open_current: {
    level: "open_current",
    name_en: "Open Current",
    name_zh: "顺势",
    color_hex: "#0D7377",
    default_advice_en: "Move with confidence — the current is fully with you.",
    default_advice_zh: "水势全顺,放胆而行。",
    score: 5,
  },
  following_current: {
    level: "following_current",
    name_en: "Following Current",
    name_zh: "应时",
    color_hex: "#26A69A",
    default_advice_en: "The current supports you, with effort.",
    default_advice_zh: "水势相助,稍加用力。",
    score: 4,
  },
  stillwater: {
    level: "stillwater",
    name_en: "Stillwater",
    name_zh: "守静",
    color_hex: "#90A4AE",
    default_advice_en: "The water is still. Pause and observe.",
    default_advice_zh: "水静无波,静观待时。",
    score: 3,
  },
  crosscurrent: {
    level: "crosscurrent",
    name_en: "Crosscurrent",
    name_zh: "横阻",
    color_hex: "#F57C00",
    default_advice_en: "Crosscurrent. Reconsider this direction or moment.",
    default_advice_zh: "逆水横流,慎择此时此位。",
    score: 2,
  },
  undertow: {
    level: "undertow",
    name_en: "Undertow",
    name_zh: "险滞",
    color_hex: "#C62828",
    default_advice_en: "Strong undertow. Hold back and choose another path.",
    default_advice_zh: "暗流险滞,且退守,另谋时位。",
    score: 1,
  },
};

export function getCurrentLevelInfo(level: CurrentLevel): CurrentLevelInfo {
  return CURRENT_LEVELS[level];
}

export type DirectionId = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

export interface DirectionInfo {
  id: DirectionId;
  name_en: string;
  name_zh: string;
  /** Compass center angle 0–360°, 0 = north */
  center_degree: number;
  bagua: string;
  bagua_meaning: string;
}

export const DIRECTIONS: Record<DirectionId, DirectionInfo> = {
  N: {
    id: "N",
    name_en: "North",
    name_zh: "正北",
    center_degree: 0,
    bagua: "坎",
    bagua_meaning: "水",
  },
  NE: {
    id: "NE",
    name_en: "Northeast",
    name_zh: "东北",
    center_degree: 45,
    bagua: "艮",
    bagua_meaning: "山",
  },
  E: {
    id: "E",
    name_en: "East",
    name_zh: "正东",
    center_degree: 90,
    bagua: "震",
    bagua_meaning: "雷",
  },
  SE: {
    id: "SE",
    name_en: "Southeast",
    name_zh: "东南",
    center_degree: 135,
    bagua: "巽",
    bagua_meaning: "风",
  },
  S: {
    id: "S",
    name_en: "South",
    name_zh: "正南",
    center_degree: 180,
    bagua: "离",
    bagua_meaning: "火",
  },
  SW: {
    id: "SW",
    name_en: "Southwest",
    name_zh: "西南",
    center_degree: 225,
    bagua: "坤",
    bagua_meaning: "地",
  },
  W: {
    id: "W",
    name_en: "West",
    name_zh: "正西",
    center_degree: 270,
    bagua: "兑",
    bagua_meaning: "泽",
  },
  NW: {
    id: "NW",
    name_en: "Northwest",
    name_zh: "西北",
    center_degree: 315,
    bagua: "乾",
    bagua_meaning: "天",
  },
};

const DIRECTION_IDS: DirectionId[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/**
 * Map compass heading (0–360°, 0 = north) to primary (and optional secondary) sector.
 * Smooth blend near sector boundaries.
 */
export function compassToDirection(degree: number): {
  primary: DirectionId;
  primary_weight: number;
  secondary?: DirectionId;
  secondary_weight?: number;
} {
  const normalized = ((degree % 360) + 360) % 360;

  const sectorIndex = Math.floor(((normalized + 22.5) % 360) / 45);
  const primary = DIRECTION_IDS[sectorIndex];
  const primaryCenter = sectorIndex * 45;

  let offset = normalized - primaryCenter;
  if (offset > 180) offset -= 360;
  if (offset < -180) offset += 360;

  const primary_weight = 1 - Math.abs(offset) / 45;

  let secondary: DirectionId | undefined;
  let secondary_weight: number | undefined;

  if (Math.abs(offset) > 11.25) {
    if (offset > 0) {
      const nextIdx = (sectorIndex + 1) % 8;
      secondary = DIRECTION_IDS[nextIdx];
      secondary_weight = 1 - primary_weight;
    } else {
      const prevIdx = (sectorIndex - 1 + 8) % 8;
      secondary = DIRECTION_IDS[prevIdx];
      secondary_weight = 1 - primary_weight;
    }
  }

  return {
    primary,
    primary_weight,
    secondary,
    secondary_weight,
  };
}
