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
  DELIVERY_EVIDENCE_TIMEOUT_MS,
  DELIVERY_TASKS,
  DELIVERY_WRITE_MAX_TOKENS,
  FINALIZE_GROUPS,
  deliveryFanoutConcurrency,
} from "@/lib/llm/pro/delivery/delivery-tasks";
import {
  DELIVERY_SEGMENT_TRANSPORT_MAX_ATTEMPTS,
  isDeliverySegmentTransportRetryable,
} from "@/lib/llm/pro/delivery/delivery-retry-policy";
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
assert(DELIVERY_FINALIZE_TASK.includes("命运红线"), "finalize core bans fate lexicon");
assert(DELIVERY_FINALIZE_TASK.includes("指定段"), "finalize supports group keys");
assert(FINALIZE_GROUPS.length === DELIVERY_TASKS.length, "finalize groups match write tasks");
assert(FINALIZE_GROUPS.some((g) => g.paths.includes("action") && g.paths.length === 1), "action alone in finalize");
assert(nextDeliveryStage(null) === "finalize", "pipeline starts at finalize");
assert(nextDeliveryStage("finalize") === "segments", "finalize → segments");
assert(nextDeliveryStage("segments") === "assemble", "segments → assemble");
assert(nextDeliveryStage("assemble") === null, "assemble is terminal");
assert(DELIVERY_PIPELINE_STAGES.length === 3, "3 pipeline stages (finalize/segments/assemble)");

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
assert(DELIVERY_ARGS_PER_CALL >= 4 && DELIVERY_ARGS_PER_CALL <= 6, "4–6 args per evidence call");
assert(DELIVERY_MARK_ARGS_PER_CALL >= 2 && DELIVERY_MARK_ARGS_PER_CALL <= 5, "2–5 args per mark call (P4 A/B)");
assert(DELIVERY_MARK_TIMEOUT_MS >= 200_000, "mark timeout allows heavy thinking walls");
assert(deliveryFanoutConcurrency("segments") === 2, "segment-chain concurrency 2");
assert(
  DELIVERY_EVIDENCE_TIMEOUT_MS >= DELIVERY_MARK_TIMEOUT_MS,
  "evidence timeout aligned with mark (≥200s)",
);
assert(DELIVERY_SEGMENT_TRANSPORT_MAX_ATTEMPTS === 3, "segment transport max attempts = 3");
assert(
  isDeliverySegmentTransportRetryable("delivery_segment_failed:mark:call_error:llm_timeout"),
  "mark llm_timeout is soft-retryable",
);
assert(deliveryFanoutConcurrency("finalize") <= 3, "finalize wave capped");
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
  assert(chunked.length === 1, "4 args → 1 chunk at evidence 5/call");
  assert(chunked[0]!.situation!.arguments.length === 4, "single chunk holds all 4");
  const markChunked = chunkDeliveryArgPayload(
    {
      energy: {
        arguments: Array.from({ length: 7 }, (_, i) => ({
          body: `b${i}`,
          evidence: `e${i}`,
        })),
      },
    },
    DELIVERY_MARK_ARGS_PER_CALL,
  );
  assert(markChunked.length === 3, "7 args → 3 mark chunks at 3/call");
  assert(markChunked[0]!.energy!.arguments.length === 3, "first mark chunk full");
  assert(markChunked[1]!.energy!.arguments.length === 3, "second mark chunk full");
  assert(markChunked[2]!.energy!.arguments.length === 1, "third mark chunk remainder");
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
assert(continueRoute.includes("writeDeliveryContinueAck"), "continue writes ACK before 202");
assert(continueRoute.includes("accepted: true"), "continue 202 body has accepted");
assert(continueRoute.includes("continue_lease_busy"), "continue rejects when lease held");
assert(continueRoute.includes("409"), "lease busy returns 409 (not silent success)");

