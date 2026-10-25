import type { StoredProfileBirthInfo } from "@/lib/db/poju-db";
import { HOUR_PERIOD_INFO, type HourPeriod } from "@/lib/profile/types";

/** Compact Match A / Match B facts for clarification (no chart jargon). */
export type MatchPersonFacts = {
  label: "Match A" | "Match B";
  year: number;
  month: number;
  day: number;
  /** Clock-ish hour 0–23 when known; omit if unknown. */
  hour?: number;
  gender: "M" | "F" | "X";
};

function resolveHour(birth: StoredProfileBirthInfo): number | undefined {
  if (typeof birth.hour === "number" && Number.isFinite(birth.hour)) {
    return Math.max(0, Math.min(23, Math.floor(birth.hour)));
  }
  const period = birth.hour_period;
  if (period && HOUR_PERIOD_INFO[period as HourPeriod]) {
    return HOUR_PERIOD_INFO[period as HourPeriod].representative_hour;
  }
  return undefined;
}

export function matchPersonFactsFromBirth(
  label: "Match A" | "Match B",
  birth: StoredProfileBirthInfo | null | undefined,
): MatchPersonFacts | null {
  if (!birth || !Number.isFinite(birth.year) || !Number.isFinite(birth.month) || !Number.isFinite(birth.day)) {
    return null;
  }
  const gender = birth.gender === "F" ? "F" : birth.gender === "X" ? "X" : "M";
  return {
    label,
    year: birth.year,
    month: birth.month,
    day: birth.day,
    hour: resolveHour(birth),
    gender,
  };
}

function dayPartZh(hour: number): string {
  if (hour >= 5 && hour < 11) return "早上";
  if (hour >= 11 && hour < 14) return "中午";
  if (hour >= 14 && hour < 18) return "下午";
  if (hour >= 18 && hour < 23) return "晚上";
  return "夜里";
}

function dayPartEn(hour: number): string {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function genderZh(g: MatchPersonFacts["gender"]): string {
  if (g === "F") return "女";
  if (g === "X") return "未标明性别";
  return "男";
}

function genderEn(g: MatchPersonFacts["gender"]): string {
  if (g === "F") return "female";
  if (g === "X") return "gender not specified";
  return "male";
}

/** One-line fact sheet, e.g. Match A：1998年2月4日早上8点出生，男。 */
export function formatMatchPersonFactLine(person: MatchPersonFacts, locale: string): string {
  const zh = locale.split("-")[0]?.toLowerCase() === "zh";
  const h = person.hour;
  if (zh) {
    const time =
      h == null ? "出生" : `${dayPartZh(h)}${h}点左右出生`;
    return `${person.label}：${person.year}年${person.month}月${person.day}日${time}，${genderZh(person.gender)}。`;
  }
  const time =
    h == null ? "born" : `born around ${h}:00 in the ${dayPartEn(h)}`;
  return `${person.label}: ${time} ${person.year}-${String(person.month).padStart(2, "0")}-${String(person.day).padStart(2, "0")}, ${genderEn(person.gender)}.`;
}

export function formatMatchPersonsFactsBlock(
  persons: { a?: MatchPersonFacts | null; b?: MatchPersonFacts | null },
  locale: string,
): string {
  const lines: string[] = [];
  if (persons.a) lines.push(formatMatchPersonFactLine(persons.a, locale));
  if (persons.b) lines.push(formatMatchPersonFactLine(persons.b, locale));
  return lines.join("\n");
}
