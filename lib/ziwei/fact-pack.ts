/**
 * ZiweiFactPack · 紫微结构事实（W1）。
 *
 * 顶层 ZFP 键与 `page-feed-matrix.ts` 的 FEED.ZFP 短名一致，没有第二套 remap。
 * 只留宫、主星、四化、大限/流年结构。不写批断，不抄库内性格句，不填规则卡。
 * `otherChart` 固定 null（joint 不在本波）。
 * `palaces` 是十二宫主星索引，供以后按题改 topicPalace，本身不是矩阵字段。
 */

import { astro } from "iztro";
import { version as iztroVersion } from "iztro/package.json";
import type { ZfpShortKey } from "@/lib/llm/pro/delivery/page-feed-matrix";
import type { BirthInfo } from "@/lib/profile/types";
import { birthInfoToIztroArgs, type ZiweiClockSource } from "@/lib/ziwei/birth-clock";
import {
  detectZiweiPatternHits,
  DOUSHU_PATTERNS_COMMIT,
  DOUSHU_PATTERNS_LIBRARY,
  type ZiweiPatternHit,
} from "@/lib/ziwei/doushu-adapter";

export type { ZiweiPatternHit };

const MUTAGEN_ORDER = ["禄", "权", "科", "忌"] as const;
export type ZiweiMutagen = (typeof MUTAGEN_ORDER)[number];

export type ZiweiSihuaHit = {
  mutagen: ZiweiMutagen;
  star: string;
  palace: string;
};

/** ZFP.topicPalace。无题目时钉在命宫，并带对宫主星作结构张力。 */
export type ZiweiTopicPalace = {
  role: "ming";
  palace: string;
  heavenlyStem: string;
  earthlyBranch: string;
  majorStars: string[];
  oppositePalace: string;
  oppositeMajorStars: string[];
};

/** ZFP.daxian。年龄与宫星是结构；不生成「主题一句」。 */
export type ZiweiDaxian = {
  palace: string;
  heavenlyStem: string;
  earthlyBranch: string;
  startAge: number;
  endAge: number;
  majorStars: string[];
  sihua: ZiweiSihuaHit[];
  liunian: {
    year: number;
    heavenlyStem: string;
    earthlyBranch: string;
    palace: string;
    sihua: ZiweiSihuaHit[];
  };
};

/** ZFP.mingShen。命主/身主与命宫/身宫短钉。 */
export type ZiweiMingShen = {
  soul: string;
  body: string;
  mingBranch: string;
  shenBranch: string;
  shenPalace: string;
  fiveElementsClass: string;
};

export type ZiweiPalaceFact = {
  name: string;
  heavenlyStem: string;
  earthlyBranch: string;
  majorStars: string[];
  isBodyPalace: boolean;
  decadalRange: [number, number];
};

export type ZiweiFactLibrary = "ziwei-doushu" | "iztro";

export type ZiweiFactSource = {
  /** Main chain: ziwei-doushu patterns on iztro chart. Fallback: iztro-only. */
  library: ZiweiFactLibrary;
  version: string;
  license: "MIT";
  solarDate: string;
  timeIndex: number;
  gender: "男" | "女";
  fixLeap: true;
  clock: ZiweiClockSource;
  asOf: string;
  /** Chart structure engine (iztro) when library is ziwei-doushu. */
  chart_engine?: "iztro";
  patterns_commit?: string;
};

export type ZiweiFactPack = {
  topicPalace: ZiweiTopicPalace;
  sihua: ZiweiSihuaHit[];
  daxian: ZiweiDaxian;
  mingShen: ZiweiMingShen;
  otherChart: null;
  /** Closed-set pattern hits (name/level/palaces/conditions) — no description prose. */
  patternHits: ZiweiPatternHit[];
  palaces: ZiweiPalaceFact[];
  source: ZiweiFactSource;
};

/** 与 PageFeedMatrix `FEED.ZFP` 短名一一对应。缺任何一键，这里过不了类型检查。 */
export const ZIWEI_ZFP_KEY_SET: Record<ZfpShortKey, true> = {
  topicPalace: true,
  sihua: true,
  daxian: true,
  mingShen: true,
  otherChart: true,
  patternHits: true,
};

/** Env `ZIWEI_ENGINE=iztro` → skip doushu patterns (对照/回退). */
export function resolveZiweiEngine(): ZiweiFactLibrary {
  const raw = (typeof process !== "undefined" ? process.env.ZIWEI_ENGINE : undefined)
    ?.trim()
    .toLowerCase();
  return raw === "iztro" ? "iztro" : "ziwei-doushu";
}

export type ZiweiFactPackZfp = Pick<ZiweiFactPack, ZfpShortKey>;

type NamedStar = { name?: string; mutagen?: string };

type RawPalace = {
  index: number;
  name: string;
  heavenlyStem: string;
  earthlyBranch: string;
  isBodyPalace: boolean;
  majorStars: NamedStar[];
  minorStars: NamedStar[];
  decadal: { range: [number, number] };
};

function starNames(stars: NamedStar[]): string[] {
  return stars.map((star) => star.name?.trim() ?? "").filter((name) => name.length > 0);
}

function isMutagen(value: string | undefined): value is ZiweiMutagen {
  return value != null && (MUTAGEN_ORDER as readonly string[]).includes(value);
}

function natalSihua(palaces: RawPalace[]): ZiweiSihuaHit[] {
  const hits: ZiweiSihuaHit[] = [];
  for (const palace of palaces) {
    for (const star of [...palace.majorStars, ...palace.minorStars]) {
      const name = star.name?.trim() ?? "";
      if (!name || !isMutagen(star.mutagen)) continue;
      hits.push({ mutagen: star.mutagen, star: name, palace: palace.name });
    }
  }
  return hits.sort((a, b) => MUTAGEN_ORDER.indexOf(a.mutagen) - MUTAGEN_ORDER.indexOf(b.mutagen));
}

