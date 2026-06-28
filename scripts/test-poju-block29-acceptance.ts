/**
 * Block 29 — remove legacy summary form + full agenda gate + conversational confirmation
 * Run: pnpm exec tsx scripts/test-poju-block29-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { createInitialAgentState } from "@/lib/poju/agent-state";
import { AGENDA_COVERED_GATE } from "@/lib/poju/agent-state";
import type { AgendaItem } from "@/lib/poju/investigation-agenda";
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
  console.log("\n========== POJU Block 29 Acceptance ==========\n");

  console.log("=== Part 1 · full agenda coverage gate ===\n");
  assert("AGENDA_COVERED_GATE is 100%", AGENDA_COVERED_GATE === 1);
  const sm = read("lib/poju/state-machine.ts");
  assert("state machine requires full coverage", sm.includes("cov.coveredRatio >= 1"));

  const agent = createInitialAgentState({ original_question: "q" });
  const collectingAgent = {
    ...agent,
    current_phase: "collecting_context" as const,
    has_base_analysis: true,
  };
  const notFull = advanceStateMachine(
    {
      ...collectingAgent,
      investigation_agenda: [
        item("a1", "1", "covered"),
        item("a2", "2", "covered"),
        item("a3", "3", "covered"),
        item("a4", "4", "covered"),
        item("a5", "5", "unexplored"),
      ],
    },
    extractModelTurnSignals({ agenda_updates: { completed_in_this_turn: [] } }),
    "还行",
  );
  assert("4/5 stays collecting", notFull.next_state === "collecting_context");

  const allFive = advanceStateMachine(
    {
      ...collectingAgent,
      investigation_agenda: [
        item("a1", "1", "covered"),
        item("a2", "2", "covered"),
        item("a3", "3", "covered"),
        item("a4", "4", "covered"),
        item("a5", "5", "covered"),
      ],
    },
    extractModelTurnSignals({ agenda_updates: { completed_in_this_turn: [] } }),
    "好的",
  );
  assert("5/5 enters awaiting_confirmation", allFive.next_state === "awaiting_confirmation");

  console.log("\n=== Part 2 · legacy summary form removed ===\n");
  const ui = read("components/poju/POJUChatUI.tsx");
  const orch = read("lib/poju/agent-orchestrator.ts");
  assert("no ContextSummaryEditor in UI", !ui.includes("ContextSummaryEditor"));
  assert("no downgrade effect in UI", !ui.includes("downgradePrematureConfirmationPhase"));
  assert("orchestrator no ensureContextSummary", !orch.includes("function ensureContextSummary"));

  console.log("\n=== Part 3 · conversational confirmation signal ===\n");
  const base = read("lib/llm/prompts/poju-base.ts");
  const confirm = read("lib/llm/phases/confirmation-phase.ts");
  const agentTs = read("lib/poju/agent.ts");
  assert("awaiting_confirmation chat summary prompt", base.includes("对话式核对"));
  assert("confirmation_signal in contract", base.includes("confirmation_signal"));
  assert("confirmation phase parses signal", confirm.includes("confirmation_signal"));
  assert("state machine reads confirmation_signal", sm.includes('sig === "confirmed"'));
  assert("delivery pipeline on trigger", agentTs.includes("maybeRunDeliveryPipeline"));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 29 acceptance checks passed.\n");
}

main();
