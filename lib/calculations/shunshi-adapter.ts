import type { GetBaziChartOutput } from "shunshi-bazi-core";
import { getBaziChart } from "shunshi-bazi-core";
import { representativeHour, shunshiParamsFromBirthInfo } from "@/lib/profile/birth-info-utils";
import type { BirthInfo, UserProfile } from "@/lib/profile/types";

function fallbackProfile(input: BirthInfo): UserProfile {
  const now = Date.now();
  const hour = representativeHour(input);
  const id = `profile_${input.year}_${input.month}_${input.day}_${hour}`;
  return {
    id,
    birth: input,
    bazi: {
      yearPillar: "未知",
      monthPillar: "未知",
      dayPillar: "未知",
      hourPillar: "未知",
    },
    diagnosis: {
      dayMaster: "unknown",
      favorableElements: ["wood", "fire"],
      challengingElements: ["metal", "water"],
      patternSummary: "Fallback profile. shunshi-bazi-core not available at runtime.",
    },
    createdAt: now,
    updatedAt: now,
    source: "fallback",
  };
}

function parsePillars(chart: GetBaziChartOutput): {
  yearPillar: string;
  monthPillar: string;
  dayPillar: string;
  hourPillar: string;
} {
  const detail = chart.八字?.柱位详细;
  if (detail) {
    return {
      yearPillar: detail.年柱?.干支 ?? "未知",
      monthPillar: detail.月柱?.干支 ?? "未知",
      dayPillar: detail.日柱?.干支 ?? "未知",
      hourPillar: detail.时柱?.干支 ?? "未知",
    };
  }
  const joined = chart.八字?.四柱 ?? "";
  const [yearPillar = "未知", monthPillar = "未知", dayPillar = "未知", hourPillar = "未知"] = joined.split(" ");
  return { yearPillar, monthPillar, dayPillar, hourPillar };
}

export async function calculateProfileWithShunshi(input: BirthInfo): Promise<UserProfile> {
  const now = Date.now();
  const params = shunshiParamsFromBirthInfo(input);
  const id = `profile_${input.year}_${input.month}_${input.day}_${params.hour}`;

  try {
    const chart = getBaziChart({
      ...params,
      useTrueSolarTime: true,
    });
    const pillars = parsePillars(chart);
    const dominant = chart.八字?.五行分值?.日主五行 ?? "未知";

    return {
      id,
      birth: input,
      bazi: pillars,
      diagnosis: {
        dayMaster: chart.八字?.日主 ?? "unknown",
        favorableElements: [String(dominant)],
        challengingElements: [],
        patternSummary: `日主 ${chart.八字?.日主 ?? "unknown"}，四柱 ${pillars.yearPillar} ${pillars.monthPillar} ${pillars.dayPillar} ${pillars.hourPillar}。`,
      },
      createdAt: now,
      updatedAt: now,
      source: "shunshi",
    };
  } catch {
    return fallbackProfile(input);
  }
}
