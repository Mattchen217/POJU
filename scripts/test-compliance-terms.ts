/**
 * compliance-terms — audit-only + term marking architecture.
 * Run: pnpm tsx scripts/test-compliance-terms.ts
 */
import {
  auditDeliveredText,
  encodeTermMarker,
  parseTermMarkers,
  stripBrokenMarkers,
  stripGlossTokensForPrompt,
  stripMarkersForPrompt,
  TERM_MARKER_PATTERN,
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
  console.log("=== term markers ===");
  const marked = `Your ⟦t:day_master|core nature (乙木)⟧ seeks balance.`;
  const parsed = parseTermMarkers(marked);
  assert(parsed.length === 1, "parse one marker");
  assert(parsed[0]!.id === "day_master", "marker id");
  assert(parsed[0]!.visible === "core nature (乙木)", "marker visible");

  console.log("\n=== strip for prompt history ===");
  assert(
    stripMarkersForPrompt(marked) === "Your core nature (乙木) seeks balance.",
    "stripMarkersForPrompt",
  );
  const legacy = `Hello ⟦g|core nature (乙木)|plain⟧ world`;
  assert(
    stripGlossTokensForPrompt(legacy) === "Hello core nature (乙木) world",
    "strip legacy gloss",
  );

  console.log("\n=== audit-only (no mutation) ===");
  const raw = "Your Day Master is 乙木 with favorable Metal.";
  const audit = auditDeliveredText(raw, "en");
  assert(raw.includes("Day Master"), "text not mutated");
  assert(audit.some((v) => v.label.startsWith("term:")), "audit catches bare Day Master");

  console.log("\n=== broken marker strip ===");
  const broken = "See ⟦t:day_master|core nature (乙木) broken";
  const fixed = stripBrokenMarkers(broken);
  assert(!fixed.includes("⟦"), "no raw delimiter after strip");
  assert(fixed.includes("core nature (乙木)"), "visible text preserved");

  console.log("\n=== bare sign poem audit (en) ===");
  const poem = "The theme echoes 志气功业在朝朝，今将酒色不胜饶 in tone.";
  const poemAudit = auditDeliveredText(poem, "en");
  assert(poemAudit.some((v) => v.label === "bare_sign_poem"), "detects bare sign poem");

  TERM_MARKER_PATTERN.lastIndex = 0;
  assert(TERM_MARKER_PATTERN.test(encodeTermMarker("year", "year's energy (丙午)")), "encode pattern");

  if (process.exitCode) process.exit(1);
  console.log("\nAll compliance-terms checks passed.");
}

main();
