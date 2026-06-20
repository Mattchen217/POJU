/**
 * Delivery grammar polish — conservative a/an + duplicate-word audit.
 * Run: pnpm tsx scripts/test-delivery-grammar-polish.ts
 */
import { encodeTermMarker } from "@/lib/llm/sanitize/compliance-terms";
import { polishDeliveryGrammar } from "@/lib/llm/sanitize/delivery-grammar-polish";
import { buildDeliveryGrammarPolishBlock } from "@/lib/llm/prompts/delivery-grammar-polish";

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error("✗", msg);
    process.exitCode = 1;
  } else {
    console.log("✓", msg);
  }
}

function main() {
  console.log("=== a → an (safe) ===");
  const inner = polishDeliveryGrammar("You carry a inner sharpness that cuts clutter.", "en");
  assert(inner.text.includes("an inner"), "a inner → an inner");
  assert(!inner.text.includes("a inner"), "no a inner left");

  const hour = polishDeliveryGrammar("Wait a hour before deciding.", "en");
  assert(hour.text.includes("an hour"), "a hour → an hour");

  const unique = polishDeliveryGrammar("Take a unique angle on the offer.", "en");
  assert(unique.text.includes("a unique"), "a unique unchanged");

  const uni = polishDeliveryGrammar("Find a university mentor this week.", "en");
  assert(uni.text.includes("a university"), "a university unchanged");

  console.log("\n=== markers preserved ===");
  const marked = encodeTermMarker("fei_ren", "double-edged drive", "Channel it");
  const withMarker = polishDeliveryGrammar(
    `You have a inner edge and ${marked} helps.`,
    "en",
  );
  assert(withMarker.text.includes(marked), "marker intact");
  assert(withMarker.text.includes("an inner edge"), "plain segment fixed");

  console.log("\n=== duplicate word warn (no auto-fix) ===");
  const dup = polishDeliveryGrammar("This is is a test.", "en");
  assert(dup.hits.some((h) => h.kind === "duplicate_word"), "detects duplicate is");

  console.log("\n=== zh skip ===");
  const zh = polishDeliveryGrammar("这是一个测试。", "zh");
  assert(zh.text === "这是一个测试。", "zh unchanged");

  console.log("\n=== prompt block ===");
  const block = buildDeliveryGrammarPolishBlock("en");
  assert(block.includes("an inner sharpness"), "prompt mentions an inner sharpness");
  assert(block.includes("**en**"), "prompt includes output lang");

  if (process.exitCode) process.exit(1);
  console.log("\nAll delivery-grammar-polish checks passed.");
}

main();