function palaceOfStar(palaces: RawPalace[], starName: string): string {
  for (const palace of palaces) {
    const names = starNames([...palace.majorStars, ...palace.minorStars]);
    if (names.includes(starName)) return palace.name;
  }
  return "";
}

function sihuaFromStars(starNamesInOrder: string[], palaces: RawPalace[]): ZiweiSihuaHit[] {
  return starNamesInOrder.slice(0, MUTAGEN_ORDER.length).flatMap((star, index) => {
    const name = star.trim();
    const mutagen = MUTAGEN_ORDER[index];
    if (!name || !mutagen) return [];
    return [{ mutagen, star: name, palace: palaceOfStar(palaces, name) }];
  });
}

export function asOfSolarDate(asOf?: string | Date): string {
  if (asOf instanceof Date) {
    return `${asOf.getUTCFullYear()}-${asOf.getUTCMonth() + 1}-${asOf.getUTCDate()}`;
  }
  if (typeof asOf === "string" && asOf.trim()) {
    const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(asOf.trim());
    if (!match) throw new Error(`ZiweiFactPack asOf must be YYYY-MM-DD, received ${asOf}`);
    return `${Number(match[1])}-${Number(match[2])}-${Number(match[3])}`;
  }
  const now = new Date();
  return `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
}

export type BuildZiweiFactPackOptions = {
  /** 大限/流年所看的阳历日。不传则用当前 UTC 日期。两次同参调用结果相同。 */
  asOf?: string | Date;
};

/**
 * 由出生信息排紫微结构包。同 BirthInfo + 同 asOf → 同一 JSON。
 * 失败时抛出，不回填空宫。
 */
export function buildZiweiFactPack(birth: BirthInfo, options?: BuildZiweiFactPackOptions): ZiweiFactPack {
  const args = birthInfoToIztroArgs(birth);
  const asOf = asOfSolarDate(options?.asOf);
  const engine = resolveZiweiEngine();
  const chart = astro.bySolar(args.solarDate, args.timeIndex, args.gender, args.fixLeap, args.language);
  const palaces = chart.palaces as RawPalace[];
  const ming = palaces.find((palace) => palace.name === "命宫");
  if (!ming) throw new Error("ZiweiFactPack: 命宫 missing");
  const opposite = palaces.find((palace) => palace.index === (ming.index + 6) % 12);
  const shen = palaces.find((palace) => palace.isBodyPalace);
  const horoscope = chart.horoscope(asOf);
  const decadalPalace = palaces[horoscope.decadal.index];
  const yearlyPalace = palaces[horoscope.yearly.index];
  if (!decadalPalace || !yearlyPalace) throw new Error("ZiweiFactPack: decadal or yearly palace missing");

  const patternHits =
    engine === "ziwei-doushu" ? detectZiweiPatternHits(birth) : [];

  const pack: ZiweiFactPack = {
    topicPalace: {
      role: "ming",
      palace: ming.name,
      heavenlyStem: ming.heavenlyStem,
      earthlyBranch: ming.earthlyBranch,
      majorStars: starNames(ming.majorStars),
      oppositePalace: opposite?.name ?? "",
      oppositeMajorStars: opposite ? starNames(opposite.majorStars) : [],
    },
    sihua: natalSihua(palaces),
    daxian: {
      palace: decadalPalace.name,
      heavenlyStem: horoscope.decadal.heavenlyStem,
      earthlyBranch: horoscope.decadal.earthlyBranch,
      startAge: decadalPalace.decadal.range[0],
      endAge: decadalPalace.decadal.range[1],
      majorStars: starNames(decadalPalace.majorStars),
      sihua: sihuaFromStars(horoscope.decadal.mutagen as string[], palaces),
      liunian: {
        year: Number(asOf.slice(0, 4)),
        heavenlyStem: horoscope.yearly.heavenlyStem,
        earthlyBranch: horoscope.yearly.earthlyBranch,
        palace: yearlyPalace.name,
        sihua: sihuaFromStars(horoscope.yearly.mutagen as string[], palaces),
      },
    },
    mingShen: {
      soul: chart.soul,
      body: chart.body,
      mingBranch: chart.earthlyBranchOfSoulPalace,
      shenBranch: chart.earthlyBranchOfBodyPalace,
      shenPalace: shen?.name ?? "",
      fiveElementsClass: chart.fiveElementsClass,
    },
    otherChart: null,
    patternHits,
    palaces: palaces.map((palace) => ({
      name: palace.name,
      heavenlyStem: palace.heavenlyStem,
      earthlyBranch: palace.earthlyBranch,
      majorStars: starNames(palace.majorStars),
      isBodyPalace: palace.isBodyPalace,
      decadalRange: [palace.decadal.range[0], palace.decadal.range[1]],
    })),
    source: {
      library: engine,
      version:
        engine === "ziwei-doushu"
          ? `${DOUSHU_PATTERNS_LIBRARY}@${DOUSHU_PATTERNS_COMMIT}+iztro@${iztroVersion}`
          : iztroVersion,
      license: "MIT",
      solarDate: args.solarDate,
      timeIndex: args.timeIndex,
      gender: args.gender,
      fixLeap: true,
      clock: args.clock,
      asOf,
      ...(engine === "ziwei-doushu"
        ? {
            chart_engine: "iztro" as const,
            patterns_commit: DOUSHU_PATTERNS_COMMIT,
          }
        : {}),
    },
  };
  return pack;
}
