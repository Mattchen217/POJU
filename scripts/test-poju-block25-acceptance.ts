/**
 * Block 25 — agenda current_focus + bare keep_cn soft term wrapping
 * Run: pnpm exec tsx scripts/test-poju-block25-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { createInitialAgentState } from "@/lib/poju/agent-state";
import { selectCurrentAgendaFocus, type AgendaItem } from "@/lib/poju/investigation-agenda";
import {
  advanceStateMachine,
  buildStateSnapshot,
  extractModelTurnSignals,
} from "@/lib/poju/state-machine";
import { wrapBareKeepCnSoftTerms } from "@/lib/llm/sanitize/term-marking";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function agendaItem(id: string, label: string, critical: boolean, status: AgendaItem["status"]): AgendaItem {
  return { id, label, critical, status, supports: "dir A" };
}

function main(): void {
  console.log("\n========== POJU Block 25 Acceptance ==========\n");

  console.log("=== Fix 1 · current_focus + controlled collection ===\n");
  const sm = read("lib/poju/state-machine.ts");
  const base = read("lib/llm/prompts/poju-base.ts");
  assert("snapshot has current_focus", sm.includes("current_focus"));
  assert("selectCurrentAgendaFocus used", sm.includes("selectCurrentAgendaFocus"));
  assert("partial fallback marks focus", sm.includes('"partial" as const'));
  assert("prompt uses current_focus", base.includes("agenda_checklist.current_focus"));

  const agenda = [
    agendaItem("a1", "必查第一项", true, "unexplored"),
    agendaItem("a2", "必查第二项", true, "unexplored"),
    agendaItem("a3", "补充项", false, "unexplored"),
  ];
  assert("focus picks first critical", selectCurrentAgendaFocus(agenda)?.label === "必查第一项");

  const agent = {
    ...createInitialAgentState({ original_question: "q" }),
    current_phase: "collecting_context" as const,
    investigation_agenda: agenda,
  };
  const snap = buildStateSnapshot(agent);
  assert("snapshot current_focus set", snap.state_ledger.agenda_checklist.current_focus === "必查第一项");

  const afterAnswer = advanceStateMachine(
    agent,
    extractModelTurnSignals({
      agenda_updates: { completed_in_this_turn: ["必查第一项"] },
    }),
    "这两年我几乎没接触过异性，心里还是怕",
  );
  assert(
    "model-reported complete covers focus",
    afterAnswer.next_agent.investigation_agenda?.[0]?.status === "covered",
  );
  assert(
    "next focus advances to second critical",
    selectCurrentAgendaFocus(afterAnswer.next_agent.investigation_agenda ?? [])?.label === "必查第二项",
  );

  console.log("\n=== Fix 2 · bare keep_cn soft terms ===\n");
  assert("output format repeat marking rule", base.includes("每一次出现都要套"));
  assert("wrapBareKeepCnSoftTerms exists", read("lib/llm/sanitize/term-marking.ts").includes("wrapBareKeepCnSoftTerms"));
  const wrapped = wrapBareKeepCnSoftTerms("当前人生阶段（丁酉）偏守。", "zh");
  assert("decade bare phrase wrapped", wrapped.includes("⟦t:decade|人生阶段（丁酉）"));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 25 acceptance checks passed.\n");
}

main();