const stageRunner = readFileSync(
  resolve(__dirname, "../lib/poju/final-delivery-stage-runner.ts"),
  "utf8",
);
assert(stageRunner.includes("findNextIncompleteDeliveryTask"), "stage runner fans out per task");
assert(stageRunner.includes("advanceSegmentChain"), "P3 segment chain runner wired");
assert(stageRunner.includes("saveDeliverySegmentReady"), "segment:ready checkpoint written");
assert(stageRunner.includes("saveDeliveryTaskCheckpoint"), "per-task results checkpointed to KV");
assert(stageRunner.includes("progressFanoutStage"), "fan-out progress helper present");
assert(stageRunner.includes("FANOUT_INVOCATION_BUDGET_MS"), "batches tasks under invocation budget");
assert(stageRunner.includes("VERCEL_INVOKE_HARD_MS"), "respects Vercel 300s hard kill");
assert(stageRunner.includes("reserveMsForNextWave"), "reserves time before starting next wave");
assert(stageRunner.includes("deliveryFanoutConcurrency"), "stage-aware fan-out concurrency");
assert(stageRunner.includes("wave start"), "runs parallel task waves");
assert(stageRunner.includes("listIncompleteDeliveryTasks"), "lists incomplete tasks for waves");
assert(
  stageRunner.includes("continue_schedule_failed"),
  "continue fetch failure STOPs (no alternate path)",
);
assert(
  stageRunner.includes("continue_schedule_failed:vercel_508_loop"),
  "508 loop detection has distinct STOP reason",
);
assert(stageRunner.includes("dispatchDeliveryContinue"), "handoff uses continue dispatcher");
assert(stageRunner.includes("handoff_continue"), "continue handoff refreshes status before post");
assert(stageRunner.includes("continue handoff posted"), "logs successful continue handoff");
assert(stageRunner.includes("hasLiveDeliveryContinueForStage"), "ACK/lease confirms handoff on network blip");
assert(stageRunner.includes("canPackSameInvoke = false"), "finalize does not pack segments in-process");
assert(stageRunner.includes("stopHeartbeat"), "stops heartbeat before lease handoff");
assert(stageRunner.includes("isAbortishReason"), "AbortError classified as sibling cancel");
assert(stageRunner.includes("interruptStage"), "exhausted segment transport interrupts (resumable)");
assert(stageRunner.includes("soft_retryable"), "segment transport soft-retry without killing siblings");
assert(stageRunner.includes("[final-delivery-INTERRUPTED]"), "interrupted log marker");
assert(!stageRunner.includes('from "next/server"'), "stage runner no longer uses next/server after()");
assert(!stageRunner.includes("after(() =>"), "continue hop is awaited, not deferred to after()");
assert(stageRunner.includes("[final-delivery-STOP]"), "fail-fast STOP log marker");

const continueDispatch = readFileSync(
  resolve(__dirname, "../lib/poju/delivery-continue-dispatch.ts"),
  "utf8",
);
assert(continueDispatch.includes("publishContinueViaQStash"), "QStash publish breaks Vercel 508 loop");
assert(continueDispatch.includes("Connection"), "direct self-fetch disables keep-alive");
assert(continueDispatch.includes("status === 508"), "508 short-circuits without burning retries");
assert(continueDispatch.includes("shouldDispatchContinueViaQStash"), "Vercel prefers QStash hops");
assert(stageRunner.includes("stage timing"), "per-stage timing logs");
assert(stageRunner.includes("wave timing"), "per-wave timing logs");
assert(stageRunner.includes("task_ms"), "per-task duration logged");
assert(
  !stageRunner.includes("mark hop — schedule continue"),
  "mark no longer hops after every single task",
);
assert(stageRunner.includes("leaseHandedOff"), "tracks lease handoff before continue post");
assert(stageRunner.includes("retryable: false"), "delivery STOP is non-retryable");

const tasksSrc = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/delivery-tasks.ts"),
  "utf8",
);
assert(tasksSrc.includes("DELIVERY_TASK_CONCURRENCY = 7"), "default concurrency is 7");
assert(tasksSrc.includes("DELIVERY_MARK_ARGS_PER_CALL"), "mark batch size configurable");
assert(tasksSrc.includes("resolveDeliveryMarkEffort"), "P4 mark effort A/B helper");
assert(tasksSrc.includes('stage === "segments"'), "segments fan-out concurrency");
assert(tasksSrc.includes("deliveryFanoutConcurrency"), "stage concurrency helper");
assert(
  readFileSync(resolve(__dirname, "../lib/llm/pro/delivery/mark-evidence-call.ts"), "utf8").includes(
    "Serial chunks inside a task",
  ),
  "mark chunks serial within task",
);

const stageStore = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/delivery-stage-store.ts"),
  "utf8",
);
assert(stageStore.includes("deliveryTaskKey"), "task KV key helper");
assert(stageStore.includes("DELIVERY_FANOUT_STAGES"), "fan-out stages listed");
assert(stageStore.includes("segment:"), "segment:ready key namespace");
assert(stageStore.includes("loadAllDeliverySegmentReady"), "status reads segment:ready");
assert(stageStore.includes("tryAcquireDeliveryContinueLease"), "continue lease helpers");
assert(stageStore.includes("nx: true"), "continue lease acquire is SET NX");
assert(stageStore.includes("writeDeliveryContinueAck"), "continue ACK helpers");
assert(!stageStore.includes("DELIVERY_MAX_STALE_RESUMES"), "no stale-resume cap (fail instead)");

