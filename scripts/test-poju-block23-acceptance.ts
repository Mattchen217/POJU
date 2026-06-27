/**
 * Block 23 — opening control-plane threshold + chat flash stability
 * Run: pnpm exec tsx scripts/test-poju-block23-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { createInitialAgentState } from "@/lib/poju/agent-state";
import {
  advanceStateMachine,
  extractModelTurnSignals,
  OPENING_MIN_SUBSTANTIVE_TURNS,
  OPENING_RICH_CHARS,
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
  console.log("\n========== POJU Block 23 Acceptance ==========\n");

  console.log("=== Part 1 · opening threshold (control plane only) ===\n");
  const sm = read("lib/poju/state-machine.ts");
  const agentTs = read("lib/poju/agent.ts");
  assert("OPENING_RICH_CHARS exported", sm.includes("OPENING_RICH_CHARS"));
  assert("substantive_opening_turns signal", sm.includes("substantive_opening_turns"));
  assert("countSubstantiveOpeningTurns in agent", agentTs.includes("countSubstantiveOpeningTurns"));
  assert("types has client_id", read("lib/poju/types.ts").includes("client_id"));

  const agent = createInitialAgentState({ original_question: "" });
  const signals = (turns: number) =>
    extractModelTurnSignals({
      understanding_sufficient: true,
      base_analysis_ready: true,
      substantive_opening_turns: turns,
    });
  const short = "离婚8年想再婚";
  assert(
    "short first turn stays opening",
    advanceStateMachine({ ...agent, has_base_analysis: true }, signals(1), short).next_state === "opening",
  );
  assert(
    "short second turn enters collecting",
    advanceStateMachine({ ...agent, has_base_analysis: true }, signals(2), short).next_state ===
      "collecting_context",
  );
  const rich = "婚".repeat(OPENING_RICH_CHARS);
  assert(
    "rich single turn enters collecting",
    advanceStateMachine({ ...agent, has_base_analysis: true }, signals(1), rich).next_state ===
      "collecting_context",
  );
  assert("MIN_OPENING_TURNS is 2", OPENING_MIN_SUBSTANTIVE_TURNS === 2);

  console.log("\n=== Part 2 · flash stability ===\n");
  const bubble = read("components/poju/MessageBubble.tsx");
  const ui = read("components/poju/POJUChatUI.tsx");
  const chat = read("components/poju/PojuChat.tsx");
  const css = read("components/poju/poju-chat.css");
  const snap = read("lib/poju/agent-state-snapshot.ts");

  assert("MessageBubble memoized", bubble.includes("memo(function MessageBubble"));
  assert("pojuMessages useMemo", ui.includes("const pojuMessages = useMemo"));
  assert("visibleMessages useMemo", ui.includes("const visibleMessages = useMemo"));
  assert("stable client_id on optimistic user", ui.includes("client_id: safeRandomUUID()"));
  assert("slot activity fade", ui.includes("clearSlotActivityWithFade"));
  assert("PojuChat activity slot", chat.includes("pchat__activity-slot"));
  assert("activity slot fade class", chat.includes("pendingActivityFading"));
  assert("activity slot CSS transition", css.includes(".pchat__activity-slot.is-fading"));
  assert("patch skips unchanged meta", snap.includes("snapshotUnchanged"));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 23 acceptance checks passed.\n");
}

main();
