/**
 * Tool_Linking_Final Step 1 — cycle types + manager smoke test.
 * Run: pnpm exec tsx scripts/test-tool-linking-step1.ts
 */

import {
  checkToolQuota,
  createNewCycle,
  ensureSessionCycles,
  getActiveCycle,
  injectToolResult,
  markCycleDelivered,
  markToolResultInjected,
  recordToolSuggestion,
  recordUserResponse,
  startNewCycle,
} from "../lib/poju/cycle-manager";
import type { POJUSessionState } from "../lib/poju/types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function baseSession(): POJUSessionState {
  const cycle = createNewCycle({ original_question: "工作和伴侣总是冲突", cycle_index: 1 });
  return {
    session_id: "test-session",
    device_id: "test-device",
    original_question: "工作和伴侣总是冲突",
    cycles: [cycle],
    active_cycle_id: cycle.cycle_id,
    messages: [],
    context_collected: {},
    has_profile: false,
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
}

let state = baseSession();
assert(getActiveCycle(state)?.cycle_index === 1, "active cycle");

let quota = checkToolQuota(state, "glyph");
assert(quota.available, "glyph quota available");

state = recordToolSuggestion(state, "glyph", "msg-1", "用户表达模糊");
quota = checkToolQuota(state, "glyph");
assert(!quota.available && quota.already_suggested, "glyph pending blocks re-suggest");

state = recordUserResponse(state, "glyph", "declined");
quota = checkToolQuota(state, "glyph");
assert(quota.already_declined && !quota.available, "declined blocks cycle");

state = startNewCycle(state, "孩子升学选校很纠结", "decision");
assert(state.cycles!.length === 2, "two cycles");
assert(getActiveCycle(state)?.cycle_index === 2, "cycle 2 active");
assert(checkToolQuota(state, "glyph").available, "glyph quota reset on new cycle");

state = recordToolSuggestion(state, "syncro", "msg-2", "明天面试");
state = recordUserResponse(state, "syncro", "accepted");
state = injectToolResult(state, "syncro", "syncro-123", { level: "open_current" });
const inj = getActiveCycle(state)?.tool_suggestions.find((s) => s.tool === "syncro");
assert(inj?.tool_result_id === "syncro-123", "tool result stored");

state = markToolResultInjected(state, "syncro", "syncro-123");
assert(
  getActiveCycle(state)?.tool_suggestions.find((s) => s.tool === "syncro")?.injected_to_poju === true,
  "injected flag",
);

state = markCycleDelivered(state, state.active_cycle_id!, [
  { action_id: "a1", category: "modern_decisive", text: "周三面谈", status: "pending" },
]);
assert(getActiveCycle(state)?.is_delivered === true, "cycle delivered");

const legacy = ensureSessionCycles({
  ...baseSession(),
  cycles: undefined,
  active_cycle_id: undefined,
});
assert(legacy.cycles?.length === 1 && Boolean(legacy.active_cycle_id), "legacy migration");

console.log("test-tool-linking-step1: OK");
