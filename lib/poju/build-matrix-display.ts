import type { GetBaziChartOutput } from "shunshi-bazi-core";
import { Solar } from "lunar-typescript";

import type { ProfileStrength, ProfileStructured, PillarDetail } from "@/lib/calculations/build-profile-structured";
import type { DaYunEntry } from "@/lib/calculations/lunar-dayun";
import {
  DA_YUN_THEMES,
  elementLabelLocalized,
  formatHiddenStemsDisplay,
  getBranchInfo,
  getStemInfo,
  getTenGodArchetype,
  splitGanzhi,
  ZODIAN_HAN_TO_EN,
} from "@/lib/poju/bazi-matrix-mappings";
import { normalizeMatrixLocale, tMatrix } from "@/lib/poju/poju-matrix-i18n";
import type { UserProfile } from "@/lib/profile/types";

export type MatrixPillarDisplay = PillarDetail & {
  stem_en: string;
  stem_pinyin: string;
  stem_element: string;
  branch_en: string;
  branch_pinyin: string;
  branch_element: string;
  ten_god_en: string;
  hidden_display: string;
  star_label: string | null;
  life_stage_label: string | null;
  star_labels: string[];
};

export type MatrixDisplayData = {
  zodiac: { han: string; en: string; pinyin: string; branch: string; note: string };
  calendar: { gregorian: string; headline: string; lunar: string; mid: string };
  solar_term: { name: string; name_en: string; season: string; progress_pct: number; next_name: string };
  pattern_line: string;
  day_master: { han: string; en: string; pinyin: string; element: string };
  synopsis: { archetype: string; friction: string; prompt: string };
  structural_dynamics: { resonance: string; tension: string; reading: string };
  annual_transit: {
    year: number;
    stem_en: string;
    ganzhi: string;
    pinyin: string;
    progress_pct: number;
    narrative: string;
  };
  pillars: MatrixPillarDisplay[];
  current_age: number;
  current_dayun_index: number;
  dayun_hub: { theme: string; age_range: string; start_year: number };
  /** LLM-generated caption for Elemental Breakdown (replaces enote template). */
  enote_caption?: string;
  /** template = local fallback; llm = DeepSeek matrix narrative */
  narrative_source?: "template" | "llm";
  /** Locale used when narrative_source === "llm" */
  narrative_locale?: string;
  /** Set when LLM fetch failed — UI may show template fallbacks */
  narrative_failed?: boolean;
};

const JIEQI_EN: Record<string, string> = {
  立春: "Start of Spring",
  雨水: "Rain Water",
  惊蛰: "Awakening of Insects",
  春分: "Spring Equinox",
  清明: "Pure Brightness",
  谷雨: "Grain Rain",
  立夏: "Start of Summer",
  小满: "Grain Buds",
  芒种: "Grain in Ear",
  夏至: "Summer Solstice",
  小暑: "Minor Heat",
  大暑: "Major Heat",
  立秋: "Start of Autumn",
  处暑: "End of Heat",
  白露: "White Dew",
  秋分: "Autumn Equinox",
  寒露: "Cold Dew",
  霜降: "Frost Descent",
  立冬: "Start of Winter",
  小雪: "Minor Snow",
  大雪: "Major Snow",
  冬至: "Winter Solstice",
  小寒: "Minor Cold",
  大寒: "Major Cold",
};

const ELEMENT_ZH: Record<string, string> = {
  Wood: "木",
  Fire: "火",
  Earth: "土",
  Metal: "金",
  Water: "水",
};

function elementLabel(element: string, locale: string): string {
  return normalizeMatrixLocale(locale) === "zh"
    ? (ELEMENT_ZH[element] ?? element)
    : element.toLowerCase();
}

function monthElementLabel(monthElement: string | undefined, locale: string): string {
  if (!monthElement) {
    return normalizeMatrixLocale(locale) === "zh" ? "外部" : "external";
  }
  return elementLabel(monthElement, locale);
}

function resolveCurrentAge(birthYear: number): number {
  return new Date().getFullYear() - birthYear;
}

function resolveDayunIndex(daYun: DaYunEntry[], age: number): number {
  if (!daYun.length) return 0;
  const idx = daYun.findIndex((d, i) => {
    const next = daYun[i + 1];
    return age >= d.start_age && (!next || age < next.start_age);
  });
  return idx >= 0 ? idx : daYun.length - 1;
}

function dayunAgeRange(entry: DaYunEntry, next: DaYunEntry | undefined): string {
  const end = next ? next.start_age - 1 : entry.start_age + 9;
  return `${entry.start_age}–${end}`;
}

