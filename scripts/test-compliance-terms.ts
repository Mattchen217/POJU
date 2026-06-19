/**
 * compliance-terms output-side sanitize checks.
 * Run: pnpm tsx scripts/test-compliance-terms.ts
 */
import {
  applyComplianceSanitize,
  detectComplianceViolations,
  encodeGlossToken,
  EN_TERM_MAP,
  GLOSS_TOKEN_PATTERN,
  stripGlossTokensForPrompt,
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

  console.log("\n=== ZH bazi — replaced with gloss tokens ===");
  const zhInput = "你日主丙火，大运癸酉，用神为土";
  const zh = applyComplianceSanitize(zhInput, "zh");
  assert(zh.text !== zhInput, "zh text changed");
  assert(zh.text.includes("⟦g|"), "zh contains gloss token");
  assert(!zh.text.includes("日主"), "zh no bare 日主");
  assert(!zh.text.includes("大运"), "zh no bare 大运");

  console.log("\n=== daily words preserved ===");
  assert(
    detectComplianceViolations("木桌和 fire alarm 都正常", "zh").length === 0,
    "zh daily 木桌 ok",
  );
  assert(
    detectComplianceViolations("wood table and fire alarm are fine", "en").length === 0,
    "en daily wood/fire ok",
  );

  console.log("\n=== EN Day Master — gloss token ===");
  const enInput = "Your Day Master is Yi Wood with favorable Metal.";
  const en = applyComplianceSanitize(enInput, "en");
  assert(en.text.includes("⟦g|"), "en gloss token");
  assert(!/\bDay Master\b/i.test(en.text), "en no bare Day Master");

  console.log("\n=== gloss round-trip for prompt history ===");
  const token = encodeGlossToken("核心特质", "plain text");
  const wrapped = `Hello ${token} world`;
  assert(stripGlossTokensForPrompt(wrapped) === "Hello 核心特质 world", "strip gloss for prompt");
  GLOSS_TOKEN_PATTERN.lastIndex = 0;
  assert(GLOSS_TOKEN_PATTERN.test(token), "token pattern matches");

  console.log("\n=== EN Five Elements personality — allowed ===");
  const woodInput =
    "Your Wood-like nature seeks growth; balance excess Fire with grounding Earth.";
  assert(
    detectComplianceViolations(woodInput, "en").length === 0,
    "en Wood/Fire/Earth personality ok",
  );

  if (process.exitCode) process.exit(1);
  console.log("\nAll compliance-terms checks passed.");
}

main();
