/**
 * Syncro v5 session types + 12 hour-period helpers.
 * @see docs/Syncro_v5.0_Refactor.md Step 4
 */

import type { CurrentLevel, DirectionId } from "./current-system";

export type HourPeriod =
  | "zi"
  | "chou"
  | "yin"
  | "mao"
  | "chen"
  | "si"
  | "wu"
  | "wei"
  | "shen"
  | "you"
  | "xu"
  | "hai";

export interface SyncroCombination {
  hour_period: HourPeriod;
  direction_id: DirectionId;
  hour_start_iso: string;
  hour_end_iso: string;
  current_level: CurrentLevel;
  short_advice: string;
  detailed_advice: string;
  rationale: string;
  /** True while background LLM batches have not updated this cell yet. */
  llm_pending?: boolean;
  /** Set when the hour's LLM batch failed (keeps fallback copy). */
  llm_failed?: boolean;
}

export type SyncroMatrix = {
  [key: string]: SyncroCombination;
};

export interface SyncroSession {
  session_id: string;
  device_id: string;
  profile_id: string;
  task_description: string;
  user_location: {
    latitude: number;
    longitude: number;
    timezone: string;
  };
  created_at: Date;
  expires_at: Date;
  matrix: SyncroMatrix;
  locale: string;
  is_free: boolean;
  cost_usd: number;
  llm_meta: {
    model: string;
    tokens_used: number;
    latency_ms: number;
  };
}

/** JSON stored in encrypted blob (dates as ISO strings). */
export type SyncroSessionPayload = Omit<SyncroSession, "created_at" | "expires_at"> & {
  created_at: string;
  expires_at: string;
};

export interface HourPeriodInfo {
  id: HourPeriod;
  name_zh: string;
  name_en: string;
  start_hour: number;
  end_hour: number;
}

export const HOUR_PERIODS: Record<HourPeriod, HourPeriodInfo> = {
  zi: { id: "zi", name_zh: "子时", name_en: "Zi", start_hour: 23, end_hour: 1 },
  chou: { id: "chou", name_zh: "丑时", name_en: "Chou", start_hour: 1, end_hour: 3 },
  yin: { id: "yin", name_zh: "寅时", name_en: "Yin", start_hour: 3, end_hour: 5 },
  mao: { id: "mao", name_zh: "卯时", name_en: "Mao", start_hour: 5, end_hour: 7 },
  chen: { id: "chen", name_zh: "辰时", name_en: "Chen", start_hour: 7, end_hour: 9 },
  si: { id: "si", name_zh: "巳时", name_en: "Si", start_hour: 9, end_hour: 11 },
  wu: { id: "wu", name_zh: "午时", name_en: "Wu", start_hour: 11, end_hour: 13 },
  wei: { id: "wei", name_zh: "未时", name_en: "Wei", start_hour: 13, end_hour: 15 },
  shen: { id: "shen", name_zh: "申时", name_en: "Shen", start_hour: 15, end_hour: 17 },
  you: { id: "you", name_zh: "酉时", name_en: "You", start_hour: 17, end_hour: 19 },
  xu: { id: "xu", name_zh: "戌时", name_en: "Xu", start_hour: 19, end_hour: 21 },
  hai: { id: "hai", name_zh: "亥时", name_en: "Hai", start_hour: 21, end_hour: 23 },
};

export function getCurrentHourPeriod(date: Date = new Date()): HourPeriod {
  const hour = date.getHours();

  if (hour >= 23 || hour < 1) return "zi";
  if (hour < 3) return "chou";
  if (hour < 5) return "yin";
  if (hour < 7) return "mao";
  if (hour < 9) return "chen";
  if (hour < 11) return "si";
  if (hour < 13) return "wu";
  if (hour < 15) return "wei";
  if (hour < 17) return "shen";
  if (hour < 19) return "you";
  if (hour < 21) return "xu";
  return "hai";
}

/** Seconds until the current 2-hour hour-period boundary (local time). */
export function secondsToNextHourPeriod(date: Date = new Date()): number {
  const now = date.getTime();
  const hour = date.getHours();

  let endHour: number;
  if (hour >= 23 || hour < 1) endHour = 1;
  else if (hour < 3) endHour = 3;
  else if (hour < 5) endHour = 5;
  else if (hour < 7) endHour = 7;
  else if (hour < 9) endHour = 9;
  else if (hour < 11) endHour = 11;
  else if (hour < 13) endHour = 13;
  else if (hour < 15) endHour = 15;
  else if (hour < 17) endHour = 17;
  else if (hour < 19) endHour = 19;
  else if (hour < 21) endHour = 21;
  else endHour = 23;

  const targetDate = new Date(date);
  if (endHour <= hour) {
    targetDate.setDate(targetDate.getDate() + 1);
  }
  targetDate.setHours(endHour, 0, 0, 0);

  return Math.max(0, Math.floor((targetDate.getTime() - now) / 1000));
}

export function matrixKey(hourPeriod: HourPeriod, directionId: DirectionId): string {
  return `${hourPeriod}__${directionId}`;
}
