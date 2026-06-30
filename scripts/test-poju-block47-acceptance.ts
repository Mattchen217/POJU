/**
 * Block 47 — opening conversion: analysis + agenda in one LLM call.
 * Run: pnpm exec tsx scripts/test-poju-block47-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { createInitialAgentState } from "@/lib/poju/agent-state";
import { parseOpeningConversionPayload } from "@/lib/poju/opening-conversion-payload";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function main(): void {
  console.log("\n=== Block 47 acceptance ===\n");

  const opening = read("lib/llm/phases/opening-phase.ts");
  assert("opening parses conversion envelope", opening.includes("parseOpeningConversionPayload"));
  assert("opening returns breakthrough_core", opening.includes("breakthrough_core,"));

  const base = read("lib/llm/prompts/poju-base.ts");
  assert("opening conversion branch in prompt", base.includes("understanding_sufficient=true（困境已清楚）"));
  assert("prompt asks question_category", base.includes("question_category"));
  assert("prompt asks first agenda question in response", base.includes("investigation_agenda 的第一项"));

  const agent = read("lib/poju/agent.ts");
  assert("inline core path", agent.includes("conversion envelope supplied core + agenda"));
  assert("ensureBreakthroughCore only fallback", agent.includes("inlineCoreReady"));
  assert("Block 41 append removed", !agent.includes("appendFirstFocusQuestion"));

  const sm = read("lib/poju/state-machine.ts");
  assert("snapshot has question_category", sm.includes("question_category: agent.question_category"));

  const wire = read("lib/poju/serialize-chat-payload.ts");
  assert("wire has breakthrough_core", wire.includes('"breakthrough_core"'));
  assert("wire has problem_summary", wire.includes('"problem_summary"'));

  const sample = parseOpeningConversionPayload(
    {
      understanding_sufficient: true,
      question_category: "relationship",
      problem_summary: "离婚八年，怕再受伤又渴望亲密",
      relationship_conclusion: "月柱七杀压身，情感窗口被自我防护反复关闭",
      breakthrough_directions: [
        {
          direction: "先修底气再开门",
          structural_basis: "日主偏弱，用神水未到位",
          timing: "当前大运宜守不宜冲",
          what_would_confirm: "过去两年是否刻意回避社交",
        },
        {
          direction: "缩小择偶标准到可行动",
          structural_basis: "财官混杂，期待与现实脱节",
          timing: "流年火土加重焦虑",
          what_would_confirm: "理想伴侣三条硬标准",
        },
      ],
      investigation_agenda: [
        { label: "再婚最大顾虑", critical: true, status: "unexplored" },
        { label: "过去两年社交回避", critical: true, status: "unexplored" },
        { label: "理想伴侣三条标准", critical: false, status: "unexplored" },
      ],
    },
    "你盘里情感防护很重，我们先从再婚最大顾虑说起？",
  );
  assert("parser accepts conversion sample", sample != null);
  assert("parser sets category", sample?.question_category === "relationship");
  assert("parser sets agenda", (sample?.investigation_agenda.length ?? 0) >= 3);
  assert("parser sets core", Boolean(sample?.breakthrough_core.relationship_conclusion));

  const agentState = createInitialAgentState({ original_question: "" });
  agentState.breakthrough_core = sample!.breakthrough_core;
  agentState.investigation_agenda = sample!.investigation_agenda;
  agentState.question_category = sample!.question_category;
  assert("agent can hold inline core", agentState.breakthrough_core != null);
  assert("agent question_category filled", agentState.question_category === "relationship");

  console.log("\n=== Summary ===\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 47 checks passed.\n");
}

main();
