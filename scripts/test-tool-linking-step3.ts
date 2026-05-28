/**
 * Tool_Linking Step 3 — handoff URL builder smoke test.
 * Run: pnpm exec tsx scripts/test-tool-linking-step3.ts
 */

import { buildToolHandoffPath } from "../lib/poju/tool-linking-routes";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const path = buildToolHandoffPath("syncro", {
  sessionId: "sess-1",
  cycleId: "cycle-1",
  prefill: { task_description: "明天下午面试", event_time: "tomorrow afternoon" },
});

assert(path.startsWith("/syncro/task?"), path);
assert(path.includes("from_poju_session=sess-1"), path);
assert(path.includes("from_poju_cycle=cycle-1"), path);
assert(path.includes("task_description="), path);

const matchPath = buildToolHandoffPath("match", {
  sessionId: "s",
  cycleId: "c",
  prefill: { partner_relationship: "老板", needs_partner_info: true },
});
assert(matchPath.startsWith("/match?"), matchPath);
assert(matchPath.includes("needs_partner_info=true"), matchPath);

console.log("test-tool-linking-step3: OK");
