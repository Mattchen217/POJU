import type { GetBaziChartOutput } from "shunshi-bazi-core";

import {
  computeLocalShenShaForPillars,
  mergeShenSha,
  shenShaListToI18nKeys,
  type PillarKey,
} from "@/lib/calculations/bazi-shensha-local";
import { getLifeStage, getLifeStageI18nKey } from "@/lib/calculations/chang-sheng";
import {
  calcDaYun,
  lunarGenderFromBirth,
  parseTrueSolarTimeString,
  type DaYunEntry,
} from "@/lib/calculations/lunar-dayun";
import {
  computeYongshenAnalysis,
  yongshenToDiagnosisElements,
  type YongshenAnalysis,
} from "@/lib/calculations/yongshen-heuristic";
import type { UserProfile } from "@/lib/profile/types";

export type ProfileStrength = "strong" | "balanced" | "weak";

export type PillarDetail = {
  ganzhi: string;
  stem: string;
  branch: string;
  ten_god: string;
  hidden_stems: string[];
  shen_sha: string[];
  /** 十二长生 i18n key, e.g. bazi.life_stage.changsheng */
  life_stage?: string;
  /** 十二长生 Han label for fallback display */
  life_stage_han?: string;
  /** 神煞 i18n keys aligned with shen_sha */
  stars?: string[];
};

export type BaziPillarEnrichment = {
  life_stage: string;
  stars: string[];
};

export type BaziEnrichment = {
  gender_label: string;
  pillars: Record<PillarKey, BaziPillarEnrichment>;
  yongshen_analysis: YongshenAnalysis;
};

export type ProfileDataAvailability = {
  pillars_detail: boolean;
  da_yun: boolean;
  bazi_enrichment: boolean;
};

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
  /** Per-pillar 十神 / 藏干 / 神煞 from shunshi chart + local enrichment. */
  pillars_detail?: {
    year: PillarDetail;
    month: PillarDetail;
    day: PillarDetail;
    hour: PillarDetail;
  };
  da_yun: DaYunEntry[];
  /** Gender, life stages, merged 神煞, 喜用神 — i18n-keyed payload for UI/LLM. */
  bazi_enrichment?: BaziEnrichment;
  /** When false, LLM must not invent that dimension (see data_availability). */
  data_availability: ProfileDataAvailability;
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

export function genderLabelKey(gender: "M" | "F"): string {
  return gender === "M" ? "bazi.gender.qian" : "bazi.gender.kun";
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

function extractPillarDetail(raw: unknown): PillarDetail | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const ganzhi = String(p.干支 ?? "");
  if (!ganzhi) return null;
  return {
    ganzhi,
    stem: String(p.天干 ?? ganzhi.charAt(0)),
    branch: String(p.地支 ?? ganzhi.charAt(1)),
    ten_god: String(p.主星 ?? ""),
    hidden_stems: Array.isArray(p.藏干) ? p.藏干.map(String) : [],
    shen_sha: Array.isArray(p.神煞) ? p.神煞.map(String) : [],
  };
}

function extractPillarsDetail(chart?: GetBaziChartOutput): ProfileStructured["pillars_detail"] {
  const raw = chart?.八字?.柱位详细 as Record<string, unknown> | undefined;
  if (!raw) return undefined;
  const year = extractPillarDetail(raw.年柱);
  const month = extractPillarDetail(raw.月柱);
  const day = extractPillarDetail(raw.日柱);
  const hour = extractPillarDetail(raw.时柱);
  if (!year || !month || !day || !hour) return undefined;
  return { year, month, day, hour };
}

function enrichPillarsWithBaziFields(
  pillars: NonNullable<ProfileStructured["pillars_detail"]>,
  dayMasterStem: string,
): NonNullable<ProfileStructured["pillars_detail"]> {
  const branches = {
    year: pillars.year.branch,
    month: pillars.month.branch,
    day: pillars.day.branch,
    hour: pillars.hour.branch,
  };
  const stems = {
    year: pillars.year.stem,
    month: pillars.month.stem,
    day: pillars.day.stem,
    hour: pillars.hour.stem,
  };

  const localShenSha = computeLocalShenShaForPillars({
    dayMasterStem,
    branches,
    stems,
    yearBranch: pillars.year.branch,
    dayBranch: pillars.day.branch,
    monthBranch: pillars.month.branch,
  });

  const keys: PillarKey[] = ["year", "month", "day", "hour"];
  const enriched = { ...pillars };

  for (const key of keys) {
    const p = enriched[key];
    const stageHan = getLifeStage(dayMasterStem, p.branch);
    const stageKey = getLifeStageI18nKey(dayMasterStem, p.branch);
    const mergedSha = mergeShenSha(p.shen_sha, localShenSha[key]);
    enriched[key] = {
      ...p,
      life_stage: stageKey ?? undefined,
      life_stage_han: stageHan ?? undefined,
      shen_sha: mergedSha,
      stars: shenShaListToI18nKeys(mergedSha),
    };
  }

  return enriched;
}

