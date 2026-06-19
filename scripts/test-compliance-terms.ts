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
  parseGlossTokens,
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

  console.log("\n=== ZH bazi — localized gloss tokens ===");
  const zhInput = "你日主丙火，大运癸酉，流年丙午，用神为土";
  const zh = applyComplianceSanitize(zhInput, "zh");
  assert(zh.text !== zhInput, "zh text changed");
  assert(zh.text.includes("⟦g|"), "zh contains gloss token");
  assert(!zh.text.includes("日主"), "zh no bare 日主");
  assert(!zh.text.includes("大运"), "zh no bare 大运");
  assert(zh.text.includes("核心特质（丙火）") || zh.text.includes("核心特质（丙"), "zh day master label");
  assert(zh.text.includes("人生阶段（癸酉）"), "zh dayun label");
  assert(zh.text.includes("流年能量（丙午）"), "zh liunian label (not 人生阶段)");

  console.log("\n=== daily words preserved ===");
  assert(
    detectComplianceViolations("木桌和 fire alarm 都正常", "zh").length === 0,
    "zh daily 木桌 ok",
  );
  assert(
    detectComplianceViolations("wood table and fire alarm are fine", "en").length === 0,
    "en daily wood/fire ok",
  );

  console.log("\n=== EN Day Master — English label + hanzi ===");
  const enInput = "Your Day Master is 乙木 with favorable Metal.";
  const en = applyComplianceSanitize(enInput, "en");
  assert(en.text.includes("⟦g|"), "en gloss token");
  assert(!/\bDay Master\b/i.test(en.text), "en no bare Day Master");
  const enTokens = parseGlossTokens(en.text);
  const yiWood = enTokens.find((t) => t.display.includes("乙木"));
  assert(Boolean(yiWood), "en has 乙木 token");
  assert(
    yiWood!.display.includes("core nature (乙木)"),
    `en day master display localized: ${yiWood?.display}`,
  );
  assert(!yiWood!.display.includes("核心特质"), "en display no zh label");

  console.log("\n=== EN double-translation collapse ===");
  const doubleInput =
    "represented by life phase theme (核心特质（乙木）) in your profile / personality profile";
  const collapsed = applyComplianceSanitize(doubleInput, "en");
  assert(!collapsed.text.includes("life phase theme"), "no model euphemism left");
  assert(!collapsed.text.includes("profile / personality profile"), "no profile euphemism");
  assert(!collapsed.text.includes("核心特质（"), "no nested zh label in en");

  console.log("\n=== gloss round-trip for prompt history ===");
  const token = encodeGlossToken("core nature (乙木)", "plain text");
  const wrapped = `Hello ${token} world`;
  assert(stripGlossTokensForPrompt(wrapped) === "Hello core nature (乙木) world", "strip gloss for prompt");
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
