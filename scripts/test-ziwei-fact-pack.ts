/**
 * W1 · ZiweiFactPack structure + Phase 2 display mapping.
 * Run: node ./node_modules/tsx/dist/cli.mjs scripts/test-ziwei-fact-pack.ts
 *    or pnpm test:ziwei-fact-pack
 */
import type { BirthInfo } from "../lib/profile/types";
import { sliceForPage } from "../lib/llm/pro/delivery/page-feed-matrix";
import {
  birthInfoToIztroArgs,
  buildZiweiDisplayFactPack,
  buildZiweiFactPack,
  hourToIztroTimeIndex,
  ZIWEI_RUNTIME_PALACES,
  ZIWEI_ZFP_KEY_SET,
  ziweiDisplayContainsTraditionalLeak,
  ziweiTokenDisposition,
} from "../lib/ziwei";
import { resolvePojuTerm } from "../lib/glossary/term-resolve";
import { TERM_NS_AVAILABILITY } from "../lib/glossary/term-ns";

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

assert(first.source.library === "ziwei-doushu", "main chain library ziwei-doushu");
assert(first.source.chart_engine === "iztro", "chart still iztro");
assert(first.source.license === "MIT", "MIT");
assert(
  Object.keys(ZIWEI_ZFP_KEY_SET).sort().join(",") ===
    "daxian,mingShen,otherChart,patternHits,sihua,topicPalace",
  "ZFP keys",
);
assert(first.otherChart === null, "joint stub empty");
assert(Array.isArray(first.patternHits), "patternHits array");
assert(
  first.patternHits.every(
    (h) =>
      typeof h.name === "string" &&
      h.name.length > 0 &&
      !("description" in h),
  ),
  "patternHits closed-set (no description)",
);
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
assert(slice.zfpOmitted === false, "pack keeps zfp");
const topic = slice.slice.zfp?.topicPalace;
assert(typeof topic === "object", "02 topicPalace object");
assert(
  typeof topic === "object" && topic.palace === "核心定位域",
  "02 topicPalace soft-maps 命宫",
);
assert(
  typeof topic === "object" && !topic.majorStars.includes("紫微"),
  "02 majorStars never traditional (Phase 10)",
);
assert(!JSON.stringify(slice.slice.zfp?.sihua).includes("天同"), "02 sihua no traditional star");
assert(
  JSON.stringify(slice.slice.zfp?.sihua).includes("摩擦转化") ||
    JSON.stringify(slice.slice.zfp?.sihua).includes("资源转化"),
  "02 sihua soft mutagen labels",
);
assert(!JSON.stringify(slice.slice).includes("破军"), "02 omits mingShen traditional");
assert(!JSON.stringify(slice.slice).includes("木三局"), "02 omits 五行局 value");
assert(
  !/"palaces"\s*:\s*\[/.test(JSON.stringify(slice.slice.zfp ?? {})) ||
    Boolean(slice.slice.zfp?.patternHits),
  "twelve-palace index is not a slice field (patternHits.palaces ok)",
);
assert(!("palaces" in (slice.slice.zfp ?? {})), "ZFP.palaces index omitted from slice");
assert(!("source" in (slice.slice.zfp ?? {})), "pack source meta stays off the slice");
if (first.patternHits.length > 0) {
  assert(
    Array.isArray(slice.slice.zfp?.patternHits) &&
      (slice.slice.zfp?.patternHits?.length ?? 0) > 0,
    "02 copies patternHits",
  );
  assert(
    !JSON.stringify(slice.slice.zfp?.patternHits).includes("description"),
    "slice patternHits drop prose",
  );
  for (const hit of first.patternHits) {
    assert(
      !JSON.stringify(slice.slice.zfp?.patternHits).includes(hit.name),
      `slice must not leak pattern name ${hit.name}`,
    );
  }
  assert(
    slice.slice.zfp?.patternHits?.every((h) => typeof h.hit_id === "string" && h.hit_id.length > 0),
    "patternHits use hit_id",
  );
}
// Internal FactPack still traditional
assert(first.topicPalace.majorStars.includes("紫微"), "raw FactPack keeps 紫微");

const slice03 = sliceForPage("03", { zfp: first });
assert(slice03.zfpOmitted === false, "03 keeps zfp");
assert(slice03.slice.zfp?.mingShen != null, "03 has mingShen");

// --- Phase 2 display adapter ---
assert(TERM_NS_AVAILABILITY.ziwei === "active", "ziwei ns active");
assert(
  first.palaces.some((p) => p.name === "仆役"),
  "runtime keeps 仆役 (do not normalize to 交友)",
);
assert(
  ZIWEI_RUNTIME_PALACES.includes("仆役"),
  "inventory lists 仆役",
);

const display = buildZiweiDisplayFactPack(first, "zh");
assert(display.otherChart === null, "display keeps otherChart null");
assert(
  display.topicPalace.palace.status === "resolved" &&
    display.topicPalace.palace.slug === "zw_identity_field",
  "命宫 → zw_identity_field",
);
assert(
  display.sihua.every((h) => h.mutagen.status === "resolved"),
  "四化 mutagens resolve via 禄/权/科/忌 aliases",
);
assert(
  display.topicPalace.majorStars.every((s) => s.status === "resolved"),
  "Phase 11 major stars resolve via SSOT",
);
assert(
  ziweiTokenDisposition("仆役").status === "public_glossary",
  "仆役 public_glossary after Phase 11",
);
assert(
  ziweiTokenDisposition("紫微").status === "public_glossary",
  "紫微 public_glossary after Phase 11",
);
assert(
  resolvePojuTerm("紫微", { namespace: "ziwei" }).status === "resolved",
  "紫微@ziwei SSOT",
);
assert(
  resolvePojuTerm("化忌", { namespace: "ziwei" }).status === "resolved",
  "化忌 glossary present",
);

const leaks = ziweiDisplayContainsTraditionalLeak(display, first);
assert(leaks.length === 0, `display must not leak traditional tokens: ${leaks.join(",")}`);

for (const loc of ["zh", "en", "es", "de", "fr"] as const) {
  const d = buildZiweiDisplayFactPack(first, loc);
  assert(
    d.topicPalace.palace.status === "resolved" && d.topicPalace.palace.label.trim().length > 0,
    `five-locale label non-empty (${loc})`,
  );
}

// Inventory across ≥10 births (unique palace set stable)
const inventoryBirths: BirthInfo[] = [
  GOLDEN_BIRTH,
  { ...GOLDEN_BIRTH, year: 1990, month: 1, day: 1, hour: 0, gender: "M" },
  { ...GOLDEN_BIRTH, year: 1985, month: 6, day: 15, hour: 12, gender: "F" },
  { ...GOLDEN_BIRTH, year: 1975, month: 12, day: 31, hour: 23, gender: "M" },
  { ...GOLDEN_BIRTH, year: 2005, month: 3, day: 8, hour: 8, gender: "F" },
  { ...GOLDEN_BIRTH, year: 1968, month: 9, day: 22, hour: 18, gender: "M" },
  { ...GOLDEN_BIRTH, year: 1995, month: 2, day: 14, hour: 6, gender: "F" },
  { ...GOLDEN_BIRTH, year: 1988, month: 11, day: 11, hour: 22, gender: "M" },
  { ...GOLDEN_BIRTH, year: 1955, month: 4, day: 20, hour: 10, gender: "M" },
  { ...GOLDEN_BIRTH, year: 2001, month: 5, day: 5, hour: 16, gender: "F" },
];
const seenPalaces = new Set<string>();
for (const b of inventoryBirths) {
  const pack = buildZiweiFactPack(b, { asOf: GOLDEN_AS_OF });
  for (const p of pack.palaces) seenPalaces.add(p.name);
  const d = buildZiweiDisplayFactPack(pack, "zh");
  assert(
    ziweiDisplayContainsTraditionalLeak(d, pack).length === 0,
    `no leak for birth ${b.year}`,
  );
}
assert(seenPalaces.has("仆役"), "inventory across births still sees 仆役");
assert(seenPalaces.size === 12, `twelve palace names closed (${seenPalaces.size})`);

console.log("ziwei-fact-pack W1+doushu+display ok", {
  hits: first.patternHits.length,
  displayResolved: display.audit.resolved,
  displayBlocked: display.audit.blocked,
});
