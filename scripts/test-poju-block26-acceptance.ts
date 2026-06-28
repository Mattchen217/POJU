/**
 * Block 26 — agenda coverage quality gate + partial anti-loop
 * Run: pnpm exec tsx scripts/test-poju-block26-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { createInitialAgentState } from "@/lib/poju/agent-state";
import { selectCurrentAgendaFocus, type AgendaItem } from "@/lib/poju/investigation-agenda";
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

function item(id: string, label: string, critical: boolean, status: AgendaItem["status"]): AgendaItem {
  return { id, label, critical, status, supports: "dir A" };
}

function main(): void {
  console.log("\n========== POJU Block 26 Acceptance ==========\n");

  console.log("=== Prompt · quality gate + soft nudge ===\n");
  const base = read("lib/llm/prompts/poju-base.ts");
  assert("model judges answer quality", base.includes("有没有真正回答到这一项"));
  assert("soft nudge on vague answer", base.includes("方案的可行性会打折扣"));
  assert("max one follow-up round", base.includes("最多追问一轮"));

  console.log("\n=== State machine · partial fallback ===\n");
  const sm = read("lib/poju/state-machine.ts");
  assert("no userAnswered auto-cover", !sm.includes("userAnswered"));
  assert("partial state transition", sm.includes('"partial" as const'));
  assert("partial then covered fallback", /a\.status === "partial"[\s\S]*"covered"[\s\S]*"partial"/.test(sm));

  const agenda = [
    item("a1", "必查第一项", true, "unexplored"),
    item("a2", "必查第二项", true, "unexplored"),
  ];
  const agent = {
    ...createInitialAgentState({ original_question: "q" }),
    current_phase: "collecting_context" as const,
    investigation_agenda: agenda,
  };

  const modelCovers = advanceStateMachine(
    agent,
    extractModelTurnSignals({
      agenda_updates: { completed_in_this_turn: ["必查第一项"] },
    }),
    "这两年我几乎没接触过异性",
  );
  assert(
    "model reported complete → covered",
    modelCovers.next_agent.investigation_agenda?.[0]?.status === "covered",
  );

  const vagueFirst = advanceStateMachine(
    agent,
    extractModelTurnSignals({ agenda_updates: { completed_in_this_turn: [] } }),
    "还行吧，就那样",
  );
  assert(
    "vague answer without report → partial",
    vagueFirst.next_agent.investigation_agenda?.[0]?.status === "partial",
  );
  assert(
    "still focused on same item when partial",
    selectCurrentAgendaFocus(vagueFirst.next_agent.investigation_agenda ?? [])?.label === "必查第一项",
  );

  const partialAgent = {
    ...agent,
    investigation_agenda: [item("a1", "必查第一项", true, "partial"), item("a2", "必查第二项", true, "unexplored")],
  };
  const stillVague = advanceStateMachine(
    partialAgent,
    extractModelTurnSignals({ agenda_updates: { completed_in_this_turn: [] } }),
    "不想说",
  );
  assert(
    "second vague on partial → forced covered",
    stillVague.next_agent.investigation_agenda?.[0]?.status === "covered",
  );
  assert(
    "advances to next focus after forced cover",
    selectCurrentAgendaFocus(stillVague.next_agent.investigation_agenda ?? [])?.label === "必查第二项",
  );

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 26 acceptance checks passed.\n");
}

main();
