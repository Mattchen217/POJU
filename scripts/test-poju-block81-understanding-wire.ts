/**
 * Block 81 — core_dilemma/desired_direction must reach finalizeAgentV2 from llmResponse
 *
 *   pnpm exec tsx scripts/test-poju-block81-understanding-wire.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  createInitialAgentState,
  isUnderstandingComplete,
  mergeCoreDilemma,
  mergeDesiredDirection,
  withCompleteUnderstanding,
} from "@/lib/poju/agent-state";
import { CHAT_PAYLOAD_FIELDS, pojuLlmToChatPayload } from "@/lib/poju/serialize-chat-payload";
import type { POJULLMResponse } from "@/lib/llm/poju-llm";

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
  console.log("\n========== POJU Block 81 · Understanding wire ==========\n");

  const agentTs = read("lib/poju/agent.ts");
  const serialize = read("lib/poju/serialize-chat-payload.ts");
  const mapper = read("lib/poju/phase-llm-mapper.ts");
  const pojuLlm = read("lib/llm/poju-llm.ts");

  assert("CHAT_PAYLOAD includes core_dilemma", CHAT_PAYLOAD_FIELDS.includes("core_dilemma"));
  assert("CHAT_PAYLOAD includes desired_direction", CHAT_PAYLOAD_FIELDS.includes("desired_direction"));
  assert("pojuLlmToChatPayload maps core_dilemma", serialize.includes("core_dilemma: llm.core_dilemma"));
  assert("chatPayloadFromWire maps core_dilemma", serialize.includes("data.core_dilemma"));
  assert("phase mapper maps core_dilemma", mapper.includes("core_dilemma: phase.core_dilemma"));
  assert("poju-llm returns core_dilemma", pojuLlm.includes("core_dilemma: phase.core_dilemma"));
  assert("mapLlmApiPayload returns core_dilemma", agentTs.includes("wire.core_dilemma"));
  assert("finalizeAgentV2 receives core_dilemma", agentTs.includes("core_dilemma: llmResponse.core_dilemma"));
  assert("finalizeAgentV2 receives desired_direction", agentTs.includes("desired_direction: llmResponse.desired_direction"));

  const dilemma = {
    concrete_event: "徒弟坐了位置",
    stakes: "怕经验烂掉",
    sticking_point: "不知道怎么开口",
  };
  const direction = { wants: "希望师傅请教", priority: "保住经验价值" };

  const llm: POJULLMResponse = {
    response: "我听到了",
    model: "test",
    tokens_used: 10,
    user_intent: "sharing_situation",
    current_state: "opening",
    topic_drift_detected: false,
    contains_delivery: false,
    context_updates: {},
    core_dilemma: dilemma,
    desired_direction: direction,
    understanding_sufficient: true,
  };

  const payload = pojuLlmToChatPayload(llm);
  assert("API payload carries core_dilemma", payload.core_dilemma != null);
  assert("API payload carries desired_direction", payload.desired_direction != null);

  let agent = createInitialAgentState({ original_question: "q" });
  agent = {
    ...agent,
    core_dilemma: mergeCoreDilemma(agent.core_dilemma, payload.core_dilemma as typeof dilemma),
    desired_direction: mergeDesiredDirection(
      agent.desired_direction,
      payload.desired_direction as typeof direction,
    ),
  };
  assert("merged agent understanding complete", isUnderstandingComplete(agent));
  assert("fixture complete", isUnderstandingComplete(withCompleteUnderstanding(agent)));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 81 checks passed.\n");
}

main();
