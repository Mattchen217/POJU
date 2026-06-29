/**
 * Block 34 — confirmation affirmatives + collecting prompt + agenda partial count
 * Run: pnpm exec tsx scripts/test-poju-block34-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { createInitialAgentState } from "@/lib/poju/agent-state";
import { classifyConfirmationAffirmative, appendConfirmationInvite, hasConfirmationInviteCue } from "@/lib/poju/confirmation-reply";
import { formatAgendaProgressLabel } from "@/lib/poju/agenda-progress-label";
import { advanceStateMachine, extractModelTurnSignals } from "@/lib/poju/state-machine";
import { wrapBareKeepCnSoftTerms } from "@/lib/llm/sanitize/term-marking";
import type { AgendaItem } from "@/lib/poju/investigation-agenda";

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
  console.log("\n========== POJU Block 34 Acceptance ==========\n");

  console.log("=== Confirmation affirmatives ===\n");
  assert("好的 → confirmed", classifyConfirmationAffirmative("好的") === "confirmed");
  assert("没有了 → confirmed", classifyConfirmationAffirmative("没有了") === "confirmed");
  assert("可以 → confirmed", classifyConfirmationAffirmative("可以") === "confirmed");
  assert(
    "long add → wants_to_add",
    classifyConfirmationAffirmative("我觉得还有一件事想补充，关于工作那边…") === "wants_to_add",
  );

  const agent = {
    ...createInitialAgentState({ original_question: "q" }),
    current_phase: "awaiting_confirmation" as const,
  };
  const confirmed = advanceStateMachine(
    agent,
    extractModelTurnSignals({ confirmation_signal: "unclear" }),
    "好的",
  );
  assert("state machine triggers delivery on 好的", confirmed.trigger_delivery === true);

  console.log("\n=== Agenda partial progress ===\n");
  const partialAgent = {
    ...createInitialAgentState({ original_question: "q" }),
    current_phase: "collecting_context" as const,
    investigation_agenda: [
      { id: "a1", label: "项一", critical: true, status: "partial" as AgendaItem["status"], supports: "x" },
      { id: "a2", label: "项二", critical: true, status: "unexplored" as AgendaItem["status"], supports: "x" },
    ],
  };
  assert(
    "partial counts in progress label",
    formatAgendaProgressLabel(partialAgent, "zh") === "正在从 2 个角度了解你的处境（已 1/2）",
  );

  console.log("\n=== Prompt + term wrap ===\n");
  const base = read("lib/llm/prompts/poju-base.ts");
  assert("no empty 深入推演 invite", !base.includes("告诉他你要为他深入推演"));
  assert("first collecting asks current_focus", base.includes("收尾必须立刻问"));

  console.log("\n=== Confirmation invite fallback ===\n");
  const bareSummary = "这八年，你不是不想走出来，是你把自己关在了一个牢笼里。";
  assert("bare summary lacks cue", !hasConfirmationInviteCue(bareSummary));
  const withInvite = appendConfirmationInvite(bareSummary, "zh");
  assert("append adds 可以/没有了", /可以|没有了/.test(withInvite));
  assert("agent uses appendConfirmationInvite", read("lib/poju/agent.ts").includes("appendConfirmationInvite"));
  assert("last agenda directive", read("lib/llm/phases/collecting-phase.ts").includes("buildLastAgendaItemDirective"));

  const wrapped = wrapBareKeepCnSoftTerms("缺关键平衡能量（水）。", "zh");
  assert("关键平衡能量 auto-wrapped", wrapped.includes("⟦t:yong_shen|"));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 34 acceptance checks passed.\n");
}

main();
