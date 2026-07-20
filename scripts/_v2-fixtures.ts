/**
 * v2 冒烟用三盘 fixtures —— 真实引擎排盘（强/弱/均衡，日主各不同）。
 *
 *   偏强: 1985-07-15 M 丑时 → 乙 / strong
 *   偏弱: 1978-09-12 M 丑时 → 丁 / weak
 *   均衡: 2001-03-08 F 亥时 → 庚 / balanced
 */
import { getBaziChart } from "shunshi-bazi-core";

import {
  buildProfileStructured,
  type ProfileStructured,
} from "@/lib/calculations/build-profile-structured";
import { shunshiParamsFromBirthInfo } from "@/lib/profile/birth-info-utils";
import type { BirthInfo, UserProfile } from "@/lib/profile/types";

const LOC_GZ = {
  name: "Guangzhou",
  longitude: 113.26,
  latitude: 23.13,
  timezone: "Asia/Shanghai",
  use_defaults: false as const,
};

function buildFromBirth(birth: BirthInfo, id: string): ProfileStructured {
  const params = shunshiParamsFromBirthInfo(birth);
  const chart = getBaziChart({
    year: params.year,
    month: params.month,
    day: params.day,
    hour: params.hour,
    minute: params.minute,
    gender: params.gender,
    longitude: params.longitude,
    latitude: params.latitude,
    standardMeridian: params.standardMeridian,
    useTrueSolarTime: true,
    sect: 1,
  });

  const pillars = chart.八字?.柱位详细;
  const profile: UserProfile = {
    id,
    birth: {
      ...birth,
      tst_meta: chart.真太阳时
        ? {
            original_date: `${birth.year}-${String(birth.month).padStart(2, "0")}-${String(birth.day).padStart(2, "0")}`,
            original_time: `${String(params.hour).padStart(2, "0")}:00`,
            true_solar_date: chart.真太阳时.真太阳时.split(" ")[0]!,
            true_solar_time: chart.真太阳时.真太阳时.split(" ")[1]!.slice(0, 5),
            diff_minutes: chart.真太阳时.修正分钟,
            longitude: params.longitude!,
            timezone: birth.timezone,
            computation_version: "v2_with_tst",
          }
        : undefined,
    },
    bazi: {
      yearPillar: pillars?.年柱?.干支 ?? "?",
      monthPillar: pillars?.月柱?.干支 ?? "?",
      dayPillar: pillars?.日柱?.干支 ?? "?",
      hourPillar: pillars?.时柱?.干支 ?? "?",
    },
    diagnosis: {
      dayMaster: chart.八字?.日主 ?? "?",
      favorableElements: [String(chart.八字?.五行分值?.日主五行 ?? "unknown")],
      challengingElements: [],
      patternSummary: `日主 ${chart.八字?.日主}，四柱 ${chart.八字?.四柱}。`,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    source: "shunshi",
    used_true_solar_time: params.usedTrueSolarTime,
  };

  return buildProfileStructured({ profile, chart });
}

/** 偏强 · 乙木日主 */
export const STRUCTURED_STRONG: ProfileStructured = buildFromBirth(
  {
    year: 1985,
    month: 7,
    day: 15,
    hour_period: "chou",
    gender: "M",
    timezone: "Asia/Shanghai",
    birth_location: LOC_GZ,
  },
  "v2_fixture_strong_yi",
);

/** 偏弱 · 丁火日主 */
export const STRUCTURED_WEAK: ProfileStructured = buildFromBirth(
  {
    year: 1978,
    month: 9,
    day: 12,
    hour_period: "chou",
    gender: "M",
    timezone: "Asia/Shanghai",
    birth_location: LOC_GZ,
  },
  "v2_fixture_weak_ding",
);

/** 均衡 · 庚金日主 */
export const STRUCTURED_BALANCED: ProfileStructured = buildFromBirth(
  {
    year: 2001,
    month: 3,
    day: 8,
    hour_period: "hai",
    gender: "F",
    timezone: "Asia/Shanghai",
    birth_location: LOC_GZ,
  },
  "v2_fixture_balanced_geng",
);
