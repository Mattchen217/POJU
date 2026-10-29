/**
 * Locale flip-book render + chat placement.
 *   pnpm exec tsx scripts/test-delivery-user-facing.ts
 */
import assert from "node:assert/strict";

import { localizeEvidenceGlue } from "../lib/poju/localize-evidence-glue";
import {
  extractFaceSchemaSlices,
  isInternalEngineInventoryModule,
  prepareUserFacingDeliveryMarkdown,
  relabelDeliveryMarkdownChrome,
} from "../lib/poju/delivery-user-facing";
import { isCenterChatReportDump } from "../lib/poju/center-chat-transcript";
import { stripPageSchemaFence } from "../lib/llm/pro/delivery/page-schema/render";

const schema = {
  version: 1,
  page: {
    page: "decision_brief",
    page_title: "Should I stay",
    core_judgment: "Stay, but cap the hours.",
    primary: {
      name: "Hold the seat",
      core_logic: "Keep the role and cut the night work.",
      why: "The load is the hours, not the title.",
      when: "While the review is open",
      chart_anchors: ["丙午"],
    },
    backup: {
      name: "Step back",
      core_logic: "Leave if the review slips.",
      why: "A second path keeps the decision reversible.",
      when: "If the date moves",
      chart_anchors: ["壬水"],
    },
  },
};

const markdown = `## Decision Brief

\`\`\`poju-page-schema
${JSON.stringify(schema)}
\`\`\`

### 核心判定

Stay, but cap the hours.

**Evidence & reasoning:**
⟦t:era|⟧在机制上衔接⟦t:dew|⟧由此引动 the window.

## Execution Guidance

\`\`\`poju-page-schema
${JSON.stringify({
  version: 1,
  page: {
    page: "situation_analysis",
    page_title: "Why it sticks",
    why_cards: [
      {
        title: "Hours",
        surface: "Nights run long",
        essence: "The review eats the evening",
        chart_anchors: ["午火"],
      },
    ],
  },
})}
\`\`\`

### 表象

Nights run long
`;

const slices = extractFaceSchemaSlices(markdown);
assert.equal(slices.length, 2);
assert.equal(slices[0]?.schema.page, "decision_brief");
assert.equal(slices[1]?.schema.page, "situation_analysis");
assert.equal(slices[1]?.evidence.length, 1);

const labeled = relabelDeliveryMarkdownChrome("### 核心判定\n\n**表象:** nights\n\n### 红灯 1", "en");
assert.equal(labeled.includes("核心判定"), false);
assert.equal(labeled.includes("表象"), false);
assert.match(labeled, /### Core judgment/);
assert.match(labeled, /\*\*Surface:\*\*/);
assert.match(labeled, /### Red light 1/);
assert.match(relabelDeliveryMarkdownChrome("### 核心判定", "zh"), /核心判定/);
assert.match(relabelDeliveryMarkdownChrome("### 金句", "fr"), /Phrase d'ancrage/);

const cleaned = prepareUserFacingDeliveryMarkdown(markdown, "en");
assert.equal(cleaned.includes("poju-page-schema"), false);
assert.equal(cleaned.includes("丙午"), false);
assert.equal(cleaned.includes("## Decision Brief"), false);
assert.equal(cleaned.includes("核心判定"), false);
assert.match(cleaned, /### Core judgment/);

const unclosed = stripPageSchemaFence("hello\n```poju-page-schema\n{\"page\":{");
assert.equal(unclosed.includes("poju-page-schema"), false);
assert.match(unclosed, /hello/);

const glued = localizeEvidenceGlue("Era在机制上衔接Dew由此引动 the window", "en");
assert.equal(glued.includes("在机制上衔接"), false);
assert.equal(glued.includes("由此引动"), false);
assert.match(glued, /Era/);
assert.match(glued, /Dew/);
assert.equal(
  localizeEvidenceGlue("大运在机制上衔接流年", "zh").includes("在机制上衔接"),
  true,
);

assert.equal(
  isInternalEngineInventoryModule(
    "Engine inventory",
    "- 十神: 正印\n- 神煞: 天乙",
    "en",
  ),
  true,
);
assert.equal(
  isInternalEngineInventoryModule("Engine inventory", "- 十神: 正印", "zh"),
  false,
);
assert.equal(
  isInternalEngineInventoryModule("Path snapshot", "Stay in the role.", "en"),
  false,
);

assert.equal(
  isCenterChatReportDump({
    role: "assistant",
    content: "# Energy Decision Report\n\n" + "x".repeat(500),
    meta: { contains_delivery: true },
  }),
  true,
);
assert.equal(
  isCenterChatReportDump({
    role: "assistant",
    content: "Confirm and continue",
  }),
  false,
);
assert.equal(
  isCenterChatReportDump({
    role: "user",
    content: "# Energy Decision Report\n" + "x".repeat(500),
    meta: { contains_delivery: true },
  }),
  false,
);

console.log("test-delivery-user-facing: ok");
