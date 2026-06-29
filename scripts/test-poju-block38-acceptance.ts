/**
 * Block 38 — term marking every occurrence + fluid tracking.
 * Run: pnpm exec tsx scripts/test-poju-block38-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import {
  applyActionStatusUpdates,
  normalizeTrackingActionStatus,
  parseActionStatusUpdates,
} from "@/lib/poju/action-status-updates";
import type { POJUAction } from "@/lib/poju/types";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function main(): void {
  console.log("\n=== Block 38 acceptance ===\n");

  const termMarking = read("lib/llm/sanitize/term-marking.ts");
  assert("term marking every occurrence rule", termMarking.includes("每一次出现都要套"));
  assert("term marking no bare repeat", termMarking.includes("绝不在别处套过一次后"));
  assert("term marking removed per-paragraph once", !termMarking.includes("每段只标 1 次"));

  const pojuBase = read("lib/llm/prompts/poju-base.ts");
  assert("poju-base contextual plain per marker", pojuBase.includes("这一处的白话结合本句语境现写"));
  assert("poju-base density separate from marking", pojuBase.includes("密度是写作层的事"));

  const tracking = read("lib/llm/phases/tracking-phase.ts");
  assert("tracking four intents", tracking.includes("你在追踪门诊里只做这四件事"));
  assert("tracking action_status_updates", tracking.includes("action_status_updates"));
  assert("tracking start_new_cycle false", tracking.includes("start_new_cycle: false"));
  assert("tracking no new cycle detection appendix", tracking.includes("includeNewCycleDetection: false"));

  const agent = read("lib/poju/agent.ts");
  assert("agent applyActionStatusUpdates", agent.includes("applyActionStatusUpdates"));

  assert("normalize done -> completed", normalizeTrackingActionStatus("done") === "completed");
  assert("parse action status updates", parseActionStatusUpdates({
    action_status_updates: [{ action_index: 1, status: "doing" }],
  }).length === 1);

  const actions = [
    {
      action_id: "a1",
      given_at: "t",
      text: "x",
      category: "modern_reflective",
      timing: "this_week",
      rationale: "r",
      status: "pending",
    },
  ] as POJUAction[];
  const patched = applyActionStatusUpdates(actions, [
    { action_index: 1, status: "completed" },
  ]);
  assert("apply status patch", patched[0]?.status === "completed");

  console.log("\n=== Summary ===\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 38 checks passed.\n");
}

main();
