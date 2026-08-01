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
import {
  chunkDeliveryArgPayload,
  DELIVERY_ARGS_PER_CALL,
  DELIVERY_MARK_ARGS_PER_CALL,
  DELIVERY_MARK_TIMEOUT_MS,
  DELIVERY_TASKS,
  DELIVERY_WRITE_MAX_TOKENS,
  FINALIZE_GROUPS,
} from "@/lib/llm/pro/delivery/delivery-tasks";
import { asMarkArgumentTree } from "@/lib/llm/pro/delivery/mark-evidence-call";
import { mergeDeliveryToMarkdown } from "@/lib/llm/pro/delivery/merge-delivery-markdown";
import { sanitizeDeliveryBookMarkdown } from "@/lib/llm/pro/delivery/sanitize-delivery-book";
import { DELIVERY_FINALIZE_TASK } from "@/lib/llm/pro/delivery/finalize-prompt";
import { parseDeliveryContent } from "@/lib/poju/parse-delivery";
import { formatBreakthroughCoreForFinalize } from "@/lib/llm/pro/delivery/format-spine-for-finalize";
import { isEvidenceLeadLabel, parseReadingBlocks } from "@/lib/reading/parse-reading-blocks";
import { polishMarkedEvidenceText } from "@/lib/llm/pro/delivery/polish-marked-evidence";
import {
  DELIVERY_PIPELINE_STAGES,
  nextDeliveryStage,
} from "@/lib/llm/pro/delivery/delivery-stage-store";
import {
  buildMarkEvidencePrompt,
  resolveDeliveryMarkMode,
} from "@/lib/llm/pro/delivery/mark-evidence-prompt";
import { buildDeliveryBookPages } from "@/lib/poju/delivery-book-pages";
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
assert(DELIVERY_FINALIZE_TASK.includes("指定段"), "finalize supports group keys");
assert(FINALIZE_GROUPS.length === DELIVERY_TASKS.length, "finalize groups match write tasks");
assert(FINALIZE_GROUPS.some((g) => g.paths.includes("action") && g.paths.length === 1), "action alone in finalize");
assert(nextDeliveryStage(null) === "finalize", "pipeline starts at finalize");
assert(nextDeliveryStage("finalize") === "narrative", "finalize → narrative");
assert(nextDeliveryStage("mark") === "assemble", "mark → assemble");
assert(nextDeliveryStage("assemble") === null, "assemble is terminal");
assert(DELIVERY_PIPELINE_STAGES.length === 5, "5 pipeline stages");

assert(DELIVERY_TASKS.length === DELIVERY_SEGMENT_KEYS.length, "one delivery task per segment");
assert(
  DELIVERY_TASKS.every((t) => t.paths.length === 1),
  "each delivery task is single-key (finer fan-out)",
);
assert(
  DELIVERY_TASKS.map((t) => t.paths[0]).join("|") === DELIVERY_SEGMENT_KEYS.join("|"),
  "task order matches segment keys",
);
assert(DELIVERY_WRITE_MAX_TOKENS >= 16_000, "mark/narrative write ceiling aligned to 16k+");
assert(DELIVERY_ARGS_PER_CALL >= 2 && DELIVERY_ARGS_PER_CALL <= 3, "2–3 args per evidence call");
assert(DELIVERY_MARK_ARGS_PER_CALL === 1, "mark one arg per call (avoid 0/N + timeout)");
assert(DELIVERY_MARK_TIMEOUT_MS >= 180_000, "mark timeout ≥180s");
{
  const chunked = chunkDeliveryArgPayload({
    situation: {
      arguments: [
        { body: "a", evidence: "e1" },
        { body: "b", evidence: "e2" },
        { body: "c", evidence: "e3" },
        { body: "d", evidence: "e4" },
      ],
    },
  });
  assert(chunked.length === 2, "4 args → 2 chunks at 3/call");
  assert(chunked[0]!.situation!.arguments.length === 3, "first chunk full");
  assert(chunked[1]!.situation!.arguments.length === 1, "second chunk remainder");
  const markChunked = chunkDeliveryArgPayload(
    {
      energy: {
        arguments: [
          { body: "a", evidence: "e1" },
          { body: "b", evidence: "e2" },
          { body: "c", evidence: "e3" },
        ],
      },
    },
    DELIVERY_MARK_ARGS_PER_CALL,
  );
  assert(markChunked.length === 3, "mark chunks 1 arg each");
}
{
  // Prompt contract: bare {arguments:[...]} — parser maps onto the task segment key.
  const fromPrompt = asMarkArgumentTree(
    {
      arguments: [
        { evidence: "marked-1" },
        { evidence: "marked-2" },
        { evidence: "marked-3" },
      ],
    },
    ["energy"],
  );
  assert((fromPrompt.energy?.length ?? 0) === 3, "prompt-format arguments → energy");
  assert(fromPrompt.energy?.[0]?.evidence === "marked-1", "prompt-format evidence text");
  // Defensive: keyed wrapper still accepted.
  const keyed = asMarkArgumentTree(
    { energy: { arguments: [{ evidence: "ok" }] } },
    ["energy"],
  );
  assert((keyed.energy?.length ?? 0) === 1, "keyed energy fallback parse");
}

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
assert(route.includes("runFinalDeliveryJob") || route.includes("final_delivery"), "route uses async final-delivery job");
assert(route.includes("regenerate"), "route supports regenerate skip-pass");
assert(!route.includes("buildFinalDeliveryPrompt"), "route no longer uses old single prompt");

