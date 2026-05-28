/**
 * Tool_Linking Step 4 — quota + handoff storage smoke test.
 * Run: pnpm exec tsx scripts/test-tool-linking-step4.ts
 */

import { checkToolQuota, createNewCycle } from "../lib/poju/cycle-manager";
import { readPojuHandoffFromSearchParams } from "../lib/poju/poju-tool-handoff";
import type { POJUSessionState } from "../lib/poju/types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const cycle = createNewCycle({ original_question: "test", cycle_index: 1 });
const session: POJUSessionState = {
  session_id: "sess",
  device_id: "dev",
  original_question: "test",
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

assert(checkToolQuota(session, "glyph").available, "glyph quota available");
assert(
  readPojuHandoffFromSearchParams(
    new URLSearchParams("from_poju_session=a&from_poju_cycle=b&task_description=hi"),
    "syncro",
  )?.prefill.task_description === "hi",
  "parse handoff params",
);

console.log("test-tool-linking-step4: OK (client quota only; checkPojuQuota needs browser IndexedDB)");
