/**
 * ziwei-doushu patterns adapter — closed-set pattern_hits only.
 * Chart structure stays on iztro (BirthInfo → fact-pack); patterns engine is vendor detectPatterns.
 * Does NOT import classics / nihai / interpretation datasets.
 */

import { astro } from "iztro";
import type { BirthInfo } from "@/lib/profile/types";
import { birthInfoToIztroArgs } from "@/lib/ziwei/birth-clock";
import { detectPatterns } from "@/lib/ziwei/doushu/patterns";
import type {
  Palace as DoushuPalace,
  Star as DoushuStar,
  ZiweiChart as DoushuChart,
} from "@/lib/ziwei/doushu/types";
import { BRANCHES } from "@/lib/ziwei/doushu/constants";

export const DOUSHU_PATTERNS_COMMIT = "ff9a147";
export const DOUSHU_PATTERNS_LIBRARY = "ziwei-doushu" as const;

export type ZiweiPatternHit = {
  name: string;
  level: "excellent" | "good" | "neutral" | "caution";
  palaces: string[];
  required?: string[];
  bonus?: string[];
  breaking?: string[];
  source?: string;
};

type NamedStar = { name?: string; mutagen?: string; type?: string; brightness?: string };

type RawPalace = {
  name: string;
  heavenlyStem: string;
  earthlyBranch: string;
  isBodyPalace: boolean;
  majorStars: NamedStar[];
  minorStars: NamedStar[];
  adjectiveStars?: NamedStar[];
};

function mapBrightness(raw: string | undefined): DoushuStar["brightness"] {
  if (!raw) return undefined;
  const t = raw.trim().toLowerCase();
  // iztro zh-CN: 庙/旺/陷…；key: miao/wang/xian；vendor: bright/dim
  if (/庙|旺|miao|wang|bright|\+3|\+2/.test(t)) return "bright";
  if (/陷|不|xian|bu|dim|\-/.test(t)) return "dim";
  return "normal";
}

function mapStar(star: NamedStar, fallbackType: DoushuStar["type"]): DoushuStar {
  const name = star.name?.trim() ?? "";
  const mutagen = star.mutagen;
  return {
    name,
    type: fallbackType,
    siHua:
      mutagen === "禄" || mutagen === "权" || mutagen === "科" || mutagen === "忌"
        ? mutagen
        : undefined,
    brightness: mapBrightness(star.brightness),
  };
}

/**
 * iztro astrolabe → doushu ZiweiChart (structure only, for detectPatterns).
 * hour branch index 0–11; late-zi (iztro 12) already normalized by birthInfoToIztroArgs date+index.
 */
export function iztroAstrolabeToDoushuChart(
  astrolabe: {
    palaces: RawPalace[];
    earthlyBranchOfSoulPalace: string;
    earthlyBranchOfBodyPalace: string;
    fiveElementsClass?: string;
    soul?: string;
    body?: string;
  },
  birth: {
    year: number;
    month: number;
    day: number;
    hourBranch: number;
    gender: "male" | "female";
  },
): DoushuChart {
  const mingGongBranch = BRANCHES.indexOf(
    astrolabe.earthlyBranchOfSoulPalace as (typeof BRANCHES)[number],
  );
  const shenGongBranch = BRANCHES.indexOf(
    astrolabe.earthlyBranchOfBodyPalace as (typeof BRANCHES)[number],
  );
  const palaces: DoushuPalace[] = (astrolabe.palaces as RawPalace[]).map((p) => {
    const branch = BRANCHES.indexOf(p.earthlyBranch as (typeof BRANCHES)[number]);
    const majors = (p.majorStars ?? []).map((s) => mapStar(s, "major"));
    const minors = (p.minorStars ?? []).map((s) => mapStar(s, "minor"));
    const misc = (p.adjectiveStars ?? []).map((s) => mapStar(s, "lucky"));
    return {
      branch: branch >= 0 ? branch : 0,
      stem: 0,
      name: p.name,
      stars: [...majors, ...minors, ...misc].filter((s) => s.name),
      isMingGong: p.name === "命宫",
      isShenGong: p.isBodyPalace,
      isEmpty: majors.length === 0,
    };
  });

  const wuxingMatch = /(\d)/.exec(astrolabe.fiveElementsClass ?? "");
  return {
    birthInfo: {
      year: birth.year,
      month: birth.month,
      day: birth.day,
      hour: Math.max(0, Math.min(11, birth.hourBranch)),
      gender: birth.gender,
    },
    lunarInfo: {
      lunarYear: birth.year,
      lunarMonth: birth.month,
      lunarDay: birth.day,
      yearStem: 0,
      yearBranch: 0,
      isLeapMonth: false,
    },
    mingGongBranch: mingGongBranch >= 0 ? mingGongBranch : 0,
    shenGongBranch: shenGongBranch >= 0 ? shenGongBranch : 0,
    wuxingJu: wuxingMatch ? Number(wuxingMatch[1]) : 3,
    wuxingJuName: astrolabe.fiveElementsClass ?? "",
    ziweiPos: 0,
    palaces,
    daXians: [],
    currentAge: 0,
    currentDaXianIndex: 0,
    mingZhu: astrolabe.soul,
    shenZhu: astrolabe.body,
  };
}

/** Closed-set pattern hits from ziwei-doushu rules (no description prose). */
export function detectZiweiPatternHits(birth: BirthInfo): ZiweiPatternHit[] {
  const args = birthInfoToIztroArgs(birth);
  let timeIndex = args.timeIndex;
  const [y0, m0, d0] = args.solarDate.split("-").map(Number);
  let year = y0!;
  let month = m0!;
  let day = d0!;
  // Vendor / doushu chart hour is 0–11 only; iztro late-zi 12 → next day + 子.
  if (timeIndex === 12) {
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    year = next.getUTCFullYear();
    month = next.getUTCMonth() + 1;
    day = next.getUTCDate();
    timeIndex = 0;
  }
  const gender = args.gender === "女" ? "female" : "male";
  const astrolabe = astro.bySolar(
    `${year}-${month}-${day}`,
    timeIndex,
    args.gender,
    args.fixLeap,
    args.language,
  );
  const chart = iztroAstrolabeToDoushuChart(astrolabe as never, {
    year,
    month,
    day,
    hourBranch: timeIndex,
    gender,
  });
  return detectPatterns(chart).map((p) => ({
    name: p.name,
    level: p.level,
    palaces: [...p.palaces],
    ...(p.conditions?.required?.length ? { required: [...p.conditions.required] } : {}),
    ...(p.conditions?.bonus?.length ? { bonus: [...p.conditions.bonus] } : {}),
    ...(p.conditions?.breaking?.length ? { breaking: [...p.conditions.breaking] } : {}),
    ...(p.source ? { source: p.source } : {}),
  }));
}

/** One-line closed-set summary for S2 thesis/agenda (no prescriptions). */
export function formatPatternHitsSummary(hits: readonly ZiweiPatternHit[], max = 6): string {
  if (!hits.length) return "";
  return hits
    .slice(0, max)
    .map((h) => `${h.name}(${h.level}${h.palaces.length ? `@${h.palaces.join("/")}` : ""})`)
    .join("；");
}
