/**
 * Matrix façade compliance smoke.
 *   pnpm exec tsx scripts/test-matrix-facade-compliance.ts
 */
import {
  annualTransitHeadline,
  matrixElementSoft,
  matrixLayerCap,
  matrixSoftTerm,
  stripGanzhiFromLunar,
} from "@/lib/poju/matrix-term-labels";
import {
  elementLabelLocalized,
  formatBranchDisplay,
  formatHiddenStemsDisplay,
  yongshenChipsForLocale,
} from "@/lib/poju/bazi-matrix-mappings";

function assert(label: string, cond: unknown): void {
  if (!cond) {
    console.error("✗", label);
    process.exitCode = 1;
  } else {
    console.log("✓", label);
  }
}

assert("本元 for 日主", matrixSoftTerm("日主", "zh") === "本元");
assert("锚元 for 用神", matrixSoftTerm("用神", "zh") === "锚元");
assert("流展 for 食神", matrixSoftTerm("食神", "zh") === "流展");
assert("框架 for 正官", matrixSoftTerm("正官", "zh") === "框架");
assert("展露 for 沐浴", matrixSoftTerm("沐浴", "zh") === "展露");
assert("纪元 for 大运", matrixSoftTerm("大运", "zh") === "纪元");
assert("岁环 for 流年", matrixSoftTerm("流年", "zh") === "岁环");
assert("layer year zh", matrixLayerCap("year", "zh") === "根基层");
assert("layer day zh", matrixLayerCap("day", "zh") === "本我层");
assert(
  "strip ganzhi year from lunar",
  stripGanzhiFromLunar("丁巳年正月三十", "zh") === "农历正月三十",
);
assert(
  "hidden stems no 藏干 glyph leak",
  !formatHiddenStemsDisplay(["庚", "乙"], "zh").includes("庚") &&
    formatHiddenStemsDisplay(["庚", "乙"], "zh").startsWith("蕴元"),
);
assert("annual no ganzhi", !annualTransitHeadline("Fire", "zh").title.includes("丙"));

// Five-element classic labels — locale-aware
assert("木→木 zh", matrixElementSoft("木", "zh") === "木");
assert("Wood→木 zh", matrixElementSoft("Wood", "zh") === "木");
assert("Fire→火 zh", matrixElementSoft("Fire", "zh") === "火");
assert("Earth→土 zh", matrixElementSoft("Earth", "zh") === "土");
assert("Metal→金 zh", matrixElementSoft("Metal", "zh") === "金");
assert("Water→水 zh", matrixElementSoft("Water", "zh") === "水");
assert("Wood→Wood (木) en", matrixElementSoft("Wood", "en") === "Wood (木)");
assert("Fire→Fire (火) en", matrixElementSoft("Fire", "en") === "Fire (火)");
assert("Earth→Earth (土) en", matrixElementSoft("Earth", "en") === "Earth (土)");
assert("Metal→Metal (金) en", matrixElementSoft("Metal", "en") === "Metal (金)");
assert("Water→Water (水) en", matrixElementSoft("Water", "en") === "Water (水)");
assert("Wood→Madera (木) es", matrixElementSoft("Wood", "es") === "Madera (木)");
assert("Wood→Holz (木) de", matrixElementSoft("Wood", "de") === "Holz (木)");
assert("Wood→Bois (木) fr", matrixElementSoft("Wood", "fr") === "Bois (木)");
assert("金→金 via localized", elementLabelLocalized("金", "zh") === "金");
assert("branch has 木 zh", formatBranchDisplay("寅", "zh").includes("木"));
assert("branch Wood (木) en", formatBranchDisplay("寅", "en").includes("Wood (木)"));
assert(
  "yongshen chips classic zh",
  yongshenChipsForLocale({ elements_en: ["Wood", "Water"] }, "zh").every((c) =>
    ["木", "水"].includes(c.label),
  ),
);
assert("annual Fire→火势", annualTransitHeadline("Fire", "zh").title === "火势");
assert("annual Fire→Fire tide", annualTransitHeadline("Fire", "en").title === "Fire tide");
assert("Core for day_master en", matrixSoftTerm("日主", "en") === "Core");
assert("Núcleo for day_master es", matrixSoftTerm("日主", "es") === "Núcleo");
assert("Kern for day_master de", matrixSoftTerm("日主", "de") === "Kern");
assert("Noyau for day_master fr", matrixSoftTerm("日主", "fr") === "Noyau");

if (process.exitCode) process.exit(1);
console.log("\nAll matrix façade compliance checks passed.");
