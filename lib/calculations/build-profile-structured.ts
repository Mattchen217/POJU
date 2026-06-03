import type { GetBaziChartOutput } from "shunshi-bazi-core";

import {
  calcDaYun,
  lunarGenderFromBirth,
  parseTrueSolarTimeString,
  type DaYunEntry,
} from "@/lib/calculations/lunar-dayun";
import type { UserProfile } from "@/lib/profile/types";

export type ProfileStrength = "strong" | "balanced" | "weak";

export type ProfileStructured = {
  day_master: string;
  pattern: string;
  yong_shen: string;
  xi_shen: string[];
  ji_shen: string[];
  strength: ProfileStrength;
  four_pillars: {
    year: string;
    month: string;
    day: string;
    hour: string;
  };
  da_yun: DaYunEntry[];
};

const WU_XING_KEYS = ["金", "木", "水", "火", "土"] as const;

type WuXingScores = Partial<Record<(typeof WU_XING_KEYS)[number], { 分值: number; 占比?: string }>> & {
  日主五行?: string;
};

/** Derive 强弱 from shunshi 五行分值 (chart has no explicit 身强/身弱 field). */
export function extractStrengthFromShunshiChart(chart: GetBaziChartOutput): ProfileStrength {
  const scores = chart.八字?.五行分值 as WuXingScores | undefined;
  const dmElement = scores?.日主五行 as (typeof WU_XING_KEYS)[number] | undefined;
  if (!scores || !dmElement || typeof scores[dmElement]?.分值 !== "number") {
    return "balanced";
  }

  const dmScore = scores[dmElement]!.分值;
  const allScores = WU_XING_KEYS.map((k) => scores[k]?.分值 ?? 0);
  const avg = allScores.reduce((sum, n) => sum + n, 0) / WU_XING_KEYS.length;

  if (dmScore >= avg * 1.15) return "strong";
  if (dmScore <= avg * 0.85) return "weak";
  return "balanced";
}

function resolveTrueSolarTime(
  profile: UserProfile,
  chart?: GetBaziChartOutput,
): ReturnType<typeof parseTrueSolarTimeString> | null {
  const tstRaw = chart?.真太阳时?.真太阳时;
  if (tstRaw) return parseTrueSolarTimeString(tstRaw);

  const meta = profile.tst_meta ?? profile.birth.tst_meta;
  if (meta?.true_solar_date && meta?.true_solar_time) {
    return parseTrueSolarTimeString(`${meta.true_solar_date} ${meta.true_solar_time}`);
  }

  return null;
}

/** Pure-code structured payload: shunshi 四柱/诊断 + lunar 大运. */
export function buildProfileStructured(input: {
  profile: UserProfile;
  chart?: GetBaziChartOutput;
}): ProfileStructured {
  const { profile, chart } = input;
  const favorable = profile.diagnosis.favorableElements ?? [];
  const challenging = profile.diagnosis.challengingElements ?? [];

  const trueSolar = resolveTrueSolarTime(profile, chart);
  const da_yun =
    trueSolar != null
      ? calcDaYun({
          trueSolarTime: trueSolar,
          gender: lunarGenderFromBirth(profile.birth.gender),
        })
      : [];

  return {
    day_master: profile.diagnosis.dayMaster,
    pattern: profile.diagnosis.patternSummary,
    yong_shen: favorable[0] ?? profile.diagnosis.dayMaster,
    xi_shen: favorable.length > 1 ? favorable.slice(1) : favorable,
    ji_shen: challenging,
    strength: chart ? extractStrengthFromShunshiChart(chart) : "balanced",
    four_pillars: {
      year: profile.bazi.yearPillar,
      month: profile.bazi.monthPillar,
      day: profile.bazi.dayPillar,
      hour: profile.bazi.hourPillar,
    },
    da_yun,
  };
}
