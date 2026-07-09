/**
 * Block 69 — 收集覆盖真校验 + 回复收尾兜底（跳过角度 / 腰斩）
 *
 *   pnpm exec tsx scripts/test-poju-block69-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { createInitialAgentState } from "@/lib/poju/agent-state";
import {
  appendForwardMove,
  hasQuestionCue,
} from "@/lib/poju/collecting-focus-reply";
import {
  buildStaleAgendaCatchupBlock,
  isAgendaFullyCovered,
  selectCurrentAgendaFocus,
  STALE_AGENDA_TURN_THRESHOLD,
  type AgendaItem,
} from "@/lib/poju/investigation-agenda";
import {
  advanceStateMachine,
  extractModelTurnSignals,
} from "@/lib/poju/state-machine";
import { POJU_V6_STATIC_SYSTEM } from "@/lib/llm/prompts/poju-base-v6";

const ROOT = path.join(__dirname, "..");

function assert(name: string, ok: boolean, detail = ""): void {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function item(
  id: string,
  label: string,
  status: AgendaItem["status"],
  stale = 0,
): AgendaItem {
  return { id, label, critical: true, status, supports: "dir A", stale_turns: stale };
}

console.log("\n=== Block 69 acceptance ===\n");

const sm = read("lib/poju/state-machine.ts");
const agentTs = read("lib/poju/agent.ts");
const v6Ctx = read("lib/llm/phases/oriental-prompt-context-v6.ts");

assert("state machine filters reported to focus label", sm.includes("reportedRaw.filter"));
assert("state machine uses isAgendaFullyCovered", sm.includes("isAgendaFullyCovered"));
assert("agent ignores agenda_status_updates during collecting", agentTs.includes('!== "collecting_context"'));
assert("agent uses appendForwardMove", agentTs.includes("appendForwardMove"));
assert("v6 injects stale agenda catchup", v6Ctx.includes("buildStaleAgendaCatchupBlock"));

const fourAngleAgenda = [
  item("a1", "角度一", "covered"),
  item("a2", "角度二", "covered"),
  item("a3", "角度三", "unexplored"),
  item("a4", "角度四", "unexplored"),
];
const skipAgent = {
  ...createInitialAgentState({ original_question: "q" }),
  current_phase: "collecting_context" as const,
  investigation_agenda: fourAngleAgenda,
};
const skipAdvance = advanceStateMachine(
  skipAgent,
  extractModelTurnSignals({
    agenda_updates: { completed_in_this_turn: ["角度四"] },
  }),
  "用户回答",
);
assert(
  "wrong-label report does not cover non-focus item",
  skipAdvance.next_agent.investigation_agenda?.find((a) => a.id === "a4")?.status === "unexplored",
);
assert(
  "focus item gets partial from user input",
  skipAdvance.next_agent.investigation_agenda?.find((a) => a.id === "a3")?.status === "partial",
);
assert(
  "cannot enter confirmation with skipped angle",
  skipAdvance.next_state === "collecting_context",
);

const staleAgenda = [
  item("a1", "角度一", "covered"),
  item("a2", "角度二", "unexplored", STALE_AGENDA_TURN_THRESHOLD),
  item("a3", "角度三", "unexplored"),
];
assert(
  "focus picks stalest pending angle",
  selectCurrentAgendaFocus(staleAgenda)?.label === "角度二",
);

const catchup = buildStaleAgendaCatchupBlock(
  { ...createInitialAgentState({ original_question: "q" }), investigation_agenda: staleAgenda },
  "zh",
);
assert("catchup names stale label", catchup.includes("角度二") && catchup.includes("不要跳过"));
assert("catchup NOT in static system", !POJU_V6_STATIC_SYSTEM.includes("不要跳过"));

const fullAgenda = [
  item("a1", "角度一", "covered"),
  item("a2", "角度二", "covered"),
  item("a3", "角度三", "covered"),
  item("a4", "角度四", "covered"),
];
assert("isAgendaFullyCovered when all covered", isAgendaFullyCovered(fullAgenda));
assert("not fully covered with gap", !isAgendaFullyCovered(fourAngleAgenda));

const halfInsight = "你把风险边界画出来了。";
const withMove = appendForwardMove(
  halfInsight,
  {
    ...createInitialAgentState({ original_question: "q" }),
    investigation_agenda: [item("a1", "团队分工怎么定", "unexplored")],
  },
  "zh",
);
assert("appendForwardMove adds question", hasQuestionCue(withMove));
assert("appendForwardMove keeps insight", withMove.includes("风险边界"));

console.log("\nDone.\n");
