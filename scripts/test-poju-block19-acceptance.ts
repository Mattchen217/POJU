/**
 * Block 19 Part A–D — deterministic state machine + JSON snapshot wiring
 * Run: pnpm exec tsx scripts/test-poju-block19-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { createInitialAgentState } from "@/lib/poju/agent-state";
import {
  advanceStateMachine,
  buildStateSnapshot,
  buildTurnContextSnapshot,
  extractModelTurnSignals,
  resolveActiveAgentPhase,
} from "@/lib/poju/state-machine";
import { buildPojuChatCoreSections, POJU_OUTPUT_FORMAT } from "@/lib/llm/prompts/poju-base";
import type { POJUSessionState } from "@/lib/poju/types";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function exists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function main(): void {
  console.log("\n========== POJU Block 19 Acceptance (A–D) ==========\n");

  console.log("=== Part A · state-machine module ===\n");
  assert("state-machine.ts exists", exists("lib/poju/state-machine.ts"));
  assert("poju-phase-router removed", !exists("lib/llm/poju-phase-router.ts"));
  assert("state-ledger removed", !exists("lib/llm/phases/state-ledger.ts"));

  const agent = createInitialAgentState({ original_question: "" });
  const snap = buildStateSnapshot(agent);
  assert("snapshot current_state opening", snap.state_ledger.current_state === "opening");
  assert("snapshot has agenda_checklist", Array.isArray(snap.state_ledger.agenda_checklist.pending));

  assert(
    "greeting blocked when insufficient",
    advanceStateMachine(
      agent,
      extractModelTurnSignals({ understanding_sufficient: false }),
      "你好",
    ).next_state === "opening",
  );
  const substantiveAdvance = advanceStateMachine(
    { ...agent, has_base_analysis: true, opening_substantive_turns: 1 },
    extractModelTurnSignals({ understanding_sufficient: true, base_analysis_ready: true }),
    "我离婚8年了想重新开始",
  );
  assert("substantive enters collecting when base ready and turns met", substantiveAdvance.next_state === "collecting_context");
  assert("trigger core true when sufficient and base ready", substantiveAdvance.trigger_breakthrough_core === true);
  assert(
    "first substantive turn stays opening when message short",
    advanceStateMachine(
      { ...agent, has_base_analysis: true },
      extractModelTurnSignals({ understanding_sufficient: true, base_analysis_ready: true }),
      "我离婚8年了想重新开始",
    ).next_state === "opening",
  );
  assert(
    "rich single message enters collecting on first turn",
    advanceStateMachine(
      { ...agent, has_base_analysis: true },
      extractModelTurnSignals({ understanding_sufficient: true, base_analysis_ready: true }),
      "我".repeat(80),
    ).next_state === "collecting_context",
  );
  assert(
    "sufficient without base stays opening",
    advanceStateMachine(
      agent,
      extractModelTurnSignals({ understanding_sufficient: true, base_analysis_ready: false }),
      "我离婚8年了想重新开始",
    ).next_state === "opening",
  );

  const session = {
    session_id: "s",
    original_question: "q",
    messages: [],
    main_delivery_done: false,
    agent_v2: createInitialAgentState({ original_question: "q" }),
  } as unknown as POJUSessionState;
  assert("resolveActiveAgentPhase opening", resolveActiveAgentPhase(session) === "opening");

  console.log("\n=== Part B · agent uses advanceStateMachine ===\n");
  const agentTs = read("lib/poju/agent.ts");
  assert("agent imports advanceStateMachine", agentTs.includes("advanceStateMachine"));
  assert("agent no decidePhaseTransition", !agentTs.includes("decidePhaseTransition"));
  const opening = read("lib/llm/phases/opening-phase.ts");
  assert("opening no regex gate", !opening.includes("isGreetingOrEmptyQuestion"));
  assert("opening parses understanding_sufficient", opening.includes("parsed.understanding_sufficient"));

  console.log("\n=== Part C · JSON snapshot in turn context ===\n");
  const oriental = read("lib/llm/phases/oriental-prompt-context.ts");
  assert("oriental uses buildTurnContextSnapshot", oriental.includes("buildTurnContextSnapshot"));
  assert("oriental includes SYSTEM STATE MACHINE SNAPSHOT", oriental.includes("[SYSTEM STATE MACHINE SNAPSHOT]") || read("lib/poju/state-machine.ts").includes("[SYSTEM STATE MACHINE SNAPSHOT]"));
  const ctx = buildTurnContextSnapshot(agent);
  assert("turn context is JSON", ctx.includes('"state_ledger"'));

  const sysA = buildPojuChatCoreSections("en").join("\n");
  const sysB = buildPojuChatCoreSections("en").join("\n");
  assert("static system byte-stable", sysA === sysB);

  console.log("\n=== Part D · output contract keys ===\n");
  assert("POJU_OUTPUT_FORMAT has understanding_sufficient", POJU_OUTPUT_FORMAT.includes("`understanding_sufficient`"));
  assert("POJU_OUTPUT_FORMAT has topic_drift_signal", POJU_OUTPUT_FORMAT.includes("`topic_drift_signal`"));
  assert("POJU_OUTPUT_FORMAT has agenda_updates", POJU_OUTPUT_FORMAT.includes("`agenda_updates`"));
  assert("POJU_OUTPUT_FORMAT has user_confirms_delivery", POJU_OUTPUT_FORMAT.includes("`user_confirms_delivery`"));
  assert("serialize whitelist has understanding_sufficient", read("lib/poju/serialize-chat-payload.ts").includes('"understanding_sufficient"'));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 19 (A–D) acceptance checks passed.\n");
}

main();