function buildBaziEnrichment(
  profile: UserProfile,
  pillars: NonNullable<ProfileStructured["pillars_detail"]>,
  yongshen: YongshenAnalysis,
): BaziEnrichment {
  const keys: PillarKey[] = ["year", "month", "day", "hour"];
  const pillarEnrichment = {} as Record<PillarKey, BaziPillarEnrichment>;

  for (const key of keys) {
    const p = pillars[key];
    pillarEnrichment[key] = {
      life_stage: p.life_stage ?? "",
      stars: p.stars ?? [],
    };
  }

  return {
    gender_label: genderLabelKey(profile.birth.gender),
    pillars: pillarEnrichment,
    yongshen_analysis: yongshen,
  };
}

/** Pure-code structured payload: shunshi 四柱/诊断 + lunar 大运 + local Bazi enrichment. */
export function buildProfileStructured(input: {
  profile: UserProfile;
  chart?: GetBaziChartOutput;
}): ProfileStructured {
  const { profile, chart } = input;

  const yongshen = chart ? computeYongshenAnalysis(chart) : null;
  const yongshenDiag = yongshen ? yongshenToDiagnosisElements(yongshen) : null;

  const favorable =
    yongshenDiag?.favorableElements.length
      ? yongshenDiag.favorableElements
      : (profile.diagnosis.favorableElements ?? []);
  const challenging =
    yongshenDiag?.challengingElements.length
      ? yongshenDiag.challengingElements
      : (profile.diagnosis.challengingElements ?? []);

  const trueSolar = resolveTrueSolarTime(profile, chart);
  const da_yun =
    trueSolar != null
      ? calcDaYun({
          trueSolarTime: trueSolar,
          gender: lunarGenderFromBirth(profile.birth.gender),
        })
      : [];

  let pillars_detail = extractPillarsDetail(chart);
  const dayMasterStem =
    pillars_detail?.day.stem ?? profile.diagnosis.dayMaster.charAt(0) ?? profile.bazi.dayPillar.charAt(0);

  if (pillars_detail && dayMasterStem) {
    pillars_detail = enrichPillarsWithBaziFields(pillars_detail, dayMasterStem);
  }

  const strength: ProfileStrength = yongshen?.status_strength ?? (chart ? extractStrengthFromShunshiChart(chart) : "balanced");

  const bazi_enrichment =
    pillars_detail && yongshen
      ? buildBaziEnrichment(profile, pillars_detail, yongshen)
      : chart && yongshen
        ? {
            gender_label: genderLabelKey(profile.birth.gender),
            pillars: {
              year: { life_stage: "", stars: [] },
              month: { life_stage: "", stars: [] },
              day: { life_stage: "", stars: [] },
              hour: { life_stage: "", stars: [] },
            },
            yongshen_analysis: yongshen,
          }
        : undefined;

  return {
    day_master: profile.diagnosis.dayMaster,
    pattern: profile.diagnosis.patternSummary,
    yong_shen: favorable[0] ?? profile.diagnosis.dayMaster,
    xi_shen: favorable.length > 1 ? favorable.slice(1) : favorable,
    ji_shen: challenging,
    strength,
    four_pillars: {
      year: profile.bazi.yearPillar,
      month: profile.bazi.monthPillar,
      day: profile.bazi.dayPillar,
      hour: profile.bazi.hourPillar,
    },
    pillars_detail,
    da_yun,
    bazi_enrichment,
    data_availability: {
      pillars_detail: Boolean(pillars_detail),
      da_yun: da_yun.length > 0,
      bazi_enrichment: Boolean(bazi_enrichment),
    },
  };
}