function enrichPillar(p: PillarDetail, locale: string): MatrixPillarDisplay {
  const stemInfo = getStemInfo(p.stem);
  const branchInfo = getBranchInfo(p.branch);
  return {
    ...p,
    stem_en: stemInfo?.en ?? p.stem,
    stem_pinyin: stemInfo?.pinyin ?? "",
    stem_element: stemInfo?.element ?? "",
    branch_en: branchInfo ? `${branchInfo.zodiac_en} · ${branchInfo.element}` : p.branch,
    branch_pinyin: branchInfo?.pinyin ?? "",
    branch_element: branchInfo?.element ?? "",
    ten_god_en: getTenGodArchetype(p.ten_god),
    hidden_display: formatHiddenStemsDisplay(p.hidden_stems, locale) || tMatrix(locale, "card.hidden_empty"),
    star_label: p.shen_sha[0] ? `✦ ${p.shen_sha[0]}` : null,
    life_stage_label: p.life_stage_han ?? null,
    star_labels: p.shen_sha,
  };
}

function ymdToMs(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y!, m! - 1, d!).getTime();
}

function buildSolarTerm(birth: UserProfile["birth"], locale: string) {
  const solar = Solar.fromYmd(birth.year, birth.month, birth.day);
  const lunar = solar.getLunar();
  const prev = lunar.getPrevJieQi();
  const next = lunar.getNextJieQi();
  const name = prev?.getName() ?? "—";
  const nameEn = JIEQI_EN[name] ?? name;
  const nextName = next?.getName() ?? "—";

  let progress_pct = 50;
  if (prev && next) {
    const birthMs = ymdToMs(solar.toYmd());
    const prevMs = ymdToMs(prev.getSolar().toYmd());
    const nextMs = ymdToMs(next.getSolar().toYmd());
    if (nextMs > prevMs) {
      progress_pct = Math.round(((birthMs - prevMs) / (nextMs - prevMs)) * 100);
    }
  }

  const season = tMatrix(locale, "template.season_transition");
  return { name, name_en: nameEn, season, progress_pct, next_name: nextName };
}

function buildAnnualTransit(
  year: number,
  dmElement: string,
  dominant: string,
  deficit: string,
  locale: string,
) {
  const solar = Solar.fromYmd(year, 6, 15);
  const gz = solar.getLunar().getYearInGanZhi();
  const { stem, branch } = splitGanzhi(gz);
  const stemInfo = getStemInfo(stem);
  const branchInfo = getBranchInfo(branch);
  const now = new Date();
  const start = new Date(year, 0, 1).getTime();
  const end = new Date(year + 1, 0, 1).getTime();
  const progress_pct = Math.round(((now.getTime() - start) / (end - start)) * 100);

  const narrative = tMatrix(locale, "template.annual_transit", {
    element: stemInfo?.element ?? "Transit",
    dominant,
    deficit,
  });

  return {
    year,
    stem_en: stemInfo?.en ?? stem,
    ganzhi: gz,
    pinyin: `${stemInfo?.pinyin ?? ""} ${branchInfo?.pinyin ?? ""}`.trim(),
    progress_pct: Math.min(100, Math.max(0, progress_pct)),
    narrative,
  };
}

function buildStructuralDynamics(
  chart: GetBaziChartOutput | undefined,
  structured: ProfileStructured,
  dominant: string,
  deficit: string,
  dmElement: string,
  locale: string,
) {
  const xc = chart?.八字?.刑冲合会 as { 天干?: string[]; 地支?: string[] } | undefined;
  const yearBranch = getBranchInfo(structured.pillars_detail?.year.branch ?? "");
  const dayBranch = getBranchInfo(structured.pillars_detail?.day.branch ?? "");

  const resonance =
    xc?.天干?.[0] != null
      ? tMatrix(locale, "template.resonance_stem", { interaction: xc.天干[0] })
      : tMatrix(locale, "template.resonance_default", {
          year_branch: yearBranch?.zodiac_en ?? (normalizeMatrixLocale(locale) === "zh" ? "年支" : "Year-branch"),
        });

  const tension =
    xc?.地支?.[0] != null
      ? tMatrix(locale, "template.tension_branch", { interaction: xc.地支[0] })
      : tMatrix(locale, "template.tension_default", { dominant, deficit });

  const reading =
    dmElement === "Wood"
      ? tMatrix(locale, "template.reading_wood")
      : tMatrix(locale, "template.reading_default");

  return { resonance, tension, reading };
}

