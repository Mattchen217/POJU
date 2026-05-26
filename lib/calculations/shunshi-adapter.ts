import type { GetBaziChartOutput } from "shunshi-bazi-core";
import { getBaziChart } from "shunshi-bazi-core";
import { representativeHour, shunshiParamsFromBirthInfo } from "@/lib/profile/birth-info-utils";
import type { BirthInfo, TstMeta, UserProfile } from "@/lib/profile/types";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function extractTstMeta(chart: GetBaziChartOutput, birth: BirthInfo, longitude: number): TstMeta | undefined {
  const tst = chart.真太阳时;
  if (!tst) return undefined;

  const [trueSolarDate, trueSolarTimeFull] = tst.真太阳时.split(" ");
  const params = shunshiParamsFromBirthInfo(birth);

  return {
    original_date: `${birth.year}-${pad2(birth.month)}-${pad2(birth.day)}`,
    original_time: `${pad2(params.hour)}:00`,
    true_solar_date: trueSolarDate,
    true_solar_time: trueSolarTimeFull?.slice(0, 5) ?? "",
    diff_minutes: tst.修正分钟,
    longitude,
    timezone: birth.birth_location?.timezone ?? birth.timezone,
    computation_version: params.usedTrueSolarTime ? "v2_with_tst" : "v1",
  };
}

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
    });
    const pillars = parsePillars(chart);
    const dominant = chart.八字?.五行分值?.日主五行 ?? "未知";
    const tst_meta = extractTstMeta(chart, input, params.longitude!);

    if (tst_meta) {
      console.log("[bazi] Original:", tst_meta.original_date, tst_meta.original_time);
      console.log("[bazi] True Solar:", tst_meta.true_solar_date, tst_meta.true_solar_time);
      console.log("[bazi] Diff:", tst_meta.diff_minutes, "minutes");
    }

    return {
      id,
      birth: { ...input, tst_meta },
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
      used_true_solar_time: params.usedTrueSolarTime,
      tst_meta,
    };
  } catch {
    return fallbackProfile(input);
  }
}
