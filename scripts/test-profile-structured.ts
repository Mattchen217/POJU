/**
 * Print profile structured (含 lunar 大运). Run: pnpm tsx scripts/test-profile-structured.ts
 */
import { getBaziChart } from "shunshi-bazi-core";

import { buildProfileStructured } from "@/lib/calculations/build-profile-structured";
import { shunshiParamsFromBirthInfo } from "@/lib/profile/birth-info-utils";
import type { BirthInfo, UserProfile } from "@/lib/profile/types";

function runCase(label: string, birth: BirthInfo) {
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
    id: `test_${birth.year}_${birth.month}_${birth.day}`,
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
  };

  const structured = buildProfileStructured({ profile, chart });

  console.log(`\n=== ${label} ===`);
  console.log(`clock: ${birth.year}-${birth.month}-${birth.day} ${params.hour}:00 | TST: ${chart.真太阳时?.真太阳时}`);
  console.log(`shunshi 起运: ${chart.八字?.起运} (${chart.八字?.起运日期})`);
  console.log(JSON.stringify(structured, null, 2));

  const shunshiDayun = (chart.八字?.大运 ?? []).slice(0, 3).map((d) => ({
    start_age: d.起始年龄,
    start_year: d.起始年份,
    ganzhi: d.干支,
  }));
  const lunarDayun = structured.da_yun.slice(0, 3);
  const match =
    JSON.stringify(shunshiDayun) === JSON.stringify(lunarDayun)
      ? "✓ lunar 前3步大运与 shunshi 一致"
      : `✗ 差异 shunshi=${JSON.stringify(shunshiDayun)} lunar=${JSON.stringify(lunarDayun)}`;
  console.log(match);
}

runCase("1990 广州男 (问真参考)", {
  year: 1990,
  month: 3,
  day: 24,
  hour_period: "si",
  gender: "M",
  timezone: "Asia/Shanghai",
  birth_location: {
    name: "Guangzhou",
    longitude: 113.2644,
    latitude: 23.1291,
    timezone: "Asia/Shanghai",
    use_defaults: false,
  },
});

runCase("2024 北京女 立春后", {
  year: 2024,
  month: 2,
  day: 5,
  hour_period: "wu",
  gender: "F",
  timezone: "Asia/Shanghai",
  birth_location: {
    name: "Beijing",
    longitude: 116.4,
    latitude: 39.9,
    timezone: "Asia/Shanghai",
    use_defaults: false,
  },
});
