/**
 * compliance-terms + daily-word safety checks.
 * Run: pnpm tsx scripts/test-compliance-terms.ts
 */
import {
  applyComplianceSanitize,
  detectComplianceViolations,
  EN_TERM_MAP,
  ZH_TERM_MAP,
} from "@/lib/llm/sanitize/compliance-terms";

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error("✗", msg);
    process.exitCode = 1;
  } else {
    console.log("✓", msg);
  }
}

function main() {
  console.log("=== maps exported ===");
  assert(Object.keys(EN_TERM_MAP).length > 40, `EN_TERM_MAP ${Object.keys(EN_TERM_MAP).length} entries`);
  assert(Object.keys(ZH_TERM_MAP).length > 40, `ZH_TERM_MAP ${Object.keys(ZH_TERM_MAP).length} entries`);

  console.log("\n=== ZH bazi combos ===");
  const zh = applyComplianceSanitize("命局喜土金，贵人显，日主乙木", "zh");
  assert(!zh.text.includes("喜土金"), "no 喜土金");
  assert(!zh.text.includes("贵人"), "no 贵人");
  assert(!zh.text.includes("日主"), "no 日主");
  assert(!zh.text.includes("乙木"), "no 乙木");

  console.log("\n=== daily words preserved ===");
  assert(
    detectComplianceViolations("木桌和 fire alarm 都正常", "zh").length === 0,
    "zh daily 木桌 ok",
  );
  assert(
    detectComplianceViolations("wood table and fire alarm are fine", "en").length === 0,
    "en daily wood/fire ok",
  );

  console.log("\n=== EN bazi combos ===");
  const en = applyComplianceSanitize("Your Day Master is Yi Wood with favorable Metal.", "en");
  assert(!/Day Master/i.test(en.text), "no Day Master");
  assert(!/Yi Wood/i.test(en.text), "no Yi Wood");
  assert(!/favorable Metal/i.test(en.text), "no favorable Metal");

  if (process.exitCode) process.exit(1);
  console.log("\nAll compliance-terms checks passed.");
}

main();
