/**
 * Block 106 — retry budget + job age guard (no forever-running after Vercel kill)
 *
 *   pnpm exec tsx scripts/test-poju-block106-segment2-retry-budget-age-guard.ts
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
  console.log("\n========== POJU Block 106 · retry budget + age guard ==========\n");

  const runner = read("lib/poju/xhigh-job-runner.ts");
  const status = read("app/api/poju/breakthrough-core/status/route.ts");
  const types = read("lib/poju/xhigh-job-types.ts");
  const retry = read("lib/llm/openrouter-retry.ts");

  assert("JOB_RETRY_BUDGET_MS 90s", runner.includes("JOB_RETRY_BUDGET_MS = 90_000"));
  assert("invocation hard deadline", runner.includes("INVOCATION_HARD_DEADLINE_MS = 280_000"));
  assert("budgetLeft check", runner.includes("budgetLeft <= delay"));
  assert("describeTransportError", runner.includes("describeTransportError"));
  assert("logs http_status", runner.includes("http_status: detail.http_status"));
  assert("fail path always written", runner.includes('failure_reason: transient ? "provider_busy"'));

  assert("age guard MAX_JOB_AGE_MS", status.includes("MAX_JOB_AGE_MS = 300_000"));
  assert("age guard job_abandoned", status.includes('reason: "job_abandoned"'));
  assert("keeps updated_at stale guard", status.includes("STALE_RUNNING_MS = 90_000"));

  assert("failure reason job_abandoned", types.includes('"job_abandoned"'));
  assert("QueueError accepts cause", retry.includes("options?: ErrorOptions"));

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ All Block 106 checks passed."
        : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`),
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
