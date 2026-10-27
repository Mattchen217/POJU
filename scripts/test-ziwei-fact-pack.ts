/**
 * W1 · ZiweiFactPack structure.
 * Run: pnpm exec tsx scripts/test-ziwei-fact-pack.ts
 *    or pnpm test:ziwei-fact-pack
 */
import type { BirthInfo } from "../lib/profile/types";
import { sliceForPage } from "../lib/llm/pro/delivery/page-feed-matrix";
import { birthInfoToIztroArgs, buildZiweiFactPack, hourToIztroTimeIndex, ZIWEI_ZFP_KEY_SET } from "../lib/ziwei";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const GOLDEN_BIRTH: BirthInfo = {
  year: 2000,
  month: 8,
  day: 16,
  hour: 4,
  minute: 30,
  hour_period: "yin",
  gender: "F",
  timezone: "Asia/Shanghai",
};
const GOLDEN_AS_OF = "2026-10-27";

assert(hourToIztroTimeIndex(0) === 0, "早子 → 0");
assert(hourToIztroTimeIndex(4) === 2, "寅 → 2");
assert(hourToIztroTimeIndex(15) === 8, "申 → 8");
assert(hourToIztroTimeIndex(23) === 12, "晚子 → 12");

const civil = birthInfoToIztroArgs(GOLDEN_BIRTH);
assert(civil.solarDate === "2000-8-16", "civil solar date");
assert(civil.timeIndex === 2, "寅时 index");
assert(civil.gender === "女", "F → 女");
assert(civil.clock === "civil", "no coordinates stays civil");
assert(civil.fixLeap === true, "leap fix on");
assert(civil.language === "zh-CN", "zh-CN names");

const lateZi = birthInfoToIztroArgs({ ...GOLDEN_BIRTH, hour: 23, hour_period: "zi_early" });
assert(lateZi.timeIndex === 12, "23:00 is 晚子 index 12");

const fromMeta = birthInfoToIztroArgs({
  ...GOLDEN_BIRTH,
  tst_meta: {
    original_date: "2000-08-16",
    original_time: "04:30",
    true_solar_date: "2000-08-17",
    true_solar_time: "00:10",
    diff_minutes: 40,
    longitude: 130,
    timezone: "Asia/Shanghai",
    computation_version: "v2_with_tst",
  },
});
assert(fromMeta.clock === "tst_meta", "existing tst_meta wins");
assert(fromMeta.solarDate === "2000-8-17", "tst date crosses midnight");
assert(fromMeta.timeIndex === 0, "00:10 is 早子");

const inland: BirthInfo = {
  year: 1990,
  month: 8,
  day: 16,
  hour: 15,
  minute: 10,
  hour_period: "shen",
  gender: "F",
  timezone: "Asia/Shanghai",
  birth_location: { name: "Inland", longitude: 100, timezone: "Asia/Shanghai" },
};
const shifted = birthInfoToIztroArgs(inland);
const inlandCivil = birthInfoToIztroArgs({ ...inland, birth_location: undefined });
assert(shifted.clock === "true_solar", "longitude uses true solar clock");
assert(inlandCivil.timeIndex === 8, "civil 15:10 stays 申");
assert(shifted.timeIndex === 6, "longitude 100 pulls this clock to 午");
assert(shifted.solarDate === "1990-8-16", "this shift stays on the same date");

const first = buildZiweiFactPack(GOLDEN_BIRTH, { asOf: GOLDEN_AS_OF });
const second = buildZiweiFactPack(GOLDEN_BIRTH, { asOf: GOLDEN_AS_OF });
assert(JSON.stringify(first) === JSON.stringify(second), "same birth twice is stable");

assert(first.source.library === "iztro" && first.source.version === "2.6.3", "iztro 2.6.3");
assert(first.source.license === "MIT", "MIT");
assert(Object.keys(ZIWEI_ZFP_KEY_SET).sort().join(",") === "daxian,mingShen,otherChart,sihua,topicPalace", "ZFP keys");
assert(first.otherChart === null, "joint stub empty");
assert(first.palaces.length === 12, "twelve palaces");
assert(first.topicPalace.role === "ming", "topic defaults to ming");
assert(first.topicPalace.earthlyBranch === "午", "命宫在午");
assert(first.topicPalace.majorStars.join(",") === "紫微", "命宫紫微");
assert(first.topicPalace.oppositePalace === "迁移", "对宫迁移");
assert(first.topicPalace.oppositeMajorStars.join(",") === "贪狼", "对宫贪狼");
assert(first.mingShen.soul === "破军", "命主破军");
assert(first.mingShen.body === "文昌", "身主文昌");
assert(first.mingShen.shenPalace === "官禄", "身宫在官禄");
assert(first.mingShen.fiveElementsClass === "木三局", "木三局");
assert(
  first.sihua.map((hit) => `${hit.mutagen}:${hit.star}@${hit.palace}`).join("|") ===
    "禄:太阳@子女|权:武曲@财帛|科:太阴@仆役|忌:天同@疾厄",
  "natal sihua",
);
assert(first.daxian.palace === "夫妻", "2026 decadal palace");
assert(first.daxian.startAge === 23 && first.daxian.endAge === 32, "decadal ages 23-32");
assert(first.daxian.majorStars.join(",") === "七杀", "decadal major star");
assert(first.daxian.liunian.year === 2026, "liunian year");
assert(first.daxian.liunian.heavenlyStem + first.daxian.liunian.earthlyBranch === "丙午", "2026 丙午");
assert(first.daxian.liunian.sihua.find((hit) => hit.mutagen === "忌")?.palace === "官禄", "流年化忌落官禄");

const younger = buildZiweiFactPack(GOLDEN_BIRTH, { asOf: "2010-1-1" });
assert(younger.topicPalace.majorStars.join(",") === "紫微", "natal stars ignore asOf");
assert(younger.daxian.palace === "命宫" && younger.daxian.startAge === 3, "2010 is the first decadal");
assert(younger.daxian.liunian.heavenlyStem + younger.daxian.liunian.earthlyBranch === "己丑", "2010 己丑");

const slice = sliceForPage("02", { zfp: first });
assert(slice.zfpOmitted === false, "pack keeps zfp slots");
assert(slice.slice.zfp?.topicPalace === null, "stub does not copy topicPalace");
assert(slice.slice.zfp?.sihua === null, "stub does not copy sihua");
assert(!JSON.stringify(slice.slice).includes("紫微"), "slice stays empty of star names");

console.log("ziwei-fact-pack W1 ok");
