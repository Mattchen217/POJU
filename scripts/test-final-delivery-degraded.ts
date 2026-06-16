/**
 * Step 4 — degraded final-delivery prompt smoke tests.
 * Run: npx tsx scripts/test-final-delivery-degraded.ts
 */
import { createInitialAgentState } from "@/lib/poju/agent-state";
import {
  buildFinalDeliveryPrompt,
  parseDeliverySections,
  resolveDeliveryMode,
} from "@/lib/llm/pro/final-delivery";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const agent = {
  ...createInitialAgentState({ original_question: "我该不该换工作？" }),
  question_category: "career" as const,
  delivery_mode: "degraded" as const,
  current_phase: "delivered" as const,
};

assert(resolveDeliveryMode({ agent_v2: agent }) === "degraded", "resolve from agent_v2");
assert(resolveDeliveryMode({ agent_v2: agent, delivery_mode: "full" }) === "full", "explicit full wins");

const { system, user, delivery_mode } = buildFinalDeliveryPrompt({
  base_analysis: { 格局: "示例", 用神: "木" },
  situation_analysis: null,
  agent_v2: agent,
  locale: "zh-CN",
  delivery_mode: "degraded",
});

assert(delivery_mode === "degraded", "prompt mode degraded");
assert(system.includes("degraded 模式"), "system mentions degraded mode");
assert(system.includes("重命盘、轻具体处境"), "chart-forward rule");
assert(system.includes("诚实声明"), "honesty declaration rule");
assert(system.includes("偏低风险"), "low-risk actions rule");
assert(system.includes("禁预测具体未来"), "compliance retained");
assert(user.includes("degraded"), "user hint degraded");
assert(!system.includes("用户已确认情境汇总"), "full-only intro absent");

const full = buildFinalDeliveryPrompt({
  base_analysis: { x: 1 },
  situation_analysis: { y: 2 },
  agent_v2: { ...agent, delivery_mode: "full" },
  locale: "en",
  delivery_mode: "full",
});
assert(full.delivery_mode === "full", "full mode");
assert(full.system.includes("full 模式"), "full task block");
assert(full.system.includes("亲口说过的具体细节"), "full specific actions rule");

const sampleDegraded = `
═══ ANALYSIS ═══
Chart-based analysis here.

═══ CONCLUSION ═══
Directional summary.

═══ WHAT TO DO ═══
### Action 1: Observe the pattern
Write for one week.

Profile basis: Wood element support.

═══ COMING BACK ═══
If you share more later, we can refine.
`;
const sec = parseDeliverySections(sampleDegraded);
assert(sec.analysis.length > 0 && sec.whatToDo.length > 0 && sec.comingBack.length > 0, "four sections parse");

console.log("test-final-delivery-degraded: all passed");
