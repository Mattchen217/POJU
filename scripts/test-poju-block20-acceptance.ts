/**
 * Block 20 — phase transition + breakthrough core timing (no illegal collecting∧null-core)
 * Run: pnpm exec tsx scripts/test-poju-block20-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { createInitialAgentState, withCompleteUnderstanding } from "@/lib/poju/agent-state";
import {
  advanceStateMachine,
  extractModelTurnSignals,
} from "@/lib/poju/state-machine";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function assertCollectingCoreInvariant(
  agent: ReturnType<typeof createInitialAgentState>,
  label: string,
): void {
  if (agent.current_phase === "collecting_context") {
    assert(`${label}: collecting ⇒ core non-null`, agent.breakthrough_core != null);
  }
}

function postTurnOrchestrationBody(source: string): string {
  const m = source.match(
    /export async function runPostTurnOrchestration[\s\S]*?(?=\nexport async function|\n\/\*\* After user confirms)/,
  );
  return m?.[0] ?? "";
}

function main(): void {
  console.log("\n========== POJU Block 20 Acceptance ==========\n");

  console.log("=== Fix 1 · sync core in handleUserMessage, no post-turn trigger ===\n");
  const agentTs = read("lib/poju/agent.ts");
  const orch = read("lib/poju/agent-orchestrator.ts");
  assert("agent imports ensureBreakthroughCore", agentTs.includes("ensureBreakthroughCore"));
  assert("agent fallback ensureBreakthroughCore on missing inline core", agentTs.includes("inlineCoreReady"));
  assert("agent reverts to opening when core fails", agentTs.includes('current_phase: "opening"'));
  assert("orchestrator exports ensureBreakthroughCore", orch.includes("export async function ensureBreakthroughCore"));
  assert(
    "post-turn no deferred breakthrough trigger",
    !orch.includes("破局推理脊柱与调查议程已生成"),
  );
  assert("post-turn no per-turn ensureBaseAnalysis", !postTurnOrchestrationBody(orch).includes("ensureBaseAnalysis"));
  assert("confirmation pipeline still ensures base analysis", /runConfirmationPipeline[\s\S]*ensureBaseAnalysis/.test(orch));
  assert("UI ensures base analysis before send", read("components/poju/POJUChatUI.tsx").includes("ensureBaseAnalysisReady"));

  console.log("\n=== Fix 2 · collecting null-core guard + first insight once ===\n");
  const collecting = read("lib/llm/phases/collecting-phase.ts");
  assert("collecting null-core falls back to opening", collecting.includes("callOpeningPhase(input)"));
  assert("collecting first insight uses collecting_turn_count", collecting.includes("collecting_turn_count"));
  assert("collecting suppresses repeat first insight", collecting.includes("不要重复"));

  console.log("\n=== Fix 3 · base_analysis_ready gate ===\n");
  const sm = read("lib/poju/state-machine.ts");
  assert("state-machine has base_analysis_ready signal", sm.includes("base_analysis_ready"));
  assert("opening branch requires struct complete", sm.includes("isUnderstandingComplete(agent)"));
  assert("agent passes base_analysis_ready", agentTs.includes("base_analysis_ready:"));

  console.log("\n=== INV · collecting_context ⇒ breakthrough_core !== null ===\n");
  const agent = createInitialAgentState({ original_question: "" });

  assert(
    "insufficient understanding stays opening",
    advanceStateMachine(
      agent,
      extractModelTurnSignals({ understanding_sufficient: false, base_analysis_ready: true }),
      "你好",
    ).next_state === "opening",
  );

  assert(
    "sufficient but no base stays opening",
    advanceStateMachine(
      agent,
      extractModelTurnSignals({ understanding_sufficient: true, base_analysis_ready: false }),
      "我离婚8年了想重新开始",
    ).next_state === "opening",
  );

  const readyAdvance = advanceStateMachine(
    withCompleteUnderstanding({ ...agent, has_base_analysis: true }),
    extractModelTurnSignals({
      understanding_sufficient: true,
      base_analysis_ready: true,
      substantive_opening_turns: 2,
    }),
    "我离婚8年了想重新开始",
  );
  assert("ready advance enters collecting", readyAdvance.next_state === "collecting_context");
  assert("ready advance triggers core", readyAdvance.trigger_breakthrough_core === true);

  const withCore = {
    ...readyAdvance.next_agent,
    breakthrough_core: {
      relationship_conclusion: "test",
      breakthrough_directions: [],
      generated_at: new Date().toISOString(),
    },
  };
  assertCollectingCoreInvariant(withCore, "simulated post-sync state");

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 20 acceptance checks passed.\n");
}

main();