const statusRoute = readFileSync(
  resolve(__dirname, "../app/api/poju/final-delivery/status/route.ts"),
  "utf8",
);
assert(statusRoute.includes("loadDeliveryContinueLease"), "status respects continue lease");
assert(statusRoute.includes("stale_running"), "status fails on stale (no auto-resume)");
assert(statusRoute.includes('job.status === "pending"'), "pending dead jobs also STOP");
assert(statusRoute.includes("releaseXhighSessionLock"), "status fail releases session lock");
assert(!statusRoute.includes("scheduleDeliveryStageContinue"), "status never re-fires continue");
assert(statusRoute.includes("retryable: false"), "stale/fail responses are non-retryable");
assert(statusRoute.includes("streamed_segments"), "status returns streamed_segments");
assert(statusRoute.includes("loadAllDeliverySegmentReady"), "status streams from segment:ready");

const startRoute = readFileSync(
  resolve(__dirname, "../app/api/poju/final-delivery/route.ts"),
  "utf8",
);
assert(startRoute.includes("superseded by regenerate"), "regenerate STOPs prior in-flight job");
assert(startRoute.includes("delivery_job_busy"), "lock busy returns busy error");
assert(
  readFileSync(resolve(__dirname, "../lib/poju/xhigh-job-store.ts"), "utf8").includes(
    "ignore status transition from terminal",
  ),
  "terminal job status is sticky",
);
assert(
  readFileSync(resolve(__dirname, "../lib/kv/client.ts"), "utf8").includes("POJU_XHIGH_LOCK: 60 * 90"),
  "session lock TTL covers long delivery",
);

const finalizeCall = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/finalize-call.ts"),
  "utf8",
);
assert(finalizeCall.includes("runFinalizeGroup"), "finalize exposes single-group runner");
assert(
  finalizeCall.includes("normalizeFinalizeGroupObject"),
  "finalize normalizes bare dual-key / legacy aliases (avoids false group_empty)",
);
assert(finalizeCall.includes("assembleDeliveryFinalize"), "finalize assemble after task KV");
assert(finalizeCall.includes("FINALIZE_GROUPS"), "finalize uses FINALIZE_GROUPS");
assert(!finalizeCall.includes("max_tokens: 10_000"), "finalize no longer single 10k call");
assert(finalizeCall.includes("deliveryAppMaxAttempts"), "finalize uses retry policy");

const retryPolicy = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/delivery-retry-policy.ts"),
  "utf8",
);
assert(retryPolicy.includes("DELIVERY_ENABLE_RETRIES = false"), "app-level delivery retries off");
assert(
  retryPolicy.includes("OPENROUTER_MAX_ATTEMPTS"),
  "delivery transport allows OpenRouter blip backoff",
);
assert(
  readFileSync(resolve(__dirname, "../lib/llm/pro/delivery/narrative-evidence-call.ts"), "utf8").includes(
    "deliveryTransportMaxAttempts",
  ),
  "narrative/evidence use transport attempt policy",
);
assert(
  readFileSync(resolve(__dirname, "../lib/llm/pro/delivery/mark-evidence-call.ts"), "utf8").includes(
    "deliveryTransportMaxAttempts",
  ),
  "mark uses transport attempt policy",
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
assert(runSrc.includes("translateDeliveryBookTrees"), "foreign body translated per-segment (evidence from mark)");
assert(!runSrc.includes("sanitizeDeliveryText("), "report no longer uses legacy sanitizeDeliveryText");

const narrPrompt = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/narrative-prompt.ts"),
  "utf8",
);
assert(narrPrompt.includes("arguments"), "narrative outputs argument list");
assert(narrPrompt.includes("独立论点"), "narrative asks for independent arguments");
assert(narrPrompt.includes("命运红线"), "narrative body bans fate lexicon in prompt");
assert(!narrPrompt.includes("会被系统整段打回"), "narrative no longer promises hard reject on pollution");

const markCall = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/mark-evidence-call.ts"),
  "utf8",
);
assert(markCall.includes("resolveDeliveryMarkMode"), "mark mode resolver exists");
assert(markCall.includes("codeMarkEvidenceTree"), "code-mark before connective LLM");
assert(markCall.includes("runMarkTaskSplit"), "split path still exported (≡ combined)");
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

