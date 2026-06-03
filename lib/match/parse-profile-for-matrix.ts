/**
 * Build calculation input from stored profile + base_analysis (v5.1).
 * Prefer shunshi pillars on UserProfile when base_analysis JSON lacks flat `bazi` fields.
 */

import { splitPillar } from "@/lib/poju/chart-loader-display";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  normalizeBaseAnalysisInput,
  type BaseAnalysisBundle,
} from "@/lib/llm/prompts/base-analysis-context";
import type { UserProfile } from "@/lib/profile/types";
import {
  BRANCHES,
  STEMS,
  type EarthlyBranch,
  type HeavenlyStem,
  type WuXing,
} from "./data/stems-branches";

export type MatrixProfileInput = {
  dayMaster: HeavenlyStem;
  gender: "M" | "F";
  yongShen: WuXing;
  yongShenSecondary?: WuXing;
  branches: Record<"year" | "month" | "day" | "hour", EarthlyBranch>;
  stems: Record<"year" | "month" | "day" | "hour", HeavenlyStem>;
  wuxingDistribution: Record<WuXing, number>;
  currentDayunStem?: string;
  currentDayunBranch?: string;
  dayunRising?: boolean;
};

const WUXING_MAP: Record<string, WuXing> = {
  wood: "木",
  fire: "火",
  earth: "土",
  metal: "金",
  water: "水",
  木: "木",
  火: "火",
  土: "土",
  金: "金",
  水: "水",
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function mapWuXing(raw: unknown): WuXing | undefined {
  if (typeof raw !== "string") return undefined;
  const key = raw.trim().toLowerCase();
  return WUXING_MAP[key] ?? WUXING_MAP[raw.trim()];
}

function pillarsFromUserProfile(profile: UserProfile): {
  stems: MatrixProfileInput["stems"];
  branches: MatrixProfileInput["branches"];
} {
  const y = splitPillar(profile.bazi.yearPillar);
  const m = splitPillar(profile.bazi.monthPillar);
  const d = splitPillar(profile.bazi.dayPillar);
  const h = splitPillar(profile.bazi.hourPillar);

  return {
    stems: {
      year: y.stem as HeavenlyStem,
      month: m.stem as HeavenlyStem,
      day: d.stem as HeavenlyStem,
      hour: h.stem as HeavenlyStem,
    },
    branches: {
      year: y.branch as EarthlyBranch,
      month: m.branch as EarthlyBranch,
      day: d.branch as EarthlyBranch,
      hour: h.branch as EarthlyBranch,
    },
  };
}

function wuxingDistributionFromPillars(
  stems: MatrixProfileInput["stems"],
  branches: MatrixProfileInput["branches"],
): Record<WuXing, number> {
  const dist: Record<WuXing, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const stem of Object.values(stems)) {
    const wx = STEMS[stem]?.wuxing;
    if (wx) dist[wx]++;
  }
  for (const branch of Object.values(branches)) {
    const wx = BRANCHES[branch]?.wuxing;
    if (wx) dist[wx]++;
  }
  return dist;
}

function yongShenFromStructured(structured?: ProfileStructured): WuXing | undefined {
  if (!structured?.yong_shen) return undefined;
  return mapWuXing(structured.yong_shen);
}

function yongShenSecondaryFromStructured(structured?: ProfileStructured): WuXing | undefined {
  const secondary = structured?.xi_shen?.[0];
  if (!secondary) return undefined;
  return mapWuXing(secondary);
}

function daYunFromStructured(
  structured?: ProfileStructured,
  birthYear?: number,
): {
  stem?: string;
  branch?: string;
  is_favorable?: boolean;
} {
  const cycles = structured?.da_yun;
  if (!cycles?.length) return {};

  const currentYear = new Date().getFullYear();
  let current = cycles[0]!;
  for (const cycle of cycles) {
    if (cycle.start_year <= currentYear) current = cycle;
    else break;
  }

  const gz = current.ganzhi.trim();
  if (gz.length < 2) return {};

  return {
    stem: gz[0],
    branch: gz[1],
    is_favorable: birthYear != null ? current.start_year >= birthYear : undefined,
  };
}

function yongShenFromContent(content: Record<string, unknown>, profile?: UserProfile): WuXing {
  const flat = content.yong_shen;
  if (isRecord(flat)) {
    const mapped = mapWuXing(flat.primary_element);
    if (mapped) return mapped;
  }

  const base = content["命主基础"];
  if (isRecord(base)) {
    const ys = base["用神忌神"];
    if (isRecord(ys)) {
      const mapped = mapWuXing(ys["用神"]);
      if (mapped) return mapped;
    }
  }

  const fav = profile?.diagnosis.favorableElements?.[0];
  const fromDiag = mapWuXing(fav);
  if (fromDiag) return fromDiag;

  return "木";
}

