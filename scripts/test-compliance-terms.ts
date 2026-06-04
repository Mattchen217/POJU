/**
 * compliance-terms audit-only checks.
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

  console.log("\n=== ZH bazi combos — detect only, text unchanged ===");
  const zhInput = "命局喜土金，贵人显，日主乙木";
  const zh = applyComplianceSanitize(zhInput, "zh");
  assert(zh.text === zhInput, "zh text unchanged");
  assert(zh.violationsBefore.length > 0, "zh violations detected");

  console.log("\n=== daily words preserved ===");
  assert(
    detectComplianceViolations("木桌和 fire alarm 都正常", "zh").length === 0,
    "zh daily 木桌 ok",
  );
  assert(
    detectComplianceViolations("wood table and fire alarm are fine", "en").length === 0,
    "en daily wood/fire ok",
  );

  console.log("\n=== EN bazi combos — detect only, text unchanged ===");
  const enInput = "Your Day Master is Yi Wood with favorable Metal.";
  const en = applyComplianceSanitize(enInput, "en");
  assert(en.text === enInput, "en text unchanged");
  assert(en.violationsBefore.length > 0, "en violations detected");

  if (process.exitCode) process.exit(1);
  console.log("\nAll compliance-terms checks passed.");
}

main();
