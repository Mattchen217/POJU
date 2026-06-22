/**
 * POJU prefix cache — byte-stable system prompt + dynamic turnContext.
 *
 *   pnpm exec tsx scripts/test-poju-prefix-cache-prompt.ts
 */
import { calculateProfile } from "@/lib/calculations";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import {
  buildPhaseTurnContext,
  buildPojuSystemPrompt,
} from "@/lib/llm/phases/oriental-prompt-context";
import { stableJsonStringify } from "@/lib/llm/prompts/base-analysis-context";
import type { BirthInfo } from "@/lib/profile/types";
import type { PhaseLLMInput } from "@/lib/llm/phases/types";

const failures: string[] = [];

function assert(name: string, ok: boolean): void {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}`);
  if (!ok) failures.push(name);
}

async function mockPhaseInput(userMessage: string): Promise<PhaseLLMInput> {
  const birth: BirthInfo = {
    year: 1985,
    month: 8,
    day: 20,
    hour_period: "wu",
    gender: "F",
    timezone: "America/New_York",
  };
  const profile = await calculateProfile(birth);
  profile.id = "poju-system-prompt-test";

  const mockAgent = createInitialAgentState({
    original_question: "Should I leave my current job?",
    selected_profile_id: profile.id,
  });
  mockAgent.question_category = "career";
  mockAgent.collection_completeness = 0.6;
  mockAgent.current_phase = "collecting_context";

  return {
    session: {
      session_id: "poju-system-prompt-test",
      original_question: mockAgent.original_question,
      messages: [
        { role: "user", content: "I've been hesitating.", timestamp: new Date().toISOString() },
        { role: "assistant", content: "Tell me more about the tension.", timestamp: new Date().toISOString() },
      ],
      selected_stored_profile_id: profile.id,
      profile_skipped: false,
      main_delivery_done: false,
      agent_v2: mockAgent,
    },
    profile,
    base_analysis: {
      display_text: "## Snapshot\n\nNeutral energy base for cache test.",
      structured: { day_master: "庚", yong_shen: "水", z: 1, a: 2 },
    },
    user_message: userMessage,
    locale: "en",
    agent_state: mockAgent,
  } as unknown as PhaseLLMInput;
}

async function main(): Promise<void> {
  console.log("\n=== POJU prefix cache prompt ===\n");

  const inputRound1 = await mockPhaseInput("Still unsure about timing.");
  const inputRound2 = await mockPhaseInput("What if I wait six months?");
  inputRound2.user_message = "What if I wait six months?";

  const taskA = "# Task A: collecting round 1\n\nOutput JSON.";
  const taskB = "# Task B: collecting round 2\n\nOutput JSON.";

  const sys1a = await buildPojuSystemPrompt(inputRound1);
  const sys1b = await buildPojuSystemPrompt(inputRound1);
  const sys2 = await buildPojuSystemPrompt(inputRound2);

  assert("same session round 1 vs 1 — system byte-identical", sys1a === sys1b);
  assert("same session round 1 vs 2 — system byte-identical", sys1a === sys2);
  assert("system has POJU identity", sys1a.includes("POJU") || sys1a.includes("破局"));
  assert("system excludes task A", !sys1a.includes("Task A"));
  assert("system excludes task B", !sys1a.includes("Task B"));
  assert("system excludes today's date header", !sys1a.includes("Today's date"));
  assert("system includes profile block", sys1a.includes("八字四柱") || sys1a.includes("Four"));

  const turnA = buildPhaseTurnContext(inputRound1, taskA);
  const turnB = buildPhaseTurnContext(inputRound1, taskB);
  assert("task A in turnContext only", turnA.includes("Task A") && !sys1a.includes("Task A"));
  assert("task B in turnContext only", turnB.includes("Task B"));
  assert("different tasks → different turnContext", turnA !== turnB);
  assert("turnContext has language lock", turnA.includes("Respond **ONLY** in"));
  assert("turnContext has date context", turnA.includes("今天的实际日期") || turnA.includes("Today's actual date"));

  const stableA = stableJsonStringify({ b: 2, a: 1, nested: { z: 1, a: 0 } });
  const stableB = stableJsonStringify({ a: 1, b: 2, nested: { a: 0, z: 1 } });
  assert("stableJsonStringify key order", stableA === stableB);

  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll POJU prefix cache prompt checks passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
