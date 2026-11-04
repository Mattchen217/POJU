/**
 * Opening · minimum_interaction_gate (independent of understanding_sufficient)
 *
 *   pnpm exec tsx scripts/test-opening-minimum-interaction-gate.ts
 */

import { createInitialAgentState, withCompleteUnderstanding } from "@/lib/poju/agent-state";
import {
  OPENING_MIN_SUBSTANTIVE_TURNS,
  countSubstantiveOpeningTurns,
  isMinimumInteractionGateMet,
} from "@/lib/poju/opening-interaction-gate";
import { advanceStateMachine, extractModelTurnSignals } from "@/lib/poju/state-machine";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const failures: string[] = [];

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function main(): void {
  console.log("\n=== Opening minimum_interaction_gate ===\n");

  assert("MIN turns = 2", OPENING_MIN_SUBSTANTIVE_TURNS === 2);
  assert("turns 0 not met", !isMinimumInteractionGateMet(0));
  assert("turns 1 not met", !isMinimumInteractionGateMet(1));
  assert("turns 2 met", isMinimumInteractionGateMet(2));
  assert("turns 3 met", isMinimumInteractionGateMet(3));

  const msgs = [
    { role: "user" as const, content: "你好", timestamp: "t0" },
    {
      role: "user" as const,
      content: "我在考虑要不要辞职创业，对工作不满又怕冲动，想判断值不值得。",
      timestamp: "t1",
    },
    { role: "assistant" as const, content: "校准问…", timestamp: "t2" },
    {
      role: "user" as const,
      content: "就算工作变好我仍想做独立 AI 项目。",
      timestamp: "t3",
    },
  ];
  assert("count ignores greeting-only", countSubstantiveOpeningTurns(msgs) === 2);

  const complete = withCompleteUnderstanding(
    createInitialAgentState({ original_question: "要不要辞职创业" }),
  );

  const early = advanceStateMachine(
    { ...complete, has_base_analysis: true, opening_substantive_turns: 1 },
    extractModelTurnSignals({
      understanding_sufficient: true,
      base_analysis_ready: true,
      substantive_opening_turns: 1,
      opening_problem_statement: "要不要辞职创业",
    }),
    "我在考虑要不要辞职创业，对工作不满又怕冲动，想判断值不值得。",
  );
  assert(
    "info complete on turn1 stays opening (interaction gate)",
    early.next_state === "opening",
  );
  assert(
    "early block reason mentions interaction",
    /minimum_interaction|interaction/i.test(early.transition_reason ?? ""),
  );

  const ready = advanceStateMachine(
    { ...complete, has_base_analysis: true, opening_substantive_turns: 2 },
    extractModelTurnSignals({
      understanding_sufficient: true,
      base_analysis_ready: true,
      substantive_opening_turns: 2,
      opening_problem_statement: "要不要辞职创业",
    }),
    "就算工作变好我仍想做独立 AI 项目。",
  );
  assert(
    "turn2 + info complete → awaiting_understanding_confirm",
    ready.next_state === "awaiting_understanding_confirm",
  );

  const openingRules = readFileSync(
    resolve("lib/llm/phases/opening-phase-v6.ts"),
    "utf8",
  );
  assert(
    "opening prompt names minimum_interaction_gate",
    openingRules.includes("minimum_interaction_gate"),
  );
  assert(
    "opening prompt forbids empty padding",
    openingRules.includes("再详细介绍一下") || openingRules.includes("空洞凑轮"),
  );
  assert(
    "opening prompt keeps gates independent",
    openingRules.includes("两道独立闸") || openingRules.includes("独立于"),
  );

  const sm = readFileSync(resolve("lib/poju/state-machine.ts"), "utf8");
  assert(
    "state-machine uses OPENING_MIN_SUBSTANTIVE_TURNS",
    sm.includes("turns >= OPENING_MIN_SUBSTANTIVE_TURNS"),
  );

  console.log("\n=== Summary ===\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All minimum_interaction_gate checks passed.\n");
}

main();