function buildSynopsis(
  dmElement: string,
  strength: ProfileStrength,
  dominant: string,
  deficit: string,
  monthBranch: ReturnType<typeof getBranchInfo>,
  locale: string,
) {
  const archetypeKey = `template.archetype_${dmElement.toLowerCase()}` as const;
  const archetype =
    tMatrix(locale, archetypeKey) !== archetypeKey
      ? tMatrix(locale, archetypeKey)
      : tMatrix(locale, "template.archetype_wood");

  const friction = tMatrix(locale, "template.friction", {
    element: elementLabel(dmElement, locale),
    month_element: monthElementLabel(monthBranch?.element, locale),
    dominant,
    deficit,
  });

  void strength;

  const prompt = tMatrix(locale, "template.prompt");

  return { archetype, friction, prompt };
}

export function buildMatrixDisplayData(input: {
  profile: UserProfile;
  structured: ProfileStructured;
  chart?: GetBaziChartOutput;
  strength: ProfileStrength;
  wuxing_scores: Array<{ element: string; pct: number }>;
  locale: string;
}): MatrixDisplayData {
  const { profile, structured, chart, strength, wuxing_scores, locale } = input;
  const zhDate = normalizeMatrixLocale(locale) === "zh";
  const pd = structured.pillars_detail;
  const yearBranch = pd?.year.branch ?? splitGanzhi(profile.bazi.yearPillar).branch;
  const branchInfo = getBranchInfo(yearBranch);
  const dmStem = pd?.day.stem ?? structured.day_master.charAt(0);
  const dmInfo = getStemInfo(dmStem);
  const sorted = [...wuxing_scores].sort((a, b) => b.pct - a.pct);
  const dominant = sorted[0]?.element ?? "Wood";
  const deficit = sorted[sorted.length - 1]?.element ?? "Fire";
  const dmElement = dmInfo?.element ?? "Wood";

  const shengxiaoHan = String(chart?.八字?.生肖 ?? "");
  const zodiacEn = ZODIAN_HAN_TO_EN[shengxiaoHan] ?? branchInfo?.zodiac_en ?? "—";

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const b = profile.birth;
  const gregorian = zhDate
    ? `${b.year}年${b.month}月${b.day}日`
    : `${monthNames[b.month - 1]} ${b.day}, ${b.year}`;

  const yearGanzhi = pd?.year.ganzhi ?? profile.bazi.yearPillar;
  const pattern_line = tMatrix(locale, "template.pattern_line", {
    zodiac: zhDate ? shengxiaoHan || branchInfo?.han || "" : zodiacEn,
    day_master: dmInfo?.en ?? dmStem,
  });

  const calendarMid = tMatrix(locale, "template.calendar_mid", {
    year_pillar: yearGanzhi,
    day_master: dmStem,
  });

  const age = resolveCurrentAge(b.year);
  const dayunIdx = resolveDayunIndex(structured.da_yun, age);
  const currentDy = structured.da_yun[dayunIdx];
  const nextDy = structured.da_yun[dayunIdx + 1];
  const theme = DA_YUN_THEMES[dayunIdx] ?? DA_YUN_THEMES[0];

  const pillars: MatrixPillarDisplay[] = pd
    ? (["year", "month", "day", "hour"] as const).map((k) => enrichPillar(pd[k], locale))
    : [];

  const monthBranchInfo = pd ? getBranchInfo(pd.month.branch) : null;
  const transitYear = new Date().getFullYear();

  return {
    zodiac: {
      han: shengxiaoHan || branchInfo?.han || yearBranch,
      en: zodiacEn,
      pinyin: branchInfo?.pinyin ?? "",
      branch: yearBranch,
      note: tMatrix(locale, "template.zodiac_note"),
    },
    calendar: {
      gregorian,
      headline: pattern_line,
      lunar: String(chart?.八字?.农历 ?? "").replace(/^农历/, tMatrix(locale, "template.lunar_prefix")),
      mid: calendarMid,
    },
    solar_term: buildSolarTerm(b, locale),
    pattern_line,
    day_master: {
      han: dmStem,
      en: dmInfo?.en ?? dmStem,
      pinyin: dmInfo?.pinyin ?? "",
      element: dmElement,
    },
    synopsis: buildSynopsis(dmElement, strength, dominant, deficit, monthBranchInfo, locale),
    structural_dynamics: buildStructuralDynamics(chart, structured, dominant, deficit, dmElement, locale),
    annual_transit: buildAnnualTransit(transitYear, dmElement, dominant, deficit, locale),
    pillars,
    current_age: age,
    current_dayun_index: dayunIdx,
    dayun_hub: currentDy
      ? {
          theme,
          age_range: dayunAgeRange(currentDy, nextDy),
          start_year: currentDy.start_year,
        }
      : { theme, age_range: "—", start_year: b.year },
    narrative_source: "template",
  };
}
