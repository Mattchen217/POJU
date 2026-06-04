/**
 * English prediction audit — detect-only at pipeline level.
 * Run: pnpm tsx scripts/test-glyph-prediction-sanitize-en.ts
 */
import {
  detectPredictionSentences,
  sanitizePredictionSentences,
} from "@/lib/glyph/sanitize-prediction-sentences";
import {
  auditGlyphReadingContent,
  sanitizeGlyphReadingContent,
} from "@/lib/glyph/sanitize-output";
import type { GlyphReadingContent } from "@/lib/llm/services/glyph-reading-service";

const leakyEnglish: GlyphReadingContent = {
  wind_category_blurb:
    "Fair Sky energy: openness with steady pacing — a reflective mirror for relationship questions.",
  classical_voice:
    "This archetypal metaphor suggests what was hidden is becoming visible in your inner landscape.",
  命理双视角: {
    命理看此事:
      "Your core nature shows a resilient adaptive matrix. The major life cycle you are in favors inner consolidation. Key supporting energy points toward structure and clarity in partnership choices.",
    签文看此事:
      "The metaphor maps to a systemic pattern of renewal after pause. A figure will be seen when the fog thins — focus on signals you can notice now.",
    两者印证或冲突:
      "Both lenses agree: readiness matters more than timing labels. You will meet someone when outer noise drops — stay with present awareness.",
  },
  meaning_for_question:
    "Regarding remarriage, this is not a schedule. Yet you will meet a partner next month if you stay open — that line crosses into prediction and should be removed.",
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
  const samples = [
    "A figure will be seen on your path next month.",
    "You will meet someone when the time is right.",
    "This reflection will help you notice patterns in the present.",
    "Planning next month is useful for logistics, not destiny.",
  ];

  console.log("=== sentence detection ===");
  for (const s of samples) {
    const hits = detectPredictionSentences(s, "en");
    console.log(`"${s}" → ${hits.length} hit(s)`);
  }
  assert(detectPredictionSentences(samples[0]!, "en").length > 0, "flags will be seen sentence");
  assert(detectPredictionSentences(samples[1]!, "en").length > 0, "flags will meet sentence");
  assert(detectPredictionSentences(samples[2]!, "en").length === 0, "allows will help (non-prediction)");
  assert(detectPredictionSentences(samples[3]!, "en").length === 0, "allows planning next month alone");

  console.log("\n=== module-level sentence sanitize (direct call only) ===");
  const { text } = sanitizePredictionSentences(samples[0]!, "en");
  assert(text !== samples[0], "direct module call can still replace");

  console.log("\n=== audit-only pipeline — reading unchanged ===");
  const audited = sanitizeGlyphReadingContent(leakyEnglish, "en");
  assert(
    audited.命理双视角.两者印证或冲突 === leakyEnglish.命理双视角.两者印证或冲突,
    "text unchanged by pipeline",
  );

  const violations = auditGlyphReadingContent(leakyEnglish, "en");
  const predictionLeft = violations.filter((v) => v.category === "prediction");
  assert(predictionLeft.length > 0, "audit flags prediction violations");
  console.log(`prediction violations: ${predictionLeft.length}`);

  if (process.exitCode) process.exit(1);
  console.log("\nAll English prediction audit checks passed.");
}

main();
