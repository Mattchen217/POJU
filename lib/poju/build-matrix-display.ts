import type { GetBaziChartOutput } from "shunshi-bazi-core";
import { Solar } from "lunar-typescript";

import type { ProfileStrength, ProfileStructured, PillarDetail } from "@/lib/calculations/build-profile-structured";
import type { DaYunEntry } from "@/lib/calculations/lunar-dayun";
import {
  DA_YUN_THEMES,
  getBranchInfo,
  getStemInfo,
  getTenGodArchetype,
  splitGanzhi,
  ZODIAN_HAN_TO_EN,
} from "@/lib/poju/bazi-matrix-mappings";
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

const ARCHETYPE_BY_ELEMENT: Record<string, { en: string; zh: string }> = {
  Wood: {
    en: "You are a **Receptive Vine** — adaptive, perceptive, growing toward warmth, yet always seeking a stable structure to climb. Influence flows through resonance, not force.",
    zh: "你是**柔韧之藤**——感知敏锐、顺势生长，总在寻找可攀附的结构；影响力来自共鸣，而非强推。",
  },
  Fire: {
    en: "You are a **Radiant Forge** — visible, catalytic, drawn to momentum. Your energy sparks movement, but needs rhythm to avoid burning out.",
    zh: "你是**明焰之炉**——外显、催化、带动势头的能量；需要节奏感，才不会燃尽自己。",
  },
  Earth: {
    en: "You are a **Grounded Axis** — stabilizing, patient, holding the center while others swirl. Trust builds slowly, then holds weight.",
    zh: "你是**定轴之土**——稳住中心、耐心承载；信任慢热，但一旦建立就扛得住重量。",
  },
  Metal: {
    en: "You are a **Precision Edge** — discerning, structured, cutting through noise to the essential line. Clarity is your native language.",
    zh: "你是**精锋之金**——辨识力强、结构清晰，擅长从噪音里切出关键线；清晰是你的母语。",
  },
  Water: {
    en: "You are a **Deep Current** — reflective, strategic, moving beneath the surface. You read patterns others miss until the moment is right.",
    zh: "你是**深流之水**——内省、策略、在表面之下潜行；你读到的模式，往往在关键时刻才显现。",
  },
};

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
  const hiddenParts = p.hidden_stems.map((st) => getStemInfo(st)?.element ?? st);
  const hiddenUnique = [...new Set(hiddenParts)];
  return {
    ...p,
    stem_en: stemInfo?.en ?? p.stem,
    stem_pinyin: stemInfo?.pinyin ?? "",
    stem_element: stemInfo?.element ?? "",
    branch_en: branchInfo ? `${branchInfo.zodiac_en} · ${branchInfo.element}` : p.branch,
    branch_pinyin: branchInfo?.pinyin ?? "",
    branch_element: branchInfo?.element ?? "",
    ten_god_en: getTenGodArchetype(p.ten_god),
    hidden_display:
      hiddenUnique.length > 0
        ? `${locale.startsWith("zh") ? "藏干" : "Hidden"}: ${hiddenUnique.join("·")}`
        : locale.startsWith("zh")
          ? "藏干: —"
          : "Hidden: —",
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

  const season = locale.startsWith("zh") ? "节气交接中" : "Season transition in progress";
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

  const narrative = locale.startsWith("zh")
    ? `${stemInfo?.element ?? ""}运点燃你的${dominant}盈余，而${deficit}仍偏薄——这股年度势能，正是你当下反复权衡的底层能量背景。`
    : `${stemInfo?.element ?? "Transit"} energy meets your ${dominant} surplus while ${deficit} stays thin — this year's momentum sits beneath the back-and-forth you feel now.`;

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
      ? locale.startsWith("zh")
        ? `天干层出现 ${xc.天干[0]} — 两种驱动力在表面形成协同。`
        : `Stem-layer ${xc.天干[0]} — two drives align at the surface.`
      : locale.startsWith("zh")
        ? `${yearBranch?.zodiac_en ?? "年支"}年支锚定你的外在姿态 — 他人读你的第一参照。`
        : `${yearBranch?.zodiac_en ?? "Year-branch"} anchors how others first read you — a stable outward reference.`;

  const tension =
    xc?.地支?.[0] != null
      ? locale.startsWith("zh")
        ? `地支层 ${xc.地支[0]} — 内在意愿与外部结构之间存在可工作的张力。`
        : `Branch-layer ${xc.地支[0]} — workable tension between inner will and outer structure.`
      : locale.startsWith("zh")
        ? `${dominant}偏盛而${deficit}偏薄 — 扩张与约束之间的拉扯正在作用。`
        : `${dominant} surplus vs ${deficit} deficit — a live pull between expansion and constraint.`;

  const reading = locale.startsWith("zh")
    ? dmElement === "Wood"
      ? "你更擅长顺势找缝，而非硬推 —— 压力下的突破口，往往是你的优势。"
      : "你更擅长在结构内调整，而非正面硬碰 —— 把局势读清楚，再动。"
    : dmElement === "Wood"
      ? "You build by adapting, not forcing — your edge is finding the opening others miss under pressure."
      : "You move by adjusting within structure — reading the field clearly before you act.";

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
  const archetypeTpl = ARCHETYPE_BY_ELEMENT[dmElement] ?? ARCHETYPE_BY_ELEMENT.Wood!;
  const archetype = locale.startsWith("zh") ? archetypeTpl.zh : archetypeTpl.en;

  const friction = locale.startsWith("zh")
    ? `你的${dmElement === "Wood" ? "木" : dmElement}性内在愿景，正与${monthBranch?.element ?? "外部"}气形成**结构张力** —— ${dominant}盈余、${deficit}不足，让选择像在被两股力量同时拉扯。`
    : `Your inner ${dmElement.toLowerCase()} vision sits under active **structural tension** from ${monthBranch?.element?.toLowerCase() ?? "external"} demands — ${dominant} surplus and ${deficit} deficit make the choice feel pulled two ways at once.`;

  void strength;

  const prompt = locale.startsWith("zh")
    ? "请把你此刻最纠结、迟迟定不下来的问题或困境写在下方对话框并发送——我会结合你的能量结构，陪你一步步拆开。"
    : "Tell me the question or dilemma you're weighing right now — type it in the box below and send, and we'll work through it together from your matrix.";

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
  const zh = locale.startsWith("zh");
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
  const gregorian = zh
    ? `${b.year}年${b.month}月${b.day}日`
    : `${monthNames[b.month - 1]} ${b.day}, ${b.year}`;

  const yearGanzhi = pd?.year.ganzhi ?? profile.bazi.yearPillar;
  const pattern_line = zh
    ? `${shengxiaoHan || branchInfo?.han}年 · 日主 ${dmInfo?.en ?? dmStem}`
    : `Year of the ${zodiacEn} · Day Master ${dmInfo?.en ?? dmStem}`;

  const calendarMid = zh
    ? `年柱 ${yearGanzhi} · 日主 ${dmStem}`
    : `Year pillar ${yearGanzhi} · Day Master ${dmStem}`;

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
      note: zh
        ? "你的外在姿态 — 他人如何第一眼读你。"
        : "Your outward self — how others first read you.",
    },
    calendar: {
      gregorian,
      headline: pattern_line,
      lunar: String(chart?.八字?.农历 ?? "").replace(/^农历/, zh ? "农历" : "Lunar "),
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
