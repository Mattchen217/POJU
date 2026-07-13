/**
 * Block 85 — Understanding confirmation gate (segment 1 → 2)
 *
 *   pnpm exec tsx scripts/test-poju-block85-understanding-confirm-gate.ts
 */
import fs from "node:fs";
import path from "node:path";
import { createInitialAgentState, withCompleteUnderstanding } from "@/lib/poju/agent-state";
import { advanceStateMachine, extractModelTurnSignals } from "@/lib/poju/state-machine";

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
  console.log("\n========== POJU Block 85 · Understanding confirm gate ==========\n");

  const sm = read("lib/poju/state-machine.ts");
  const agent = read("lib/poju/agent.ts");
  const opening = read("lib/llm/phases/opening-phase-v6.ts");
  const ui = read("components/poju/POJUChatUI.tsx");
  const reply = read("lib/poju/understanding-gate-reply.ts");
  const gateUi = read("components/poju/UnderstandingGateActions.tsx");
  const zhMsgs = read("messages/zh.json");
  const enMsgs = read("messages/en.json");

  assert("state machine has awaiting_understanding_confirm", sm.includes("awaiting_understanding_confirm"));
  assert("canAdvance requires model sufficient", sm.includes("modelDone") && sm.includes("understanding_sufficient === true"));
  assert("confirm triggers segment2", sm.includes('sig === "confirmed"') && sm.includes("triggerCore = true"));
  assert("supplement returns opening", sm.includes('sig === "wants_to_add"') && sm.includes('nextState = "opening"'));

  assert("opening sufficient=true summary only no追问", opening.includes("understanding_sufficient=true") && opening.includes("不得") && opening.includes("追问"));
  assert("handleUnderstandingGateAction exported", agent.includes("export async function handleUnderstandingGateAction"));
  assert("applyUnderstandingGateSupplement exported", read("lib/poju/phases/opening/control.ts").includes("export function applyUnderstandingGateSupplement"));
  assert("confirm supports optimistic user append", agent.includes("userAlreadyAppended"));
  assert("UI optimistic confirm flow", ui.includes("buildOptimisticUserMessage(userLabel)"));
  assert("UI supplement opens composer only", ui.includes("applyUnderstandingGateSupplement"));
  assert("buildUnderstandingGateSummaryFromFields via opening display", read("lib/poju/phases/opening/display.ts").includes("buildUnderstandingGateSummaryFromFields") && agent.includes("resolveOpeningTurnReply"));
  assert("understanding_gate_pending meta", agent.includes("understanding_gate_pending"));
  assert("UI imports phase-router", ui.includes("@/lib/poju/phase-router"));

  assert("UI uses i18n gate labels", gateUi.includes('t("understanding_gate_confirm")'));
  assert("gate confirm label zh", zhMsgs.includes('"understanding_gate_confirm": "对，就是这样"'));
  assert("gate confirm label en", enMsgs.includes('"understanding_gate_confirm": "Yes, that\'s right"'));
  assert("UI understanding gate buttons", ui.includes("UnderstandingGateActions"));
  assert("UI composer locked at gate", ui.includes("understandingGatePending"));
  assert("UI handleUnderstandingGateClick", ui.includes("handleUnderstandingGateClick"));

  assert("server gate labels multilingual", reply.includes('confirm: "Ja, genau so"') && reply.includes('confirm: "Sí, es así"'));

  const agentState = withCompleteUnderstanding(
    createInitialAgentState({ original_question: "徒弟坐了我的位置" }),
  );
  const toGate = advanceStateMachine(
    agentState,
    extractModelTurnSignals({
      understanding_sufficient: true,
      base_analysis_ready: true,
      substantive_opening_turns: 2,
      opening_problem_statement: "徒弟坐了我的位置",
    }),
    "我最想保住手艺传承",
  );
  assert("runtime: struct complete → awaiting_understanding_confirm", toGate.next_agent.current_phase === "awaiting_understanding_confirm");
  assert("runtime: gate turn does not trigger core", toGate.trigger_breakthrough_core === false);

  const structOnly = advanceStateMachine(
    agentState,
    extractModelTurnSignals({
      understanding_sufficient: false,
      base_analysis_ready: true,
      substantive_opening_turns: 2,
    }),
    "我最想保住手艺传承",
  );
  assert("runtime: struct complete but model not sufficient stays opening", structOnly.next_agent.current_phase === "opening");
  assert("runtime: no confirm gate while model still asking", structOnly.trigger_breakthrough_core === false);

  const confirmed = advanceStateMachine(
    toGate.next_agent,
    extractModelTurnSignals({ confirmation_signal: "confirmed" }),
    "对，就是这样",
  );
  assert("runtime: confirmed → collecting", confirmed.next_agent.current_phase === "collecting_context");
  assert("runtime: confirmed triggers core", confirmed.trigger_breakthrough_core === true);

  const supplement = advanceStateMachine(
    toGate.next_agent,
    extractModelTurnSignals({ confirmation_signal: "wants_to_add" }),
    "我还想补充一点",
  );
  assert("runtime: supplement → opening", supplement.next_agent.current_phase === "opening");
  assert("runtime: supplement no core", supplement.trigger_breakthrough_core === false);

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 85 checks passed.\n");
}

main();
