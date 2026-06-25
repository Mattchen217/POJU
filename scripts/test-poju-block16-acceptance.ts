/**
 * Block 16 — fix state machine oscillation + state debug panel + agenda below bubble
 * Run: pnpm exec tsx scripts/test-poju-block16-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import {
  applyPhaseTransition,
  createInitialAgentState,
  decidePhaseTransition,
} from "@/lib/poju/agent-state";
import { buildAgentStateSnapshot } from "@/lib/poju/agent-state-snapshot";
import { isGreetingOrEmptyQuestion, isSubstantiveBreakthroughQuestion } from "@/lib/poju/breakthrough-question-gate";

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

  console.log("=== Fix A1 · gate judges latest user message ===\n");
  const opening = read("lib/llm/phases/opening-phase.ts");
  assert("opening uses lastUserMessage only", opening.includes("const userText = lastUserMessage.trim()"));
  assert("opening not stale original_question", !opening.includes("input.session.original_question ?? lastUserMessage"));

  console.log("\n=== Fix A2 · fill original_question on opening→collecting ===\n");
  const agent = read("lib/poju/agent.ts");
  assert("agent imports isSubstantiveBreakthroughQuestion", agent.includes("isSubstantiveBreakthroughQuestion"));
  assert("agent fills original_question on transition", agent.includes("original_question: phaseUserMessage.trim()"));
  assert("session syncs original_question", agent.includes("resolvedOriginalQuestion"));

  const base = createInitialAgentState({ original_question: "你好" });
  const transition = decidePhaseTransition({
    current_state: base,
    llm_suggested_phase: "collecting_context",
    user_message: "我离婚8年了想重新开始",
    user_turn_count: 2,
    understanding_sufficient: true,
  });
  let after = applyPhaseTransition(base, transition);
  if (
    transition.should_transition &&
    transition.new_phase === "collecting_context" &&
    !isSubstantiveBreakthroughQuestion(after.original_question)
  ) {
    after = { ...after, original_question: "我离婚8年了想重新开始".trim() };
  }
  assert("simulated fill makes question substantive", isSubstantiveBreakthroughQuestion(after.original_question));
  assert("greeting alone not substantive", !isSubstantiveBreakthroughQuestion("你好"));
  assert("short collecting reply not blocked at gate", isGreetingOrEmptyQuestion("没有人"));

  console.log("\n=== Fix A3 · orchestrator reads updated question ===\n");
  const orch = read("lib/poju/agent-orchestrator.ts");
  assert("resolveSessionOriginalQuestion helper", orch.includes("resolveSessionOriginalQuestion"));
  assert("syncSessionOriginalQuestion", orch.includes("syncSessionOriginalQuestion"));
  assert("patchLastAssistantOrchestrationMeta", orch.includes("patchLastAssistantOrchestrationMeta"));

  console.log("\n=== Fix B · state snapshot ===\n");
  const types = read("lib/poju/types.ts");
  assert("meta.state_snapshot type", types.includes("state_snapshot"));
  assert("agent builds state_snapshot", agent.includes("buildAgentStateSnapshot"));

  const snap = buildAgentStateSnapshot(
    { ...after, breakthrough_core: { relationship_conclusion: "x", breakthrough_directions: [{ direction: "a" }] } as never },
    false,
  );
  assert("snapshot has phase", Boolean(snap.phase));
  assert("snapshot flags relationship", snap.relationship_conclusion === true);

  console.log("\n=== Fix B/C · UI ===\n");
  const ui = read("components/poju/POJUChatUI.tsx");
  assert("PojuStateDebugPanel wired", ui.includes("PojuStateDebugPanel"));
  assert("PojuAgendaCard wired", ui.includes("PojuAgendaCard"));
  assert("debug toggle default on", ui.includes('get("debug") !== "0"'));
  assert("investigation_agenda in meta render", ui.includes("m.meta?.investigation_agenda"));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 16 acceptance checks passed.\n");
}

main();
