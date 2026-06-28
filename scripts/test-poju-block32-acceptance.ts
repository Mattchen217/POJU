/**
 * Block 32 — final delivery timeout + one agenda item per turn
 * Run: pnpm exec tsx scripts/test-poju-block32-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { createInitialAgentState } from "@/lib/poju/agent-state";
import { selectCurrentAgendaFocus, type AgendaItem } from "@/lib/poju/investigation-agenda";
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

function item(id: string, label: string, status: AgendaItem["status"]): AgendaItem {
  return { id, label, critical: true, status, supports: "dir A" };
}

function main(): void {
  console.log("\n========== POJU Block 32 Acceptance ==========\n");

  console.log("=== Fix 1 · final delivery timeout ===\n");
  const route = read("app/api/poju/final-delivery/route.ts");
  assert("maxDuration 300", route.includes("export const maxDuration = 300"));
  assert("delivery timeout_ms 270s", route.includes("timeout_ms: 270_000"));

  console.log("\n=== Fix 2 · one focus per turn ===\n");
  const sm = read("lib/poju/state-machine.ts");
  assert("non-focus items skipped", sm.includes("if (!focus || a.label !== focus.label) return a"));

  const agenda = [
    item("a1", "必查第一项", "unexplored"),
    item("a2", "必查第二项", "unexplored"),
    item("a3", "必查第三项", "unexplored"),
    item("a4", "必查第四项", "unexplored"),
  ];
  const agent = {
    ...createInitialAgentState({ original_question: "q" }),
    current_phase: "collecting_context" as const,
    investigation_agenda: agenda,
  };

  const multiReport = advanceStateMachine(
    agent,
    extractModelTurnSignals({
      agenda_updates: { completed_in_this_turn: ["必查第一项", "必查第二项"] },
    }),
    "用户回答",
  );
  assert(
    "only current focus covered when model reports multiple",
    multiReport.next_agent.investigation_agenda?.[0]?.status === "covered" &&
      multiReport.next_agent.investigation_agenda?.[1]?.status === "unexplored",
  );
  assert(
    "next focus is second item",
    selectCurrentAgendaFocus(multiReport.next_agent.investigation_agenda ?? [])?.label === "必查第二项",
  );

  const agentTs = read("lib/poju/agent.ts");
  assert("delivery graceful fallback", agentTs.includes("maybeRunDeliveryPipeline"));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 32 acceptance checks passed.\n");
}

main();
