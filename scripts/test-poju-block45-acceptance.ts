/**
 * Block 45 — opening understanding gate: dilemma not topic; panel binds phase exit.
 * Run: pnpm exec tsx scripts/test-poju-block45-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { createInitialAgentState } from "@/lib/poju/agent-state";
import { buildAgentStateSnapshot } from "@/lib/poju/agent-state-snapshot";
import { buildStateSnapshot } from "@/lib/poju/state-machine";

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
  console.log("\n=== Block 45 acceptance ===\n");

  const base = read("lib/llm/prompts/poju-base.ts");
  assert("opening targets dilemma not topic", base.includes("把\"困境\"问清楚，不是把\"话题\"接住"));
  assert("one-liner divorce example false", base.includes("我离婚8年，什么时候再婚"));
  assert("understanding needs three things", base.includes("具体处境") && base.includes("真正的利害"));
  assert("warm teacher not interrogation", base.includes("像一位有温度的老师"));
  assert("each turn insight then question", base.includes("每轮都先给他一点收获"));
  assert("turns>=2 guard preserved in state-machine", read("lib/poju/state-machine.ts").includes("turns >= OPENING_MIN_SUBSTANTIVE_TURNS"));

  const snapSrc = read("lib/poju/state-machine.ts");
  assert("buildStateSnapshot has problem_understood flag", snapSrc.includes("problem_understood:"));

  const panelSrc = read("lib/poju/agent-state-snapshot.ts");
  assert("panel binds problem_understood to phase exit", panelSrc.includes("agentPhaseToPojuState"));
  assert("panel no has_base_analysis shortcut", !panelSrc.includes("has_base_analysis"));

  const openingAgent = createInitialAgentState({ original_question: "" });
  openingAgent.current_phase = "opening";
  const openingSnap = buildAgentStateSnapshot(openingAgent);
  assert("opening panel ① gray", openingSnap.problem_understood === false);

  const falsePositive = createInitialAgentState({ original_question: "" });
  falsePositive.current_phase = "opening";
  falsePositive.has_base_analysis = true;
  const falseSnap = buildAgentStateSnapshot(falsePositive);
  assert("opening with base_analysis still gray ①", falseSnap.problem_understood === false);

  const collecting = createInitialAgentState({ original_question: "我离婚8年，什么时候再婚？" });
  collecting.current_phase = "collecting_context";
  const collectSnap = buildAgentStateSnapshot(collecting);
  assert("collecting with locked question green ①", collectSnap.problem_understood === true);

  const ledger = buildStateSnapshot(collecting);
  assert("ledger problem_understood true after opening", ledger.state_ledger.flags.problem_understood === true);
  assert("ledger problem_understood false in opening", buildStateSnapshot(openingAgent).state_ledger.flags.problem_understood === false);

  console.log("\n=== Summary ===\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 45 checks passed.\n");
}

main();
