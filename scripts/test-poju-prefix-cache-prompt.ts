/**
 * POJU prefix-cache prompt layout — static system byte-stable; dynamic in user turn.
 *
 *   pnpm exec tsx scripts/test-poju-prefix-cache-prompt.ts
 */
import { calculateProfile } from "@/lib/calculations";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import {
  buildPojuDynamicTurnContext,
  buildPojuStaticSystemPrompt,
  clearPojuStaticSystemPromptCache,
  preparePojuPhaseLLMCall,
} from "@/lib/llm/phases/oriental-prompt-context";
import type { BirthInfo } from "@/lib/profile/types";
import type { PhaseLLMInput } from "@/lib/llm/phases/types";

const failures: string[] = [];

function assert(name: string, ok: boolean): void {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}`);
  if (!ok) failures.push(name);
}

function mockPhaseInput(overrides?: Partial<{ user_message: string }>): Promise<PhaseLLMInput> {
  return (async () => {
  const birth: BirthInfo = {
    year: 1985,
    month: 8,
    day: 20,
    hour_period: "wu",
    gender: "F",
    timezone: "America/New_York",
  };
  const profile = await calculateProfile(birth);
  profile.id = "prefix-cache-test";

  const mockAgent = createInitialAgentState({
    original_question: "Should I leave my current job?",
    selected_profile_id: profile.id,
  });
  mockAgent.question_category = "career";
  mockAgent.collection_completeness = 0.6;
  mockAgent.current_phase = "collecting_context";

  return {
    session: {
      session_id: "prefix-cache-session",
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
    user_message: overrides?.user_message ?? "Still unsure about timing.",
    locale: "en",
    agent_state: mockAgent,
  } as unknown as PhaseLLMInput;
  })();
}

async function main(): Promise<void> {
  console.log("\n=== POJU prefix-cache prompt layout ===\n");

  clearPojuStaticSystemPromptCache();
  const input = await mockPhaseInput();

  const taskA = "# Task A: collecting round 1\n\nOutput JSON.";
  const taskB = "# Task B: collecting round 2 — different agenda\n\nOutput JSON.";

  const staticA = await buildPojuStaticSystemPrompt(input);
  const staticB = await buildPojuStaticSystemPrompt(input);
  assert("static system identical across calls (same session)", staticA === staticB);

  const prepA = await preparePojuPhaseLLMCall(input, taskA);
  const prepB = await preparePojuPhaseLLMCall(input, taskB);
  assert("prepare: system byte-identical across different task blocks", prepA.system === prepB.system);
  assert("prepare: user messages differ when task blocks differ", prepA.messages !== prepB.messages);
  assert(
    "prepare: last user turn contains task A only in A",
    prepA.messages[prepA.messages.length - 1]!.content.includes("Task A") &&
      !prepA.messages[prepA.messages.length - 1]!.content.includes("Task B"),
  );
  assert(
    "prepare: last user turn contains task B only in B",
    prepB.messages[prepB.messages.length - 1]!.content.includes("Task B") &&
      !prepB.messages[prepB.messages.length - 1]!.content.includes("Task A"),
  );

  const dynamicA = buildPojuDynamicTurnContext(input, taskA);
  const dynamicB = buildPojuDynamicTurnContext(input, taskB);
  assert("dynamic context differs when task blocks differ", dynamicA !== dynamicB);

  assert("static system has NO task block A", !staticA.includes("Task A"));
  assert("static system has NO task block B", !staticB.includes("Task B"));
  assert("static system has core POJU identity", staticA.includes("POJU") || staticA.includes("破局"));
  assert("static chat system excludes READING_LAYOUT magazine block", !staticA.includes("降维排版（杂志式版面"));
  assert("dynamic turn has POJU chat rules (not report layout)", dynamicA.includes("POJU 对话 response 规则"));
  assert("dynamic chat rules ban per-turn quote boxes", dynamicA.includes("金句框"));
  assert("user turn has date context (dynamic)", prepA.messages[prepA.messages.length - 1]!.content.includes("202"));
  assert("user turn has language directive marker", prepA.messages[prepA.messages.length - 1]!.content.length > 200);

  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll prefix-cache prompt checks passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
