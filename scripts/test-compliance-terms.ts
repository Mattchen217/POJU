/**
 * compliance-terms — audit-only + term marking architecture.
 * Run: pnpm tsx scripts/test-compliance-terms.ts
 */
import {
  auditBareGanzhi,
  auditDeliveredText,
  auditTermMarkerDensity,
  encodeTermMarker,
  parseTermMarkers,
  stripBrokenMarkers,
  stripGlossTokensForPrompt,
  stripMarkersForPrompt,
  sanitizeChatResponse,
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
  const marked = `Your ⟦t:day_master|core nature (乙木)|You grow through people, not force⟧ seeks balance.`;
  const parsed = parseTermMarkers(marked);
  assert(parsed.length === 1, "parse one marker");
  assert(parsed[0]!.id === "day_master", "marker id");
  assert(parsed[0]!.visible === "core nature (乙木)", "marker visible");
  assert(parsed[0]!.plain === "You grow through people, not force", "marker dynamic plain");

  const legacy2 = `Your ⟦t:day_master|core nature (乙木)⟧ seeks balance.`;
  assert(parseTermMarkers(legacy2).length === 1, "parse legacy 2-part marker");

  console.log("\n=== strip for prompt history ===");
  assert(
    stripMarkersForPrompt(marked) === "Your core nature (乙木) seeks balance.",
    "stripMarkersForPrompt drops dynamic plain",
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

  const intact2 = "Your ⟦t:day_master|core nature (乙木)⟧ thrives.";
  assert(
    stripBrokenMarkers(intact2) === "Your core nature (乙木) thrives.",
    "closed 2-part marker becomes visible when stripping",
  );

  console.log("\n=== bare sign poem audit (en) ===");
  const poem = "The theme echoes 志气功业在朝朝，今将酒色不胜饶 in tone.";
  const poemAudit = auditDeliveredText(poem, "en");
  assert(poemAudit.some((v) => v.label === "bare_sign_poem"), "detects bare sign poem");

  console.log("\n=== bare ganzhi audit (en) ===");
  const barePhase = "Your early twenties (癸酉 phase) felt restless.";
  const bareAudit = auditDeliveredText(barePhase, "en");
  assert(
    bareAudit.some((v) => v.label === "bare_ganzhi"),
    "EN audit catches bare 癸酉 outside markers",
  );
  assert(auditBareGanzhi(barePhase).length === 1, "auditBareGanzhi direct hit");

  const markedPhase = `Your early twenties (${encodeTermMarker("decade", "life phase (癸酉)", "a refining metal decade")}) felt restless.`;
  assert(
    auditBareGanzhi(markedPhase).length === 0,
    "marked 癸酉 inside marker is not bare",
  );
  assert(
    auditDeliveredText(markedPhase, "en").every((v) => v.label !== "bare_ganzhi"),
    "delivered audit passes marked ganzhi",
  );

  console.log("\n=== term marker density audit ===");
  const dense = `**Lead:** ${encodeTermMarker("day_master", "core (乙木)", "vine growth")} ${encodeTermMarker("ten_god", "peer (比肩)", "allies")} ${encodeTermMarker("element", "wood (木)", "flexible")} extra.`;
  const densityHits = auditTermMarkerDensity(dense);
  assert(densityHits.some((h) => h.label.startsWith("term_density:")), "density > 2 warns");
  assert(
    auditDeliveredText(dense, "en").some((h) => h.label.startsWith("term_density:")),
    "delivered audit includes density hits",
  );

  console.log("\n=== chat sanitize (audit-only) ===");
  const bareTerms = "命局带食神，丁酉年有转机，偏印大运需留意。";
  const sanitized = sanitizeChatResponse(bareTerms, "zh");
  assert(sanitized === bareTerms, "sanitizeChatResponse does not mutate text");
  assert(sanitized.includes("食神"), "食神 preserved");
  assert(sanitized.includes("丁酉"), "丁酉 preserved");

  console.log("\n=== hidden stem dump audit (en) ===");
  const stemDump =
    "Hidden stems (Wu earth, Xin metal, Gui water) dominate this branch.";
  const stemAudit = auditDeliveredText(stemDump, "en");
  assert(
    stemAudit.some((v) => v.label === "hidden_stem_dump"),
    "detects hidden-stem English dump",
  );

  TERM_MARKER_PATTERN.lastIndex = 0;
  assert(
    TERM_MARKER_PATTERN.test(encodeTermMarker("year", "year's energy (丙午)", "Heat pushing you to act")),
    "encode 3-part pattern",
  );

  if (process.exitCode) process.exit(1);
  console.log("\nAll compliance-terms checks passed.");
}

main();