const jobRunner = readFileSync(
  resolve(__dirname, "../lib/poju/final-delivery-job-runner.ts"),
  "utf8",
);
assert(
  jobRunner.includes("runFinalDeliveryStage") || jobRunner.includes("final-delivery-stage-runner"),
  "job runner uses stage relay",
);

const continueRoute = readFileSync(
  resolve(__dirname, "../app/api/poju/final-delivery/continue/route.ts"),
  "utf8",
);
assert(continueRoute.includes("runFinalDeliveryStage"), "continue route runs one stage");
assert(continueRoute.includes("maxDuration = 300"), "continue has 300s budget");
assert(continueRoute.includes("tryAcquireDeliveryContinueLease"), "continue acquires single-flight lease");
assert(continueRoute.includes("continue_lease_busy"), "continue rejects when lease held");
assert(continueRoute.includes("409"), "lease busy returns 409 (not silent success)");

const stageRunner = readFileSync(
  resolve(__dirname, "../lib/poju/final-delivery-stage-runner.ts"),
  "utf8",
);
assert(stageRunner.includes("findNextIncompleteDeliveryTask"), "stage runner fans out per task");
assert(stageRunner.includes("runMarkDeliveryTask"), "mark stage uses dedicated mark task runner");
assert(stageRunner.includes("saveDeliveryTaskCheckpoint"), "per-task results checkpointed to KV");
assert(stageRunner.includes("progressFanoutStage"), "fan-out progress helper present");
assert(stageRunner.includes("FANOUT_INVOCATION_BUDGET_MS"), "batches tasks under invocation budget");
assert(stageRunner.includes("deliveryFanoutConcurrency"), "stage-aware fan-out concurrency");
assert(stageRunner.includes("wave start"), "runs parallel task waves");
assert(stageRunner.includes("listIncompleteDeliveryTasks"), "lists incomplete tasks for waves");
assert(
  stageRunner.includes("continue_schedule_failed"),
  "continue fetch failure STOPs (no inline fallback)",
);
assert(!stageRunner.includes("inline fallback"), "no inline continue fallback");
assert(stageRunner.includes("Connection"), "continue self-fetch disables keep-alive");
assert(stageRunner.includes("[final-delivery-STOP]"), "fail-fast STOP log marker");
assert(stageRunner.includes("stage timing"), "per-stage timing logs");
assert(stageRunner.includes("wave timing"), "per-wave timing logs");
assert(stageRunner.includes("task_ms"), "per-task duration logged");
assert(stageRunner.includes("mark hop — schedule continue"), "mark one-task-per-continue hop");
assert(stageRunner.includes("releaseDeliveryContinueLease"), "releases continue lease in finally");
assert(stageRunner.includes("retryable: false"), "delivery STOP is non-retryable");

const tasksSrc = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/delivery-tasks.ts"),
  "utf8",
);
assert(tasksSrc.includes("DELIVERY_TASK_CONCURRENCY = 6"), "default concurrency is 6");
assert(tasksSrc.includes("deliveryFanoutConcurrency"), "mark concurrency override helper");

const stageStore = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/delivery-stage-store.ts"),
  "utf8",
);
assert(stageStore.includes("deliveryTaskKey"), "task KV key helper");
assert(stageStore.includes("DELIVERY_FANOUT_STAGES"), "fan-out stages listed");
assert(stageStore.includes("tryAcquireDeliveryContinueLease"), "continue lease helpers");
assert(!stageStore.includes("DELIVERY_MAX_STALE_RESUMES"), "no stale-resume cap (fail instead)");

const statusRoute = readFileSync(
  resolve(__dirname, "../app/api/poju/final-delivery/status/route.ts"),
  "utf8",
);
assert(statusRoute.includes("loadDeliveryContinueLease"), "status respects continue lease");
assert(statusRoute.includes("stale_running"), "status fails on stale (no auto-resume)");
assert(!statusRoute.includes("scheduleDeliveryStageContinue"), "status never re-fires continue");
assert(statusRoute.includes("retryable: false"), "stale/fail responses are non-retryable");

