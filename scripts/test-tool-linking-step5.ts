/**
 * Tool_Linking Step 5 — injection message builder smoke test.
 * Run: pnpm exec tsx scripts/test-tool-linking-step5.ts
 */

import { buildToolResultInjectionMessage } from "../lib/llm/prompts/tool-result-injection";
import { extractToolSummary } from "../lib/poju/extract-tool-summary";
import { prepareToolInjectionTurn, finalizeToolInjectionTurn } from "../lib/poju/prepare-tool-injection-turn";
import { createNewCycle, recordToolSuggestion, recordUserResponse, injectToolResult } from "../lib/poju/cycle-manager";
import { findPendingToolInjection } from "../lib/poju/find-pending-tool-injection";
import type { POJUSessionState } from "../lib/poju/types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const cycle = createNewCycle({ original_question: "该不该跳槽", cycle_index: 1 });
let session: POJUSessionState = {
  session_id: "s1",
  device_id: "d1",
  original_question: "该不该跳槽",
  cycles: [cycle],
  active_cycle_id: cycle.cycle_id,
  messages: [{ role: "user", content: "我很纠结", timestamp: new Date().toISOString() }],
  context_collected: {},
  has_profile: true,
  profile_skipped: false,
  actions: [],
  main_delivery_done: false,
  main_delivery: null,
  tokens_used: 0,
  abuse_metrics: { long_input_count: 0, jailbreak_attempts: 0, duplicate_attempts: 0 },
  created_at: new Date().toISOString(),
  last_interaction_at: new Date().toISOString(),
  expires_at: new Date().toISOString(),
};

session = recordToolSuggestion(session, "match", "m1", "用户提到和伴侣矛盾");
session = recordUserResponse(session, "match", "accepted");
session = injectToolResult(session, "match", "match-99", {
  compatibility_level: "compatible_with_effort",
  summary: "需要沟通",
  strengths: ["互补"],
  challenges: ["节奏不同"],
  relationship_description: "夫妻",
});

assert(findPendingToolInjection(session)?.tool === "match", "pending found");

const prep = prepareToolInjectionTurn(session);
assert(Boolean(prep.tool_injection_context?.includes("Match")), "injection context");
assert(prep.session.messages.some((m) => m.role === "system"), "system row appended");

const msg = buildToolResultInjectionMessage({
  tool: "glyph",
  result_data: extractToolSummary("glyph", {
    question: "说不清",
    glyph_drawn: "still_water",
    meaning: "静水深流",
  }),
  original_question: "说不清为什么",
});
assert(msg.includes("Glyph") && msg.includes("still_water"), "glyph injection");

session = finalizeToolInjectionTurn(prep.session, prep.pending!);
assert(findPendingToolInjection(session) === null, "marked injected");

console.log("test-tool-linking-step5: OK");
