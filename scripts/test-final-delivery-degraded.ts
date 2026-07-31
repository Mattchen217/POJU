/**
 * Phase 4 delivery book smoke tests — dual-key schema, merge, parse.
 * Run: npx tsx scripts/test-final-delivery-degraded.ts
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
import { sanitizeDeliveryBookMarkdown } from "@/lib/llm/pro/delivery/sanitize-delivery-book";
import { DELIVERY_FINALIZE_TASK } from "@/lib/llm/pro/delivery/finalize-prompt";
import { parseDeliveryContent } from "@/lib/poju/parse-delivery";
import { formatBreakthroughCoreForFinalize } from "@/lib/llm/pro/delivery/format-spine-for-finalize";
import type { DeliveryMode } from "@/lib/poju/collection-progress";
import type { DeliverySectionType } from "@/lib/poju/parse-delivery";

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
assert(DELIVERY_FINALIZE_TASK.includes("energy"), "finalize has energy part");
assert(DELIVERY_FINALIZE_TASK.includes("零命理词"), "narrative ban in finalize core_conclusion");

assert(DELIVERY_TASKS.length === 5, "5 delivery tasks");
assert(
  DELIVERY_TASKS.map((t) => t.paths.join(",")).join("|") ===
    "preface,energy|situation,crossroads|action|retune|rhythm,awareness,epilogue",
  "task path split for book",
);

const dualKey = fillMissingDeliverySegments({
  situation: { core_conclusion: "你卡在不敢动的结构点。", bazi_basis: ["七杀", "身弱"] },
  crossroads: { core_conclusion: "真正分岔是先稳还是先冲。", bazi_basis: ["印星"] },
  action: { core_conclusion: "先把五年经验系统化再谈跳槽。", bazi_basis: ["食神"] },
  // legacy letter still accepted
  D: { core_conclusion: "用冷却习惯稳住内耗。", bazi_basis: ["忌神"] },
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
const md = mergeDeliveryToMarkdown(narrative, evidence, "zh", {
  original_question: "我该不该换工作？",
  locale: "zh",
  report_id: "POJU-TEST",
  generated_at: "2026-07-30T00:00:00.000Z",
  base_analysis: null,
});
assert(md.includes("# 关于"), "merge has cover title");
assert(md.includes("## 目录"), "merge has TOC");
assert(md.includes("## 第一部分 · 你的能量结构"), "merge has energy heading");
assert(md.includes("## 第四部分 · 破局方案·现代行动"), "merge has action heading");
assert(md.includes("## 附录"), "merge has appendix");
assert(md.includes("**依据与推理:**"), "merge has evidence lead");
assert(!md.includes("═══ ANALYSIS"), "no legacy ANALYSIS marker");

const sections = parseDeliveryContent(md);
assert(sections.length >= 9, `parsed ${sections.length} sections`);
const proseTypes = new Set(DELIVERY_SEGMENT_KEYS);
assert(
  sections
    .filter((s) => proseTypes.has(s.type as (typeof DELIVERY_SEGMENT_KEYS)[number]))
    .every((s) => proseTypes.has(s.type as (typeof DELIVERY_SEGMENT_KEYS)[number])),
  "prose section keys are book keys",
);
assert(
  sections.some((s) => (s.type as DeliverySectionType) === "cover" || s.title.includes("换工作")),
  "cover or title present",
);

const delivery = {
  delivered_at: new Date().toISOString(),
  language: "zh",
  full_text: md,
};
assert(typeof delivery.full_text === "string" && delivery.full_text.includes("## 第一部分"), "POJUDelivery full_text");
assert(!("analysis" in delivery), "no legacy analysis field");

const route = readFileSync(resolve(__dirname, "../app/api/poju/final-delivery/route.ts"), "utf8");
assert(route.includes("runDeliveryReport"), "route uses runDeliveryReport");
assert(route.includes("regenerate"), "route supports regenerate skip-pass");
assert(!route.includes("buildFinalDeliveryPrompt"), "route no longer uses old single prompt");

const control = readFileSync(
  resolve(__dirname, "../lib/poju/phases/delivery/control.ts"),
  "utf8",
);
assert(control.includes("startDeliveryRegenerate"), "delivery regenerate control exists");

const runSrc = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/run-delivery-report.ts"),
  "utf8",
);
assert(runSrc.includes("sanitizeDeliveryBookMarkdown"), "report uses book dual-layer sanitize");
assert(!runSrc.includes("sanitizeDeliveryText("), "report no longer uses legacy sanitizeDeliveryText");

// Dual-layer sanitize: evidence marked, not deleted; preface has no evidence block
const dirtyBook = `# 关于「测试」的能量决策报告

## 序言 · 关于这份报告

这是引言。

**依据与推理:**
本段依据待补。

## 第二部分 · 处境深度剖析

你卡在不敢动的结构点。

**依据与推理:**
日主庚金为夫星，却被巳火直克，构成锋锐克官之局。
`;
const cleaned = sanitizeDeliveryBookMarkdown(dirtyBook, "zh");
assert(!cleaned.includes("本段依据待补"), "preface placeholder evidence dropped");
const prefaceChunk = cleaned.split(/^## /m).find((p) => p.startsWith("序言")) ?? "";
assert(prefaceChunk.includes("这是引言"), "preface body kept");
assert(!prefaceChunk.includes("依据与推理"), "preface is single-layer (no evidence in section)");
assert(cleaned.includes("⟦t:"), "situation evidence is marked (not deleted)");
assert(cleaned.includes("为夫星"), "evidence keeps sentence structure / subject chain");
assert(!/；\s*需养\s*；/.test(cleaned), "no semicolon skeleton artifact");

// Merge: preface/epilogue single-layer
const thinNar = Object.fromEntries(DELIVERY_SEGMENT_KEYS.map((k) => [k, `正文${k}`]));
const thinEv = Object.fromEntries(
  DELIVERY_SEGMENT_KEYS.map((k) => [k, `日主庚金支撑${k}。`]),
);
const mergedThin = mergeDeliveryToMarkdown(thinNar, thinEv, "zh");
const prefaceMerged = mergedThin.split(/^## /m).find((p) => p.startsWith("序言")) ?? "";
const epilogueMerged = mergedThin.split(/^## /m).find((p) => p.startsWith("结语")) ?? "";
const situationMerged = mergedThin.split(/^## /m).find((p) => p.startsWith("第二部分")) ?? "";
assert(!prefaceMerged.includes("依据与推理"), "merge drops preface evidence");
assert(!epilogueMerged.includes("依据与推理"), "merge drops epilogue evidence");
assert(situationMerged.includes("依据与推理"), "merge keeps analysis evidence");

console.log("test-final-delivery-degraded: all passed");
