/**
 * POJU system prompt smoke — buildPojuSystemPrompt stitches core + task block.
 *
 *   pnpm exec tsx scripts/test-poju-prefix-cache-prompt.ts
 */
import { calculateProfile } from "@/lib/calculations";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import { buildPojuSystemPrompt } from "@/lib/llm/phases/oriental-prompt-context";
import { POJU_BAZI_DEEP_METHOD } from "@/lib/llm/prompts/poju-base";
import type { BirthInfo } from "@/lib/profile/types";
import type { PhaseLLMInput } from "@/lib/llm/phases/types";

const failures: string[] = [];

function assert(name: string, ok: boolean): void {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}`);
  if (!ok) failures.push(name);
}

async function mockPhaseInput(): Promise<PhaseLLMInput> {
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
      day_master: { stem: "庚", element: "金" },
      current_major_luck: { period: "2020-2030", theme: "pressure and breakthrough" },
      useful_god: { primary: "水", note: "water as useful god" },
    },
    user_message: "Still unsure about timing.",
    locale: "en",
    agent_state: mockAgent,
  } as unknown as PhaseLLMInput;
}

async function main(): Promise<void> {
  console.log("\n=== POJU system prompt smoke ===\n");

  const input = await mockPhaseInput();
  const taskA = "# Task A: collecting round 1\n\nOutput JSON.";
  const taskB = "# Task B: collecting round 2\n\nOutput JSON.";

  const sysA = await buildPojuSystemPrompt(input, taskA);
  const sysB = await buildPojuSystemPrompt(input, taskB);

  assert("system prompt includes POJU identity", sysA.includes("POJU") || sysA.includes("破局"));
  assert("task A embedded in system prompt", sysA.includes("Task A"));
  assert("task B embedded in system prompt", sysB.includes("Task B"));
  assert("different task blocks → different system strings", sysA !== sysB);
  assert("passive term marking in POJU_BAZI_DEEP_METHOD", POJU_BAZI_DEEP_METHOD.includes("被动包装"));
  assert("no chat term quota in POJU_BAZI_DEEP_METHOD", !POJU_BAZI_DEEP_METHOD.includes("≥4 个不同 term id"));

  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll POJU system prompt smoke checks passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