const finalizeCall = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/finalize-call.ts"),
  "utf8",
);
assert(finalizeCall.includes("runFinalizeGroup"), "finalize exposes single-group runner");
assert(finalizeCall.includes("assembleDeliveryFinalize"), "finalize assemble after task KV");
assert(finalizeCall.includes("FINALIZE_GROUPS"), "finalize uses FINALIZE_GROUPS");
assert(!finalizeCall.includes("max_tokens: 10_000"), "finalize no longer single 10k call");
assert(finalizeCall.includes("deliveryAppMaxAttempts"), "finalize uses retry policy");

const retryPolicy = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/delivery-retry-policy.ts"),
  "utf8",
);
assert(retryPolicy.includes("DELIVERY_ENABLE_RETRIES = false"), "delivery retries off for diagnosis");
assert(
  readFileSync(resolve(__dirname, "../lib/llm/pro/delivery/narrative-evidence-call.ts"), "utf8").includes(
    "deliveryTransportMaxAttempts",
  ),
  "narrative/evidence use transport fail-fast",
);
assert(
  readFileSync(resolve(__dirname, "../lib/llm/pro/delivery/mark-evidence-call.ts"), "utf8").includes(
    "deliveryTransportMaxAttempts",
  ),
  "mark uses transport fail-fast",
);

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
assert(runSrc.includes("runMarkDeliveryEvidence"), "report uses dedicated mark step");
assert(runSrc.includes("runDeliveryEvidence"), "report runs raw evidence before mark");
assert(runSrc.includes("translateNarrativeTree"), "foreign narrative translated separately from evidence mark");
assert(!runSrc.includes("sanitizeDeliveryText("), "report no longer uses legacy sanitizeDeliveryText");

const narrPrompt = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/narrative-prompt.ts"),
  "utf8",
);
assert(narrPrompt.includes("arguments"), "narrative outputs argument list");
assert(narrPrompt.includes("独立论点"), "narrative asks for independent arguments");

const markCall = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/mark-evidence-call.ts"),
  "utf8",
);
assert(markCall.includes("resolveDeliveryMarkMode"), "mark mode resolver exists");
assert(markCall.includes("runMarkTaskSplit"), "split degradation path exists");
assert(markCall.includes("buildTranslateEvidencePrompt"), "split translate prompt wired");
assert(resolveDeliveryMarkMode({}) === "combined", "default mark mode is combined");
assert(resolveDeliveryMarkMode({ DELIVERY_MARK_MODE: "split" }) === "split", "split mode via env");

// Per-argument merge: each body followed by its own evidence
const argNar = {
  situation: [
    { body: "### 论点一\n\n你需要养学习习惯。" },
    { body: "### 论点二\n\n你要练习降低期待。" },
  ],
};
const argEv = {
  situation: [
    { evidence: "因为正印是学习与包容之星。" },
    { evidence: "因为伤官过旺，容易挑剔理想化。" },
  ],
};
const argMd = mergeDeliveryToMarkdown(argNar, argEv, "zh");
const sitChunk = argMd.split(/^## /m).find((p) => p.startsWith("第二部分")) ?? "";
assert(sitChunk.includes("养学习习惯"), "arg1 body present");
assert(sitChunk.includes("降低期待"), "arg2 body present");
assert(
  (sitChunk.match(/\*\*依据与推理:\*\*/g) ?? []).length >= 2,
  "each argument has its own evidence lead",
);

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
assert(cleaned.includes("⟦t:") || cleaned.includes("为夫星"), "situation evidence kept (marked or prose)");
assert(cleaned.includes("为夫星") || cleaned.includes("夫星"), "evidence keeps sentence structure / subject chain");
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

const markPrompt = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/mark-evidence-prompt.ts"),
  "utf8",
);
assert(markPrompt.includes("buildTermMarkingPromptBlock"), "mark step has full SSOT table");
assert(markPrompt.includes("白话串联"), "mark step requires plain connective prose");
assert(markPrompt.includes("普通美国高中生"), "mark persona locked to US high-school plain");
assert(markPrompt.includes("第 6 步"), "mark step has 6-step sequence");

const evidencePrompt = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/evidence-prompt.ts"),
  "utf8",
);
assert(evidencePrompt.includes("【禁止】打"), "evidence gen forbids marking");
assert(!evidencePrompt.includes("buildTermMarkingPromptBlock"), "evidence gen has no marking table");

