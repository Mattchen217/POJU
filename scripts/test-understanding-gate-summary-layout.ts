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
assert.ok(zh.includes("确认并继续"));
assert.ok(zh.includes("**[确认并继续]**"));
assert.ok(zh.includes("**[补充并修正]**"));
assert.ok(/\n\n/.test(zh));

// Stakes that start with bare「接：」must be softened so they don't glue to prior「不接」.
const glued = withCompleteUnderstanding(
  createInitialAgentState({ original_question: "要不要接海外业务？" }),
);
glued.core_dilemma = {
  concrete_event: "公司要他飞海外；他纠结接还是不接",
  stakes: "接：身体可能崩盘；不接：怕被裁掉",
  sticking_point: null,
};
glued.desired_direction = {
  wants: "找折中过渡",
  priority: null,
};
const polished = buildUnderstandingGateSummaryFromFields(glued, "zh");
assert.ok(polished.includes("如果接："));
assert.ok(polished.includes("如果不接：") || polished.includes("不接"));
assert.ok(!/^接\s*[:：]/m.test(polished.split("### 眼下的处境")[1] ?? ""));
assert.ok(/不接。/.test(polished) || /不接\n/.test(polished) || polished.includes("不接。"));

const en = buildUnderstandingGateSummaryFromFields(agent, "en");
assert.ok(en.includes("### What's holding you"));
assert.ok(en.includes("### Where you want to go"));
assert.ok(!en.includes("Your problem:"));

console.log("test-understanding-gate-summary-layout: ok");
