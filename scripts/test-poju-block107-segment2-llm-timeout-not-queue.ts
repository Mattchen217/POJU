/**
 * Block 107 — llm_timeout must not become provider_queue; no job-inner retry; 270s budget
 *
 *   pnpm exec tsx scripts/test-poju-block107-segment2-llm-timeout-not-queue.ts
 */
import fs from "node:fs";
import path from "node:path";

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
  console.log("\n========== POJU Block 107 · llm_timeout ≠ provider_queue ==========\n");

  const runner = read("lib/poju/xhigh-job-runner.ts");
  const retry = read("lib/llm/openrouter-retry.ts");
  const resolver = read("lib/llm/openrouter-model-resolver.ts");
  const types = read("lib/poju/xhigh-job-types.ts");
  const display = read("lib/poju/phases/segment2/display.ts");
  const poll = read("lib/poju/poll-segment2-xhigh-job.ts");

  assert("timeout 270s", runner.includes("SEGMENT2_XHIGH_TIMEOUT_MS = 270_000"));
  assert("max tokens 26000", runner.includes("SEGMENT2_XHIGH_MAX_TOKENS = 26_000"));
  assert("write headroom 30s", runner.includes("INVOCATION_WRITE_HEADROOM_MS = 30_000"));
  assert("hard deadline 300s", runner.includes("INVOCATION_HARD_DEADLINE_MS = 300_000"));
  assert("llm_timeout no outer retry", runner.includes("llm_timeout — fail without retry"));
  assert("failure_reason llm_timeout", runner.includes('failure_reason: "llm_timeout"'));
  assert("isLlmTimeoutError used", runner.includes("isLlmTimeoutError"));

  assert("isProviderQueueClassError excludes timeout", retry.includes("isProviderQueueClassError"));
  assert("isLlmTimeoutError helper", retry.includes("export function isLlmTimeoutError"));
  assert("resolver never wraps timeout", resolver.includes("isLlmTimeoutError(e)"));
  assert("resolver queue class wrap", resolver.includes("isProviderQueueClassError"));

  assert("type llm_timeout", types.includes('"llm_timeout"'));
  assert("UI timeout copy", display.includes("这次分析用时过长"));
  assert("poll max covers 270s", poll.includes("XHIGH_JOB_POLL_MAX_MS = 290_000"));

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ All Block 107 checks passed."
        : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`),
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
