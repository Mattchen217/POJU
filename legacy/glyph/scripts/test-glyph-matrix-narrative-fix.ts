import assert from "node:assert/strict";

import { parseMatrixNarrativeResponseText } from "@/lib/llm/prompts/matrix-narrative-prompt";

function ok(label: string) {
  console.log(`  ✓ ${label}`);
}

const validPoju = JSON.stringify({
  elemental_breakdown: { caption: "Your chart anchors in steady earth with a quiet fire undertone." },
  structural_dynamics: {
    resonance: "Day master stem gives you a grounded public face.",
    tension: "Branch clashes invite you to notice reactive habits.",
    reading: "Practice pausing before you commit when pressure rises.",
  },
  annual_transit_2026: {
    title: "Yang Fire / 丙午",
    description:
      "2026 invites reflection on how you spend creative energy. It suggests a season of recalibrating priorities rather than forcing outcomes.",
  },
  poju_onboarding: {
    archetype_intro: "You lead with patient observation and selective action.",
    core_conflict: "Abundant metal can make you critique before you connect.",
    call_to_action:
      "Tell me the dilemma you are weighing now — type it in the box below and send, and we will unpack it together.",
  },
});

parseMatrixNarrativeResponseText(validPoju, "poju");
ok("parses clean poju JSON");

parseMatrixNarrativeResponseText(`\`\`\`json\n${validPoju}\n\`\`\``, "poju");
ok("parses fenced JSON");

parseMatrixNarrativeResponseText(
  `model scratch work\n${validPoju}`,
  "poju",
);
ok("strips thinking wrapper before parse");

const truncated = validPoju.slice(0, validPoju.length - 40);
parseMatrixNarrativeResponseText(truncated, "poju");
ok("salvages truncated JSON");

const glyphJson = JSON.stringify({
  ...JSON.parse(validPoju),
  guide: "Name the one decision you want clarity on — type it below and send before you draw.",
  poju_onboarding: {
    ...JSON.parse(validPoju).poju_onboarding,
    call_to_action: "",
  },
});
parseMatrixNarrativeResponseText(glyphJson, "glyph");
ok("parses glyph JSON with guide");

console.log("\nAll glyph matrix-narrative fix checks passed.");
