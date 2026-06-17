/**
 * Tool_Linking_Final Step 2 — parse + apply smoke test.
 * Run: pnpm exec tsx scripts/test-tool-linking-step2.ts
 */

import { createInitialAgentState } from "../lib/poju/agent-state";
import { createNewCycle } from "../lib/poju/cycle-manager";
import {
  applyToolLinkingFromLlm,
  parseStartNewCycleFromParsed,
  parseToolSuggestionFromParsed,
} from "../lib/poju/tool-suggestion";
import type { POJUSessionState } from "../lib/poju/types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const cycle = createNewCycle({ original_question: "和老板吵架", cycle_index: 1 });
const session: POJUSessionState = {
  session_id: "s1",
  device_id: "d1",
  original_question: "和老板吵架",
  cycles: [cycle],
  active_cycle_id: cycle.cycle_id,
  messages: [],
  context_collected: {},
  has_profile: true,
  profile_skipped: false,
  actions: [],
  main_delivery_done: true,
  main_delivery: null,
  tokens_used: 0,
  abuse_metrics: { long_input_count: 0, jailbreak_attempts: 0, duplicate_attempts: 0 },
  created_at: new Date().toISOString(),
  last_interaction_at: new Date().toISOString(),
  expires_at: new Date().toISOString(),
  agent_v2: {
    ...createInitialAgentState({ original_question: "和老板吵架" }),
    current_phase: "tracking",
    has_base_analysis: true,
    profile_skipped: false,
    question_category: "career",
    collection_completeness: 1,
    has_situation_analysis: true,
    main_delivery_at: new Date().toISOString(),
    turn_count: 5,
  },
};

const parsed = {
  tool_suggestion: {
    tool: "match",
    trigger_context: "用户提到与老板的矛盾",
    value_prop: "看双方命局互动",
  },
};
const suggestion = parseToolSuggestionFromParsed(parsed);
assert(suggestion?.tool === "match", "parse tool");

let r = applyToolLinkingFromLlm(session, { tool_suggestion: suggestion }, "msg-a");
assert(r.tool_suggestion?.tool === "match", "record match suggestion");
assert(r.session.cycles![0].tool_suggestions.length === 1, "cycle has suggestion");

const cycle2 = parseStartNewCycleFromParsed({
  start_new_cycle: true,
  new_cycle_question: "孩子升学很纠结",
});
assert(cycle2.start_new_cycle, "new cycle flag");

r = applyToolLinkingFromLlm(r.session, cycle2, "msg-b");
assert(r.start_new_cycle, "applied new cycle");
assert(r.session.cycles!.length === 2, "two cycles");
assert(r.session.cycles![1].tool_suggestions.length === 0, "fresh quota");

console.log("test-tool-linking-step2: OK");