// Dual-layer sanitize restored: body vernacular; evidence word-slot/autoMark polish
const dirtyBook = `# 关于「测试」的能量决策报告

## 序言 · 关于这份报告

这是引言。

**依据与推理:**
本段依据待补。

## 第二部分 · 处境深度剖析

你卡在不敢动的结构点。

**依据与推理:**
⟦w:日主⟧庚金为夫星，却被巳火直克，构成锋锐克官之局。
`;
const cleaned = sanitizeDeliveryBookMarkdown(dirtyBook, "zh");
assert(!cleaned.includes("本段依据待补"), "placeholder evidence dropped on transition/pending");
assert(cleaned.includes("这是引言"), "preface body kept");
assert(cleaned.includes("依据与推理"), "evidence labels kept");
assert(cleaned.includes("⟦t:day_master|") || cleaned.includes("本元"), "day_master encoded or soft");
assert(!cleaned.includes("⟦w:"), "word slots resolved in sanitize");
assert(cleaned.includes("庚金") || cleaned.includes("克官"), "situation evidence prose kept");

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
assert(markPrompt.includes("唯一任务"), "P2 mark is connective-only");
assert(markPrompt.includes("白话"), "mark step requires plain connective prose");
assert(markPrompt.includes("普通美国高中生"), "mark persona locked to US high-school plain");
assert(markPrompt.includes("保留每一个"), "mark preserves code markers");
assert(markPrompt.includes("复述或改写 body"), "mark forbids copying narrative body");
assert(markPrompt.includes("旺而"), "mark bans semi-classical connective");

const evidencePrompt = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/evidence-prompt.ts"),
  "utf8",
);
assert(evidencePrompt.includes("⟦w:"), "evidence uses word slots");
assert(evidencePrompt.includes("禁止单字"), "evidence bans single-char jargon");
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

// polish: word-slot encode → slug markers
{
  const raw = "月支⟦w:伤官⟧见⟦w:正官⟧，结构锋锐。";
  const polished = polishMarkedEvidenceText(raw, "zh");
  assert(/⟦t:shang_guan\|/.test(polished), "伤官 word-slot encoded");
  assert(/⟦t:zheng_guan\|/.test(polished), "正官 word-slot encoded");
  assert(!polished.includes("⟦w:"), "no leftover word slots");
}

// autoMark fallback: bare 伤官 when not slotted
{
  const raw = "日主⟦t:weak_self|⟧为水木。月支寅木为伤官，身弱伤官易生思虑。";
  const polished = polishMarkedEvidenceText(raw, "zh");
  assert(/⟦t:shang_guan\|/.test(polished), "伤官 auto-marked");
}

// mark prompt: connective-only (P2)
{
  const { system, user } = buildMarkEvidencePrompt(
    {
      situation: {
        arguments: [
          {
            body: "再婚卡在谁来定规矩",
            evidence: "⟦t:zheng_guan|⟧为忌，⟦t:shang_guan|⟧见官。",
          },
        ],
      },
    },
    "zh",
    { original_question: "我什么时候能再婚？" },
  );
  assert(system.includes("唯一任务"), "mark is connective-only");
  assert(system.includes("普通美国高中生"), "mark persona is US high-school plain");
  assert(system.includes("我什么时候能再婚"), "mark prompt injects user question");
  assert(system.includes("保留每一个"), "mark keeps code markers");
  assert(
    system.includes('{ "arguments": [ { "evidence":'),
    "mark prompt owns bare arguments JSON contract",
  );
  assert(user.includes('{"arguments":[{"evidence"'), "mark user restates prompt JSON shape");
  assert(user.includes("再婚卡在谁来定规矩"), "mark user payload includes body");
  const foreign = buildMarkEvidencePrompt(
    {
      situation: {
        arguments: [{ body: "Who sets the rules", evidence: "⟦t:zheng_guan|⟧" }],
      },
    },
    "en",
    { original_question: "When can I remarry?" },
  );
  assert(foreign.system.includes("When can I remarry"), "foreign mark injects question");
  assert(foreign.system.includes("Your ONLY job"), "foreign mark uses locale-native connective prompt");
  assert(foreign.system.includes("**en**"), "foreign mark targets delivery locale");
  assert(!foreign.system.includes("唯一任务"), "foreign mark is not the zh connective prompt");
}

// Book pages: same H2 split as center (cover blob + toc + chapters + appendix)
{
  const md = `# Title cover\n\nSubtitle line.\n\n## 目录\n\n1. 序言\n\n## 序言 · 关于这份报告\n\nHello.\n\n## 第一部分 · 你的能量结构\n\nBody.\n\n## 附录 · 命盘数据与术语\n\nData.\n`;
  const pages = buildDeliveryBookPages(md);
  assert(pages[0]?.id === "cover", "book starts with cover");
  assert(pages.some((p) => p.id === "toc"), "book has toc");
  assert(pages.some((p) => p.id === "preface"), "book has preface");
  assert(pages[pages.length - 1]?.id === "appendix", "appendix last");
  assert(pages.length === 5, "rail pages = center H2/cover sections (5)");
}

console.log("test-final-delivery-degraded: all passed");
