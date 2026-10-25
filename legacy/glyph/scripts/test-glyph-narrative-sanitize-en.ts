/**
 * English narrative audit — detect-only, no text mutation.
 * Run: pnpm tsx scripts/test-glyph-narrative-sanitize-en.ts
 */
import {
  detectNarrativeSentences,
  sanitizeNarrativeSentences,
} from "@/lib/glyph/sanitize-narrative-sentences";
import {
  auditGlyphReadingContent,
  sanitizeGlyphOutput,
  sanitizeGlyphReadingContent,
} from "@/lib/glyph/sanitize-output";
import type { GlyphReadingContent } from "@/lib/llm/services/glyph-reading-service";

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

function main() {
  console.log("=== narrative sentence detection ===");
  const warrior =
    "This mirrors a warrior who lay still after defeat, escaped, and was recalled.";
  const maxim =
    "Ancient wisdom: 'Widen your heart like the sky and the earth will answer.'";
  assert(detectNarrativeSentences(warrior, "en").length > 0, "flags warrior story");
  assert(detectNarrativeSentences(maxim, "en").length > 0, "flags quoted maxim");

  console.log("\n=== sanitizeNarrativeSentences still available (module-level) ===");
  const { text: replaced } = sanitizeNarrativeSentences(warrior, "en");
  assert(replaced !== warrior, "module-level replace still works if called directly");

  console.log("\n=== audit-only pipeline — text unchanged ===");
  const broken =
    "The emphasis is on your present readiness, not a schedule. ' is met here not with urgency but with patience.";
  const out = sanitizeGlyphOutput(broken, "en");
  assert(out === broken, "sanitizeGlyphOutput returns original text");

  const audited = sanitizeGlyphReadingContent(leakyNarrativeEnglish, "en");
  assert(
    audited.classical_voice === leakyNarrativeEnglish.classical_voice,
    "reading content unchanged",
  );

  const violations = auditGlyphReadingContent(leakyNarrativeEnglish, "en");
  assert(violations.length > 0, "audit flags narrative violations");
  console.log(`violations detected: ${violations.length}`);

  if (process.exitCode) process.exit(1);
  console.log("\nAll English narrative audit checks passed.");
}

main();
