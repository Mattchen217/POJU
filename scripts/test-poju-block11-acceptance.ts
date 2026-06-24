/**
 * Block 11 — state machine opening gate / matrix render dedupe / activity handoff
 * Run: pnpm exec tsx scripts/test-poju-block11-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { resolveActiveAgentPhase } from "@/lib/llm/poju-phase-router";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import type { POJUSessionState } from "@/lib/poju/types";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function mockSession(partial: Partial<POJUSessionState> = {}): POJUSessionState {
  return {
    session_id: "s1",
    original_question: "test",
    messages: [{ role: "user", content: "你好", timestamp: "1" }],
    has_profile: true,
    ...partial,
  } as POJUSessionState;
}

function main(): void {
  console.log("\n========== POJU Block 11 Acceptance ==========\n");

  console.log("=== Fix 1 · opening gate (no router skip) ===\n");
  const router = read("lib/llm/poju-phase-router.ts");
  assert("router no userTurns shortcut", !router.includes("userTurns"));
  assert("router defaults opening", /return "opening";/.test(router));
  assert(
    "null agent_v2 + profile → opening",
    resolveActiveAgentPhase(mockSession({ agent_v2: undefined })) === "opening",
  );
  assert(
    "persisted collecting respected",
    resolveActiveAgentPhase(
      mockSession({
        agent_v2: { ...createInitialAgentState({ original_question: "q" }), current_phase: "collecting_context" },
      }),
    ) === "collecting_context",
  );
  const page = read("app/[locale]/(marketing)/poju/session/[sessionId]/page.tsx");
  assert("session page seeds agent_v2", page.includes("createInitialAgentState"));

  console.log("\n=== Fix 2 · matrix render dedupe ===\n");
  const chatUi = read("components/poju/POJUChatUI.tsx");
  assert("matrix single poju-matrix-bubble", chatUi.includes("poju-matrix-bubble"));
  assert("suppressNarrative on matrix", chatUi.includes("suppressNarrative"));
  assert("no matrix followUps slot", !chatUi.includes("followUps[m.timestamp] = (\n          <MatrixNarrativeReply"));
  const matrix = read("components/poju/PojuEnergyMatrix.tsx");
  assert("suppressNarrative prop", matrix.includes("suppressNarrative"));

  console.log("\n=== Fix 3 · activity → text handoff ===\n");
  const pojuChat = read("components/poju/PojuChat.tsx");
  assert("replyHandoff state", pojuChat.includes("replyHandoff"));
  assert("handoff crossfade class", pojuChat.includes("pchat__reply-handoff"));
  assert("delayed slotActivity clear", read("components/poju/POJUChatUI.tsx").includes("setTimeout(() => setSlotActivity(null), 200)"));
  const css = read("components/poju/poju-chat.css");
  assert("handoff CSS transition", css.includes("pchat__reply-handoff--done"));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 11 acceptance checks passed.\n");
}

main();
