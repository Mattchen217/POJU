/**
 * Block 16 — state machine + debug panel (core wiring updated for Block 19)
 * Run: pnpm exec tsx scripts/test-poju-block16-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { createInitialAgentState } from "@/lib/poju/agent-state";
import { makeTestBreakthroughCore } from "@/lib/poju/test-breakthrough-core-fixture";
import { buildAgentStateSnapshot } from "@/lib/poju/agent-state-snapshot";
import { advanceStateMachine, extractModelTurnSignals } from "@/lib/poju/state-machine";
import { isSubstantiveBreakthroughQuestion } from "@/lib/poju/breakthrough-question-gate";

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
  console.log("\n========== POJU Block 16 Acceptance ==========\n");

  console.log("=== Fix A1 · opening uses model signal ===\n");
  const opening = read("lib/llm/phases/opening-phase.ts");
  assert("opening parses understanding_sufficient", opening.includes("parsed.understanding_sufficient"));
  assert("opening no regex override", !opening.includes("isGreetingOrEmptyQuestion"));

  console.log("\n=== Fix A2 · fill original_question on opening→collecting ===\n");
  const agent = read("lib/poju/agent.ts");
  assert("agent uses advanceStateMachine", agent.includes("advanceStateMachine"));
  assert("session syncs original_question", agent.includes("resolvedOriginalQuestion"));

  const base = createInitialAgentState({ original_question: "你好" });
  const after = advanceStateMachine(
    base,
    extractModelTurnSignals({ understanding_sufficient: true }),
    "我离婚8年了想重新开始",
  ).next_agent;
  assert("advance fills substantive question", isSubstantiveBreakthroughQuestion(after.original_question));
  assert("greeting alone not substantive", !isSubstantiveBreakthroughQuestion("你好"));

  console.log("\n=== Fix A3 · orchestrator reads updated question ===\n");
  const orch = read("lib/poju/agent-orchestrator.ts");
  assert("resolveSessionOriginalQuestion helper", orch.includes("resolveSessionOriginalQuestion"));
  assert("syncSessionOriginalQuestion", orch.includes("syncSessionOriginalQuestion"));
  assert("patchLastAssistantOrchestrationMeta", orch.includes("patchLastAssistantOrchestrationMeta"));

  console.log("\n=== Fix B · state snapshot ===\n");
  const types = read("lib/poju/types.ts");
  assert("meta.state_snapshot type", types.includes("state_snapshot"));
  assert("meta.llm_debug type", types.includes("llm_debug"));
  assert("agent builds state_snapshot", agent.includes("buildAgentStateSnapshot"));

  const snap = buildAgentStateSnapshot(
    { ...after, breakthrough_core: makeTestBreakthroughCore({ situation_conclusion: "x" }) },
    false,
  );
  assert("snapshot has phase", Boolean(snap.phase));
  assert("snapshot flags relationship", snap.relationship_conclusion === true);

  console.log("\n=== Fix B/C · UI ===\n");
  const ui = read("components/poju/POJUChatUI.tsx");
  assert("PojuStateDebugPanel wired", ui.includes("PojuStateDebugPanel"));
  assert("LLMCallDebugPanel wired", ui.includes("LLMCallDebugPanel"));
  assert("useLlmDebugEnabled hook", ui.includes("useLlmDebugEnabled"));
  assert("messageFooters passed to PojuChat", ui.includes("messageFooters={messageFooters}"));
  assert("PojuAgendaCard wired", ui.includes("PojuAgendaCard"));
  assert("investigation_agenda in meta render", ui.includes("m.meta?.investigation_agenda"));
  assert("llm_debug in meta render", ui.includes("m.meta?.llm_debug"));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 16 acceptance checks passed.\n");
}

main();