function yongShenSecondaryFromContent(content: Record<string, unknown>): WuXing | undefined {
  const flat = content.yong_shen;
  if (isRecord(flat)) {
    return mapWuXing(flat.secondary_element);
  }
  const base = content["命主基础"];
  if (isRecord(base)) {
    const ys = base["用神忌神"];
    if (isRecord(ys)) {
      return mapWuXing(ys["喜神"]);
    }
  }
  return undefined;
}

function daYunFromContent(content: Record<string, unknown>): {
  stem?: string;
  branch?: string;
  is_favorable?: boolean;
} {
  const flat = content.da_yun;
  if (isRecord(flat) && isRecord(flat.current)) {
    return {
      stem: typeof flat.current.stem === "string" ? flat.current.stem : undefined,
      branch: typeof flat.current.branch === "string" ? flat.current.branch : undefined,
      is_favorable:
        typeof flat.current.is_favorable === "boolean" ? flat.current.is_favorable : undefined,
    };
  }

  const cur = content["当前大运详解"];
  if (isRecord(cur) && typeof cur["干支"] === "string") {
    const gz = cur["干支"].trim();
    if (gz.length >= 2) {
      return {
        stem: gz[0],
        branch: gz[1],
        is_favorable: true,
      };
    }
  }
  return {};
}

function flatBaziFromContent(content: Record<string, unknown>): Record<string, string> | null {
  const bazi = content.bazi;
  if (!isRecord(bazi)) return null;
  if (typeof bazi.day_stem !== "string") return null;
  return bazi as Record<string, string>;
}

/** Wrap profile + base_analysis for `calculateCompatibilityMatrix`. */
export function wrapProfileForMatrix(
  user_profile: UserProfile,
  base_analysis: unknown,
): { user_profile: UserProfile; base_analysis: BaseAnalysisBundle } {
  return {
    user_profile,
    base_analysis: normalizeBaseAnalysisInput(base_analysis),
  };
}

export function parseProfileForMatrix(profile: unknown): MatrixProfileInput {
  const p = profile as {
    base_analysis?: BaseAnalysisBundle;
    user_profile?: UserProfile;
  };

  const userProfile = p.user_profile;
  const bundle = p.base_analysis ?? normalizeBaseAnalysisInput(undefined);
  const structured = bundle.structured;
  const content = isRecord(bundle.content)
    ? bundle.content
    : isRecord(p.user_profile)
      ? {}
      : isRecord(profile)
        ? (profile as Record<string, unknown>)
        : {};

  const flatBazi = flatBaziFromContent(content);
  const fromProfile = userProfile ? pillarsFromUserProfile(userProfile) : null;

  const stems: MatrixProfileInput["stems"] = flatBazi
    ? {
        year: (flatBazi.year_stem || fromProfile?.stems.year || "甲") as HeavenlyStem,
        month: (flatBazi.month_stem || fromProfile?.stems.month || "甲") as HeavenlyStem,
        day: (flatBazi.day_stem || fromProfile?.stems.day || "甲") as HeavenlyStem,
        hour: (flatBazi.hour_stem || fromProfile?.stems.hour || "甲") as HeavenlyStem,
      }
    : fromProfile?.stems ?? {
        year: "甲",
        month: "甲",
        day: "甲",
        hour: "甲",
      };

  const branches: MatrixProfileInput["branches"] = flatBazi
    ? {
        year: (flatBazi.year_branch || fromProfile?.branches.year || "子") as EarthlyBranch,
        month: (flatBazi.month_branch || fromProfile?.branches.month || "子") as EarthlyBranch,
        day: (flatBazi.day_branch || fromProfile?.branches.day || "子") as EarthlyBranch,
        hour: (flatBazi.hour_branch || fromProfile?.branches.hour || "子") as EarthlyBranch,
      }
    : fromProfile?.branches ?? {
        year: "子",
        month: "子",
        day: "子",
        hour: "子",
      };

  const gender =
    userProfile?.birth.gender ??
    (content.gender === "M" || content.gender === "F" ? content.gender : "M");

  const wuxingDistribution =
    (isRecord(content.wuxing_distribution)
      ? (content.wuxing_distribution as Record<WuXing, number>)
      : null) ?? wuxingDistributionFromPillars(stems, branches);

  const daYun =
    daYunFromStructured(structured, userProfile?.birth.year) || daYunFromContent(content);

  return {
    dayMaster: stems.day,
    gender,
    yongShen:
      yongShenFromStructured(structured) ??
      yongShenFromContent(content, userProfile),
    yongShenSecondary:
      yongShenSecondaryFromStructured(structured) ?? yongShenSecondaryFromContent(content),
    branches,
    stems,
    wuxingDistribution,
    currentDayunStem: daYun.stem,
    currentDayunBranch: daYun.branch,
    dayunRising: daYun.is_favorable,
  };
}