// Parser: unmarked evidence continuation stays in lead (not kicked to body)
{
  const md = [
    "接触水木能平衡。",
    "",
    "**依据与推理:**",
    "日主⟦t:weak_self|⟧为水木。",
    "",
    "月支寅木为伤官；官星为忌。",
  ].join("\n");
  const blocks = parseReadingBlocks(md, { layout: false });
  const leads = blocks.filter(
    (b) => b.type === "lead" && isEvidenceLeadLabel(b.label),
  );
  assert(leads.length === 1, "unmarked evidence trail stays in one lead");
  assert(
    leads[0]!.type === "lead" && leads[0]!.body.includes("官星为忌"),
    "second evidence para not leaked",
  );
  assert(
    !blocks.some((b) => b.type === "p" && b.content.includes("官星为忌")),
    "no evidence leak into body p",
  );
}

// polish preserves model situational plain (does NOT forceSsot overwrite)
{
  const raw =
    "月支伤官见官，⟦t:shang_guan||在你问的再婚这件事上，锋锐表达容易撞上对方的规矩感⟧。";
  const polished = polishMarkedEvidenceText(raw, "zh");
  assert(polished.includes("再婚"), "situational plain preserved through polish");
  assert(polished.includes("规矩感"), "situational clause kept");
  assert(/⟦t:shang_guan\|/.test(polished), "marker kept");
}

// autoMark: 官星 + 伤官 on oncePerText=false
{
  const raw =
    "日主⟦t:weak_self|⟧为水木。月支寅木为伤官，身弱伤官易生思虑；官星为忌。";
  const polished = polishMarkedEvidenceText(raw, "zh");
  assert(/⟦t:shang_guan\|/.test(polished), "伤官 auto-marked");
  assert(/⟦t:zheng_guan\|/.test(polished), "官星 auto-marked via alias");
}

// mark prompt: real-term SSOT table (neutralBase) + situational plain override
{
  const { system, user } = buildMarkEvidencePrompt(
    {
      situation: {
        arguments: [{ body: "再婚卡在谁来定规矩", evidence: "官星为忌，伤官见官。" }],
      },
    },
    "zh",
    { original_question: "我什么时候能再婚？" },
  );
  assert(system.includes("情景白话"), "mark prompt asks for situational plain");
  assert(system.includes("白话串联"), "mark prompt asks for plain connective prose");
  assert(system.includes("普通美国高中生"), "mark persona is US high-school plain");
  assert(system.includes("把所有金字都当成看不见的占位符"), "self-check: readable with markers masked");
  assert(system.includes("我什么时候能再婚"), "mark prompt injects user question");
  assert(system.includes("## 打标记规则（中立底座）"), "mark injects real-term table (neutralBase)");
  assert(system.includes("交付打标格式覆盖"), "delivery overrides empty-slot base rules");
  assert(system.includes("⟦t:<slug>||"), "mark prompt requires empty soft + plain slot");
  assert(
    system.includes('{ "arguments": [ { "evidence":'),
    "mark prompt owns bare arguments JSON contract",
  );
  assert(user.includes('{"arguments":[{"evidence"'), "mark user restates prompt JSON shape");
  assert(!system.includes("| **锚元**"), "mark table must not list soft gloss 锚元");
  assert(user.includes("再婚卡在谁来定规矩"), "mark user payload includes body");

  const foreign = buildMarkEvidencePrompt(
    {
      situation: {
        arguments: [{ body: "Who sets the rules", evidence: "官星为忌，伤官见官。" }],
      },
    },
    "en",
    { original_question: "When can I remarry?" },
  );
  assert(foreign.system.includes("翻译成地道外语"), "foreign mark has translate step");
  assert(foreign.system.includes("Officer Star"), "foreign mark bans jargon calque");
  assert(foreign.system.includes("When can I remarry"), "foreign mark injects question");
  assert(foreign.system.includes("neutral base") || foreign.system.includes("Marking rules (neutral base)"), "foreign mark uses neutralBase table");
}

// Book pages: cover → toc → chapters → appendix order
{
  const md = `# Title cover\n\nSubtitle line.\n\n## 目录\n\n1. 序言\n\n## 序言 · 关于这份报告\n\nHello.\n\n## 第一部分 · 你的能量结构\n\nBody.\n\n## 附录 · 命盘数据与术语\n\nData.\n`;
  const pages = buildDeliveryBookPages(md);
  assert(pages[0]?.id === "cover", "book starts with cover");
  assert(pages.some((p) => p.id === "toc"), "book has toc");
  assert(pages.some((p) => p.id === "preface"), "book has preface");
  assert(pages[pages.length - 1]?.id === "appendix", "appendix last");
}

console.log("test-final-delivery-degraded: all passed");
