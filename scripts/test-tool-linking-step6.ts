/**
 * Tool_Linking Step 6 — cross-product reverse flow smoke test.
 * Run: pnpm exec tsx scripts/test-tool-linking-step6.ts
 */

import { buildSuggestedQuestionFromTool } from "../lib/cross-product/suggested-question-from-tool";
import { renderToolPreviewText } from "../lib/cross-product/tool-result-preview";
import { createNewCycle, injectToolResult } from "../lib/poju/cycle-manager";
import { findPendingToolInjection } from "../lib/poju/find-pending-tool-injection";
import type { POJUSessionState } from "../lib/poju/types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const matchQ = buildSuggestedQuestionFromTool("match", {
  relationship_description: "夫妻",
  summary: "需要沟通",
});
assert(matchQ.includes("夫妻"), "match suggested question");

const syncroQ = buildSuggestedQuestionFromTool("syncro", {
  task_description: "是否跳槽",
});
assert(syncroQ.includes("跳槽"), "syncro suggested question");

const glyphPreview = renderToolPreviewText("glyph", {
  question: "事业方向",
  glyph_level: 42,
});
assert(glyphPreview.includes("事业"), "glyph preview");

const matchPreview = renderToolPreviewText("match", {
  compatibility_level: "compatible",
  summary: "互补与摩擦并存",
});
assert(matchPreview.includes("互补"), "match preview");

const cycle = createNewCycle({ original_question: "test", cycle_index: 1 });
let session: POJUSessionState = {
  session_id: "s-ext",
  device_id: "d1",
  original_question: "test",
  cycles: [cycle],
  active_cycle_id: cycle.cycle_id,
  messages: [],
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
session = injectToolResult(session, "glyph", "g-1", { question: "事业" });
assert(findPendingToolInjection(session)?.tool === "glyph", "external inject pending");

console.log("test-tool-linking-step6: OK");
