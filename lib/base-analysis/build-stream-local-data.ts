import type { BaseAnalysisStreamLocalData } from "@/lib/llm/prompts/base-analysis-stream-prompt";
import { HOUR_PERIOD_INFO, type UserProfile } from "@/lib/profile/types";

/** Build `local_data` for POST /api/profile/base-analysis/stream from a calculated profile. */
export function buildStreamLocalDataFromProfile(profile: UserProfile): BaseAnalysisStreamLocalData {
  const b = profile.birth;
  const tst = profile.tst_meta ?? b.tst_meta;
  const favorable = profile.diagnosis.favorableElements ?? [];

  return {
    four_pillars: {
      year: profile.bazi.yearPillar,
      month: profile.bazi.monthPillar,
      day: profile.bazi.dayPillar,
      hour: profile.bazi.hourPillar,
      day_master: profile.diagnosis.dayMaster,
      pattern_summary: profile.diagnosis.patternSummary,
      favorable_elements: favorable,
      challenging_elements: profile.diagnosis.challengingElements ?? [],
    },
    true_solar_time: tst
      ? {
          original_date: tst.original_date,
          original_time: tst.original_time,
          true_solar_date: tst.true_solar_date,
          true_solar_time: tst.true_solar_time,
          diff_minutes: tst.diff_minutes,
          longitude: tst.longitude,
          computation_version: tst.computation_version,
        }
      : { used: profile.used_true_solar_time ?? false },
    yong_shen: favorable[0] ?? profile.diagnosis.dayMaster ?? "",
    profile_basics: {
      year: b.year,
      month: b.month,
      day: b.day,
      hour_period: b.hour_period,
      hour_label: HOUR_PERIOD_INFO[b.hour_period]?.zh_label,
      gender: b.gender,
      timezone: b.timezone,
      birth_location: b.birth_location?.name,
    },
  };
}
