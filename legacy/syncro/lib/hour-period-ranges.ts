import type { HourPeriod } from "./types";

/** Display ranges for the 12 two-hour periods (local clock). */
export const HOUR_PERIOD_RANGES: Record<HourPeriod, string> = {
  zi: "23:00–01:00",
  chou: "01:00–03:00",
  yin: "03:00–05:00",
  mao: "05:00–07:00",
  chen: "07:00–09:00",
  si: "09:00–11:00",
  wu: "11:00–13:00",
  wei: "13:00–15:00",
  shen: "15:00–17:00",
  you: "17:00–19:00",
  xu: "19:00–21:00",
  hai: "21:00–23:00",
};

export function hourPeriodDisplayName(period: HourPeriod, locale: string): string {
  const isZh = locale.startsWith("zh");
  if (isZh) {
    const map: Record<HourPeriod, string> = {
      zi: "子",
      chou: "丑",
      yin: "寅",
      mao: "卯",
      chen: "辰",
      si: "巳",
      wu: "午",
      wei: "未",
      shen: "申",
      you: "酉",
      xu: "戌",
      hai: "亥",
    };
    return map[period];
  }
  const en: Record<HourPeriod, string> = {
    zi: "Zi",
    chou: "Chou",
    yin: "Yin",
    mao: "Mao",
    chen: "Chen",
    si: "Si",
    wu: "Wu",
    wei: "Wei",
    shen: "Shen",
    you: "You",
    xu: "Xu",
    hai: "Hai",
  };
  return en[period];
}
