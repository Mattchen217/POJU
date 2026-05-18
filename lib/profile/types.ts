// ---------------------------------------------------------------------------
// POJU v5.0 — Birth info + profile types (Step B)
// ---------------------------------------------------------------------------

export type HourPeriod =
  | "zi_early"
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

export const HOUR_PERIOD_INFO: Record<
  HourPeriod,
  {
    range_start: number;
    range_end: number;
    chinese_name: string;
    zh_label: string;
    en_label: string;
    representative_hour: number;
  }
> = {
  zi_early: {
    range_start: 23,
    range_end: 1,
    chinese_name: "早子时",
    zh_label: "23:00 - 01:00 (子时)",
    en_label: "11 PM - 1 AM (Zi)",
    representative_hour: 0,
  },
  chou: {
    range_start: 1,
    range_end: 3,
    chinese_name: "丑时",
    zh_label: "01:00 - 03:00 (丑时)",
    en_label: "1 AM - 3 AM (Chou)",
    representative_hour: 2,
  },
  yin: {
    range_start: 3,
    range_end: 5,
    chinese_name: "寅时",
    zh_label: "03:00 - 05:00 (寅时)",
    en_label: "3 AM - 5 AM (Yin)",
    representative_hour: 4,
  },
  mao: {
    range_start: 5,
    range_end: 7,
    chinese_name: "卯时",
    zh_label: "05:00 - 07:00 (卯时)",
    en_label: "5 AM - 7 AM (Mao)",
    representative_hour: 6,
  },
  chen: {
    range_start: 7,
    range_end: 9,
    chinese_name: "辰时",
    zh_label: "07:00 - 09:00 (辰时)",
    en_label: "7 AM - 9 AM (Chen)",
    representative_hour: 8,
  },
  si: {
    range_start: 9,
    range_end: 11,
    chinese_name: "巳时",
    zh_label: "09:00 - 11:00 (巳时)",
    en_label: "9 AM - 11 AM (Si)",
    representative_hour: 10,
  },
  wu: {
    range_start: 11,
    range_end: 13,
    chinese_name: "午时",
    zh_label: "11:00 - 13:00 (午时)",
    en_label: "11 AM - 1 PM (Wu)",
    representative_hour: 12,
  },
  wei: {
    range_start: 13,
    range_end: 15,
    chinese_name: "未时",
    zh_label: "13:00 - 15:00 (未时)",
    en_label: "1 PM - 3 PM (Wei)",
    representative_hour: 14,
  },
  shen: {
    range_start: 15,
    range_end: 17,
    chinese_name: "申时",
    zh_label: "15:00 - 17:00 (申时)",
    en_label: "3 PM - 5 PM (Shen)",
    representative_hour: 16,
  },
  you: {
    range_start: 17,
    range_end: 19,
    chinese_name: "酉时",
    zh_label: "17:00 - 19:00 (酉时)",
    en_label: "5 PM - 7 PM (You)",
    representative_hour: 18,
  },
  xu: {
    range_start: 19,
    range_end: 21,
    chinese_name: "戌时",
    zh_label: "19:00 - 21:00 (戌时)",
    en_label: "7 PM - 9 PM (Xu)",
    representative_hour: 20,
  },
  hai: {
    range_start: 21,
    range_end: 23,
    chinese_name: "亥时",
    zh_label: "21:00 - 23:00 (亥时)",
    en_label: "9 PM - 11 PM (Hai)",
    representative_hour: 22,
  },
};

/** v5 birth payload (device-only; no lat/lng). */
export interface BirthInfo {
  year: number;
  month: number;
  day: number;
  hour_period: HourPeriod;
  gender: "M" | "F";
  timezone: string;
}

/** Legacy chat form / API body until Step C picker ships. */
export type LegacyBirthGender = "male" | "female" | "other";

export interface LegacyBirthFormInput {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute?: number;
  gender: LegacyBirthGender;
  city?: string;
  latitude?: number;
  longitude?: number;
  hour_period?: HourPeriod;
  timezone?: string;
}

export interface UserProfile {
  id: string;
  birth: BirthInfo;
  bazi: {
    yearPillar: string;
    monthPillar: string;
    dayPillar: string;
    hourPillar: string;
  };
  diagnosis: {
    dayMaster: string;
    favorableElements: string[];
    challengingElements: string[];
    patternSummary: string;
  };
  createdAt: number;
  updatedAt: number;
  source: "shunshi" | "fallback";
}

export interface DeepSeekAnalysis {
  命主基础?: unknown;
  性格画像?: unknown;
  人生主题?: unknown;
  大运全程?: unknown;
  当前大运详解?: unknown;
  传统调候建议?: unknown;
  深度洞察?: string[];
  _meta: {
    generated_at: string;
    model: string;
    tokens_used: number;
  };
}
