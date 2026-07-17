/**
 * Matrix façade compliance smoke.
 *   pnpm exec tsx scripts/test-matrix-facade-compliance.ts
 */
import {
  annualTransitHeadline,
  matrixLayerCap,
  matrixSoftTerm,
  stripGanzhiFromLunar,
} from "@/lib/poju/matrix-term-labels";
import { formatHiddenStemsDisplay } from "@/lib/poju/bazi-matrix-mappings";

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

if (process.exitCode) process.exit(1);
console.log("\nAll matrix façade compliance checks passed.");
