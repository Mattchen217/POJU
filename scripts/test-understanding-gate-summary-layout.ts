/**
 * Understanding-gate summary layout (### + warm paragraphs).
 *   pnpm exec tsx scripts/test-understanding-gate-summary-layout.ts
 */
import assert from "node:assert/strict";
import {
  buildUnderstandingGateSummaryFromFields,
} from "@/lib/poju/understanding-gate-reply";
import {
  createInitialAgentState,
  withCompleteUnderstanding,
} from "@/lib/poju/agent-state";

const agent = withCompleteUnderstanding(
  createInitialAgentState({ original_question: "要不要接海外业务？" }),
);

const zh = buildUnderstandingGateSummaryFromFields(agent, "zh");
assert.ok(zh.includes("### 你卡住的事"));
assert.ok(zh.includes("### 眼下的处境"));
assert.ok(zh.includes("### 你想去的方向"));
assert.ok(!zh.includes("你的问题是："));
assert.ok(!zh.includes("情况是："));
assert.ok(zh.includes("对，就是这样"));
assert.ok(/\n\n/.test(zh));

const en = buildUnderstandingGateSummaryFromFields(agent, "en");
assert.ok(en.includes("### What's holding you"));
assert.ok(en.includes("### Where you want to go"));
assert.ok(!en.includes("Your problem:"));

console.log("test-understanding-gate-summary-layout: ok");
