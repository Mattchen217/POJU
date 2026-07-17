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

// Five-element soft labels — locale-aware
assert("木→舒展 zh", matrixElementSoft("木", "zh") === "舒展");
assert("Wood→舒展 zh", matrixElementSoft("Wood", "zh") === "舒展");
assert("Fire→发散 zh", matrixElementSoft("Fire", "zh") === "发散");
assert("Earth→承托 zh", matrixElementSoft("Earth", "zh") === "承托");
assert("Metal→精练 zh", matrixElementSoft("Metal", "zh") === "精练");
assert("Water→润流 zh", matrixElementSoft("Water", "zh") === "润流");
assert("Wood→Growth en", matrixElementSoft("Wood", "en") === "Growth");
assert("Fire→Radiance en", matrixElementSoft("Fire", "en") === "Radiance");
assert("Earth→Grounding en", matrixElementSoft("Earth", "en") === "Grounding");
assert("Metal→Refinement en", matrixElementSoft("Metal", "en") === "Refinement");
assert("Water→Fluidity en", matrixElementSoft("Water", "en") === "Fluidity");
assert("Wood→Crecimiento es", matrixElementSoft("Wood", "es") === "Crecimiento");
assert("Wood→Wachstum de", matrixElementSoft("Wood", "de") === "Wachstum");
assert("Wood→Croissance fr", matrixElementSoft("Wood", "fr") === "Croissance");
assert("金→精练 via localized", elementLabelLocalized("金", "zh") === "精练");
assert("no bare Wood in branch zh", !formatBranchDisplay("寅", "zh").includes("木"));
assert("branch soft Growth en", formatBranchDisplay("寅", "en").includes("Growth"));
assert(
  "yongshen chips soft zh",
  yongshenChipsForLocale({ elements_en: ["Wood", "Water"] }, "zh").every((c) =>
    ["舒展", "润流"].includes(c.label),
  ),
);
assert("annual Fire→发散势", annualTransitHeadline("Fire", "zh").title === "发散势");
assert("annual Fire→Radiance tide", annualTransitHeadline("Fire", "en").title === "Radiance tide");
assert("Core for day_master en", matrixSoftTerm("日主", "en") === "Core");
assert("Núcleo for day_master es", matrixSoftTerm("日主", "es") === "Núcleo");
assert("Kern for day_master de", matrixSoftTerm("日主", "de") === "Kern");
assert("Noyau for day_master fr", matrixSoftTerm("日主", "fr") === "Noyau");

if (process.exitCode) process.exit(1);
console.log("\nAll matrix façade compliance checks passed.");
