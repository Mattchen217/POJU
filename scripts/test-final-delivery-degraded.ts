/**
 * Phase 4 delivery smoke tests — dual-key schema, merge, parse A–F.
 * Run: npx tsx scripts/test-final-delivery-degraded.ts
 *
 * Avoid importing `@/lib/llm/pro/final-delivery` (pulls UI/spline via prompt stack).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import { makeTestBreakthroughCore } from "@/lib/poju/test-breakthrough-core-fixture";
import {
  fillMissingDeliverySegments,
  validateDeliveryComputed,
  DELIVERY_SEGMENT_KEYS,
} from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_TASKS } from "@/lib/llm/pro/delivery/delivery-tasks";
import { mergeDeliveryToMarkdown } from "@/lib/llm/pro/delivery/merge-delivery-markdown";
import { DELIVERY_FINALIZE_TASK } from "@/lib/llm/pro/delivery/finalize-prompt";
import { parseDeliveryContent } from "@/lib/poju/parse-delivery";
import { formatBreakthroughCoreForFinalize } from "@/lib/llm/pro/delivery/format-spine-for-finalize";
import type { DeliveryMode } from "@/lib/poju/collection-progress";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function resolveDeliveryMode(input: {
  delivery_mode?: DeliveryMode | null;
  agent_v2: { delivery_mode?: DeliveryMode | null };
}): DeliveryMode {
  if (input.delivery_mode === "full" || input.delivery_mode === "degraded") return input.delivery_mode;
  return input.agent_v2.delivery_mode === "degraded" ? "degraded" : "full";
}

const agent = {
  ...createInitialAgentState({ original_question: "我该不该换工作？" }),
  question_category: "career" as const,
  delivery_mode: "degraded" as const,
  current_phase: "delivered" as const,
};

assert(resolveDeliveryMode({ agent_v2: agent }) === "degraded", "resolve from agent_v2");
assert(resolveDeliveryMode({ agent_v2: agent, delivery_mode: "full" }) === "full", "explicit full wins");

const core = makeTestBreakthroughCore({
  situation_conclusion: "命盘七杀透而身弱，卡在不敢转行的结构性犹豫。",
  modern_action_frames: [
    {
      direction: "顺势试探新机会",
      why_fits: "七杀透月宜在压力下验证新路径",
      structural_basis: "month.ten_god=七杀",
      needs_validation: "是否已有具体 offer",
      status: "selected",
    },
    {
      direction: "守势稳住现金流",
      why_fits: "身弱先守再进",
      structural_basis: "strength=weak",
      needs_validation: "负债与 runway",
      status: "weakened",
    },
  ],
});

const spineDump = formatBreakthroughCoreForFinalize(core);
assert(spineDump.includes("situation_conclusion"), "spine dump has situation");
assert(spineDump.includes("[selected]"), "spine dump shows selected status");
assert(spineDump.includes("[weakened]"), "spine dump shows weakened status");

assert(DELIVERY_FINALIZE_TASK.includes("双钥匙"), "finalize task dual-key");
assert(DELIVERY_FINALIZE_TASK.includes("reinforced"), "finalize filters status");
assert(DELIVERY_FINALIZE_TASK.includes("不重新算命盘"), "no chart recompute");

assert(DELIVERY_TASKS.length === 4, "4 delivery tasks");
assert(
  DELIVERY_TASKS.map((t) => t.paths.join(",")).join("|") === "A,B|C|D|E,F",
  "task path split A,B|C|D|E,F",
);

const dualKey = fillMissingDeliverySegments({
  A: { core_conclusion: "你卡在不敢动的结构点。", bazi_basis: ["七杀", "身弱"] },
  B: { core_conclusion: "真正分岔是先稳还是先冲。", bazi_basis: ["印星"] },
  C: { core_conclusion: "先把五年经验系统化再谈跳槽。", bazi_basis: ["食神"] },
});
const validated = validateDeliveryComputed(dualKey);
assert(validated.ok, "validate filled delivery computed");

const narrative = Object.fromEntries(
  DELIVERY_SEGMENT_KEYS.map((k) => [k, `正文${k}：${dualKey[k].core_conclusion}`]),
);
const evidence = Object.fromEntries(
  DELIVERY_SEGMENT_KEYS.map((k) => [
    k,
    dualKey[k].bazi_basis.length
      ? `依据靠 ⟦t:shi_shen|⟧ 等支撑。`
      : "本段依据待补。",
  ]),
);
const md = mergeDeliveryToMarkdown(narrative, evidence, "zh");
assert(md.includes("## A ·"), "merge has A heading");
assert(md.includes("## F ·"), "merge has F heading");
assert(md.includes("**依据与推理:**"), "merge has evidence lead");
assert(!md.includes("═══ ANALYSIS"), "no legacy ANALYSIS marker");

const sections = parseDeliveryContent(md);
assert(sections.length >= 6, `parsed ${sections.length} sections`);
assert(sections.every((s) => DELIVERY_SEGMENT_KEYS.includes(s.type)), "section keys A-F");

const delivery = {
  delivered_at: new Date().toISOString(),
  language: "zh",
  full_text: md,
};
assert(typeof delivery.full_text === "string" && delivery.full_text.includes("## A"), "POJUDelivery full_text");
assert(!("analysis" in delivery), "no legacy analysis field");

const route = readFileSync(resolve(__dirname, "../app/api/poju/final-delivery/route.ts"), "utf8");
assert(route.includes("runDeliveryReport"), "route uses runDeliveryReport");
assert(!route.includes("buildFinalDeliveryPrompt"), "route no longer uses old single prompt");

console.log("test-final-delivery-degraded: all passed");
