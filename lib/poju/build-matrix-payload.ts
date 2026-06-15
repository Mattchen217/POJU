import { getBaziChart } from "shunshi-bazi-core";

import {
  buildProfileStructured,
  extractStrengthFromShunshiChart,
  type ProfileStructured,
} from "@/lib/calculations/build-profile-structured";
import { shunshiParamsFromBirthInfo } from "@/lib/profile/birth-info-utils";
import type { UserProfile } from "@/lib/profile/types";

const WU_XING_KEYS = ["金", "木", "水", "火", "土"] as const;
const ELEMENT_EN: Record<(typeof WU_XING_KEYS)[number], string> = {
  木: "Wood",
  火: "Fire",
  土: "Earth",
  金: "Metal",
  水: "Water",
};

export type PojuMatrixPayload = {
  profile_id: string;
  display_name?: string;
  structured: ProfileStructured;
  user_profile: UserProfile;
  wuxing_scores: Array<{ element: string; element_zh: string; count: number; pct: number }>;
  strength: "strong" | "balanced" | "weak";
  day_master_en: string;
  matrix_id: string;
};

function shortMatrixId(profileId: string): string {
  const hex = profileId.replace(/-/g, "").slice(0, 4).toUpperCase();
  return `PJ-${hex}`;
}

function countElementsFromPillars(profile: UserProfile): Record<string, number> {
  const counts: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  const stems = [
    profile.bazi.yearPillar,
    profile.bazi.monthPillar,
    profile.bazi.dayPillar,
    profile.bazi.hourPillar,
  ];
  for (const pillar of stems) {
    for (const ch of pillar) {
      if (ch in counts) counts[ch] += 1;
    }
  }
  return counts;
}

/** Build local-only matrix payload from a stored profile (zero LLM). */
export function buildMatrixPayloadFromProfile(
  profileId: string,
  profile: UserProfile,
  options?: { display_name?: string },
): PojuMatrixPayload {
  const params = shunshiParamsFromBirthInfo(profile.birth);
  const chart = getBaziChart({
    year: params.year,
    month: params.month,
    day: params.day,
    hour: params.hour,
    minute: params.minute,
    gender: params.gender,
    city: params.city,
    latitude: params.latitude,
    longitude: params.longitude,
    standardMeridian: params.standardMeridian,
    useTrueSolarTime: true,
    sect: 1,
  });

  const structured = buildProfileStructured({ profile, chart });
  const strength = extractStrengthFromShunshiChart(chart);

  const scoresRaw = chart.八字?.五行分值 as
    | Partial<Record<(typeof WU_XING_KEYS)[number], { 分值: number; 占比?: string }>>
    | undefined;

  let wuxing_scores: PojuMatrixPayload["wuxing_scores"];
  if (scoresRaw) {
    const total = WU_XING_KEYS.reduce((sum, k) => sum + (scoresRaw[k]?.分值 ?? 0), 0) || 1;
    wuxing_scores = WU_XING_KEYS.map((k) => ({
      element: ELEMENT_EN[k],
      element_zh: k,
      count: scoresRaw[k]?.分值 ?? 0,
      pct: Math.round(((scoresRaw[k]?.分值 ?? 0) / total) * 100),
    }));
  } else {
    const counts = countElementsFromPillars(profile);
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    wuxing_scores = WU_XING_KEYS.map((k) => ({
      element: ELEMENT_EN[k],
      element_zh: k,
      count: counts[k] ?? 0,
      pct: Math.round(((counts[k] ?? 0) / total) * 100),
    }));
  }

  return {
    profile_id: profileId,
    display_name: options?.display_name,
    structured,
    user_profile: profile,
    wuxing_scores,
    strength,
    day_master_en: profile.diagnosis.dayMaster,
    matrix_id: shortMatrixId(profileId),
  };
}
