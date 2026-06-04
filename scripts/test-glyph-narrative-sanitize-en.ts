/**
 * English narrative + broken-tail sanitize — Defense 2 + sentence-boundary replace.
 * Run: pnpm tsx scripts/test-glyph-narrative-sanitize-en.ts
 */
import {
  detectNarrativeSentences,
  sanitizeNarrativeSentences,
} from "@/lib/glyph/sanitize-narrative-sentences";
import { polishSanitizedText } from "@/lib/glyph/sanitize-sentence-utils";
import {
  auditGlyphReadingContent,
  sanitizeGlyphOutput,
  sanitizeGlyphReadingContent,
} from "@/lib/glyph/sanitize-output";
import type { GlyphReadingContent } from "@/lib/llm/services/glyph-reading-service";
import { detectComplianceViolations } from "@/lib/llm/sanitize/compliance-terms";

const leakyNarrativeEnglish: GlyphReadingContent = {
  wind_category_blurb:
    "Fair Sky energy: openness with steady pacing — a reflective mirror for relationship questions.",
  classical_voice:
    "This mirrors a warrior who lay still after defeat, escaped captivity, and was recalled when the realm needed steadiness again.",
  命理双视角: {
    命理看此事:
      "Your core nature shows a resilient adaptive matrix. The major life cycle you are in favors inner consolidation.",
    签文看此事:
      "Ancient wisdom: 'Widen your heart like the sky and the earth will answer in its season.' That line is not a schedule.",
    两者印证或冲突:
      "Both lenses agree: readiness matters more than timing labels. A figure who was defeated, captured, and later recalled mirrors your pause before re-emergence.",
  },
  meaning_for_question:
    "Regarding remarriage, this is not a schedule. ' is met here not with urgency but with patient widening of perspective.",
  hidden_tension:
    "You may treat waiting as passive when the mirror asks for active self-definition right now.",
  your_moment:
    "In this moment, the connection is forming through small honest choices, not a countdown.",
  exploration: {
    text: "Tonight, write three qualities you want to embody before inviting anyone closer. 10 minutes, solo.",
    timeframe: "tonight",
    duration_estimate: "10 minutes",
    is_solo: true,
  },
  reflection_question:
    "What becomes clearer about your present readiness when you stop asking when?",
};

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error("✗", msg);
    process.exitCode = 1;
  } else {
    console.log("✓", msg);
  }
}

function hasOrphanQuote(text: string): boolean {
  return (
    /\.\s*['"]\s+[a-z]/i.test(text) ||
    /(?:^|[.!?]\s+)['"]\s+[a-z]/i.test(text) ||
    /\s['"]\s+is\b/i.test(text)
  );
}

function hasStoryPlot(text: string): boolean {
  return (
    /\b(?:a|the)\s+(?:warrior|figure|hero)\s+who\b/i.test(text) ||
    /\b(?:defeated|captured|escaped|recalled)\b.*\b(?:defeated|captured|escaped|recalled)\b/i.test(text)
  );
}

function hasQuotedMaxim(text: string): boolean {
  return (
    /(?:ancient wisdom|the saying|classical verse)[:\s,—-]+['"]/i.test(text) ||
    /['"][^'"]{10,}['"]/.test(text)
  );
}

function hasPrediction(text: string): boolean {
  return (
    /\b(?:you|someone|a\s+partner|they|he|she|people|a\s+figure)\s+will\s+(?:meet|marry|get|be|appear|arrive|find|encounter|discover|see|have|become)\b/i.test(
      text,
    ) || /\bwill\s+(?:meet|marry|get\s+married|appear|arrive|find|encounter|discover|be\s+(?:seen|met|found))\b/i.test(text)
  );
}

function main() {
  console.log("=== narrative sentence detection ===");
  const warrior =
    "This mirrors a warrior who lay still after defeat, escaped, and was recalled.";
  const maxim =
    "Ancient wisdom: 'Widen your heart like the sky and the earth will answer.'";
  assert(detectNarrativeSentences(warrior, "en").length > 0, "flags warrior story");
  assert(detectNarrativeSentences(maxim, "en").length > 0, "flags quoted maxim");

  console.log("\n=== narrative sentence sanitize ===");
  for (const s of [warrior, maxim]) {
    const { text } = sanitizeNarrativeSentences(s, "en");
    console.log("BEFORE:", s);
    console.log("AFTER: ", text);
    assert(!hasStoryPlot(text), `no story plot: "${text}"`);
    assert(!hasQuotedMaxim(text), `no quoted maxim: "${text}"`);
    assert(!hasOrphanQuote(text), `no orphan quote: "${text}"`);
  }

  console.log("\n=== polish orphan quote tail (regression) ===");
  const broken =
    "The emphasis is on your present readiness, not a schedule. ' is met here not with urgency but with patience.";
  const polished = polishSanitizedText(broken);
  console.log("BEFORE:", broken);
  console.log("AFTER: ", polished);
  assert(!hasOrphanQuote(polished), "polish removes orphan quote tail");
  assert(!/\.\s+is met here\b/i.test(polished), "polish removes headless is-met tail");

  console.log("\n=== sanitizeGlyphOutput broken tail (no partial mask) ===");
  const sanitizedTail = sanitizeGlyphOutput(broken, "en");
  console.log("AFTER: ", sanitizedTail);
  assert(!hasOrphanQuote(sanitizedTail), "full sanitize has no orphan quote");
  assert(!/\.\s+is met here\b/i.test(sanitizedTail), "full sanitize has no headless tail");

  console.log("\n=== full English reading sanitize ===");
  const sanitized = sanitizeGlyphReadingContent(leakyNarrativeEnglish, "en");
  const merged = [
    sanitized.classical_voice,
    sanitized.命理双视角.签文看此事,
    sanitized.命理双视角.两者印证或冲突,
    sanitized.meaning_for_question,
    sanitized.your_moment,
  ].join("\n\n");

  console.log("\n--- English output (sanitized) ---\n");
  console.log(merged);

  assert(!hasOrphanQuote(merged), "no orphan quotes in output");
  assert(!/\.\s+is met here\b/i.test(merged), "no headless tail sentences");
  assert(!hasStoryPlot(merged), "no warrior/figure story plots");
  assert(!hasQuotedMaxim(merged), "no quoted maxims");
  assert(!hasPrediction(merged), "no will+future predictions");

  const complianceLeft = detectComplianceViolations(merged, "en").filter(
    (v) =>
      v.label.startsWith("quoted_") ||
      v.label.startsWith("warrior_") ||
      v.label.startsWith("story_sequence"),
  );
  assert(complianceLeft.length === 0, "compliance EN narrative audit clean");

  const remaining = auditGlyphReadingContent(sanitized, "en");
  const narrativeLeft = remaining.filter((v) => v.category === "sign_narrative");
  const predictionLeft = remaining.filter((v) => v.category === "prediction");
  console.log(`\nre-audit narrative violations: ${narrativeLeft.length}`);
  console.log(`re-audit prediction violations: ${predictionLeft.length}`);

  if (process.exitCode) process.exit(1);
  console.log("\nAll English narrative sanitize checks passed.");
}

main();
