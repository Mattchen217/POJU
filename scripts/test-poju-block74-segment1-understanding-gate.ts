/**
 * Block 74 — Segment 1 understanding gate (control plane, not model self-report)
 *
 *   pnpm exec tsx scripts/test-poju-block74-segment1-understanding-gate.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  createInitialAgentState,
  getUnderstandingMissingFields,
  isUnderstandingComplete,
  mergeCoreDilemma,
  mergeDesiredDirection,
  withCompleteUnderstanding,
  decidePhaseTransition,
} from "@/lib/poju/agent-state";
import {
  advanceStateMachine,
  buildStateSnapshot,
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

function main(): void {
  console.log("\n========== POJU Block 74 · Segment 1 understanding gate ==========\n");

  const agentState = read("lib/poju/agent-state.ts");
  const sm = read("lib/poju/state-machine.ts");
  const opening = read("lib/llm/phases/opening-phase-v6.ts");

  assert("CoreDilemma fields defined", agentState.includes("concrete_event"));
  assert("DesiredDirection fields defined", agentState.includes("desired_direction"));
  assert("isUnderstandingComplete exported", agentState.includes("export function isUnderstandingComplete"));
  assert("reserved delivery_report", agentState.includes("delivery_report"));
  assert("state-machine uses isUnderstandingComplete", sm.includes("isUnderstandingComplete(agent)"));
  assert("opening gate uses structComplete", sm.includes("const structComplete = isUnderstandingComplete(agent)"));
  assert("opening prompt core_dilemma", opening.includes("core_dilemma"));
  assert("opening prompt desired_direction", opening.includes("desired_direction"));
  assert("opening must ask desired direction", opening.includes("你最希望这件事往哪个方向走"));
  assert("opening three-field close", opening.includes("只收三样：问题、情况、期望"));
  assert("opening bans means drill-down", opening.includes("严禁下钻到手段的执行细节"));
  assert("opening mergeCoreDilemma", opening.includes("mergeCoreDilemma"));

  const empty = createInitialAgentState({ original_question: "test" });
  assert("empty agent incomplete", !isUnderstandingComplete(empty));
  assert("empty missing 3 fields", getUnderstandingMissingFields(empty).length === 3);

  const partial = {
    ...empty,
    core_dilemma: mergeCoreDilemma(null, {
      concrete_event: "离婚8年",
      stakes: null,
      sticking_point: null,
    }),
    desired_direction: mergeDesiredDirection(null, { wants: null, priority: null }),
  };
  assert("partial still incomplete", !isUnderstandingComplete(partial));

  const threeFieldReady = {
    ...empty,
    core_dilemma: mergeCoreDilemma(null, {
      concrete_event: "很多年没收入、想知道怎么才能好起来",
      stakes: "试过很多需融资的项目都没成、现在在做个自己能开发的小项目",
      sticking_point: null,
    }),
    desired_direction: mergeDesiredDirection(null, {
      wants: "这个项目上线后能直接带来稳定收入，解决生存问题",
      priority: null,
    }),
  };
  assert("three required fields complete without optional", isUnderstandingComplete(threeFieldReady));
  assert("three-field missing list empty", getUnderstandingMissingFields(threeFieldReady).length === 0);

  const complete = withCompleteUnderstanding(empty);
  assert("fixture complete", isUnderstandingComplete(complete));
  assert("no length minimum on fields", isUnderstandingComplete(complete));

  assert(
    "struct complete but no base stays opening",
    advanceStateMachine(
      complete,
      extractModelTurnSignals({ understanding_sufficient: true, base_analysis_ready: false }),
      "用户消息",
    ).next_state === "opening",
  );

  assert(
    "struct complete + base but model not sufficient stays opening",
    advanceStateMachine(
      { ...complete, has_base_analysis: true },
      extractModelTurnSignals({ understanding_sufficient: false, base_analysis_ready: true }),
      "用户消息",
    ).next_state === "opening",
  );

  assert(
    "struct complete + base + model sufficient enters confirm gate",
    advanceStateMachine(
      { ...complete, has_base_analysis: true },
      extractModelTurnSignals({ understanding_sufficient: true, base_analysis_ready: true }),
      "用户消息",
    ).next_state === "awaiting_understanding_confirm",
  );

  assert(
    "model sufficient but struct incomplete stays opening",
    advanceStateMachine(
      { ...empty, has_base_analysis: true },
      extractModelTurnSignals({ understanding_sufficient: true, base_analysis_ready: true }),
      "用户消息",
    ).next_state === "opening",
  );

  const snap = buildStateSnapshot(empty);
  assert("snapshot understanding_gate", snap.state_ledger.understanding_gate.complete === false);
  assert("snapshot missing list", snap.state_ledger.understanding_gate.missing.length === 3);

  const legacy = decidePhaseTransition({
    current_state: empty,
    llm_suggested_phase: "collecting_context",
    user_message: "卡了三年想转行",
    understanding_sufficient: true,
  });
  assert("decidePhaseTransition ignores model sufficient", !legacy.should_transition);

  const blockedStruct = decidePhaseTransition({
    current_state: complete,
    llm_suggested_phase: "collecting_context",
    user_message: "卡了三年想转行",
    understanding_sufficient: false,
  });
  assert("decidePhaseTransition blocks struct complete without model sufficient", !blockedStruct.should_transition);

  const allowed = decidePhaseTransition({
    current_state: complete,
    llm_suggested_phase: "collecting_context",
    user_message: "卡了三年想转行",
    understanding_sufficient: true,
  });
  assert("decidePhaseTransition allows struct complete with model sufficient", allowed.should_transition);

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 74 checks passed.\n");
}

main();
