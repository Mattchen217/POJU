/**
 * Block 105 — Segment 2 provider_queue bounded retry + stale running guard
 *
 *   pnpm exec tsx scripts/test-poju-block105-segment2-provider-queue-retry.ts
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, ok: boolean, detail?: string): void {
  if (!ok) failures.push(detail ? `${label} — ${detail}` : label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function main(): void {
  console.log("\n========== POJU Block 105 · provider queue retry + stale guard ==========\n");

  const runner = read("lib/poju/xhigh-job-runner.ts");
  const status = read("app/api/poju/breakthrough-core/status/route.ts");
  const poll = read("lib/poju/poll-segment2-xhigh-job.ts");
  const types = read("lib/poju/xhigh-job-types.ts");

  assert("CORE_RETRY_DELAYS_MS present", runner.includes("CORE_RETRY_DELAYS_MS = [5_000, 10_000, 20_000]"));
  assert("retry budget 90s", runner.includes("JOB_RETRY_BUDGET_MS = 90_000"));
  assert("outer retry uses budgetLeft", runner.includes("budgetLeft <= delay"));
  assert("per-attempt max_attempts stays 1", runner.includes("max_attempts: config.max_attempts"));
  assert("config still max_attempts 1", runner.includes("max_attempts: 1"));
  assert("heartbeat during stream", runner.includes("XHIGH_JOB_HEARTBEAT_MS"));
  assert("transport fail logs job_id", runner.includes("transport attempt") && runner.includes("job_id"));
  assert("completed logs job_id", runner.includes("[xhigh-job] ${config.phase} completed"));

  assert("stale running guard", status.includes("STALE_RUNNING_MS = 90_000"));
  assert("age guard MAX_JOB_AGE_MS", status.includes("MAX_JOB_AGE_MS = 300_000"));
  assert("age guard job_abandoned", status.includes('reason: "job_abandoned"'));
  assert("stale returns failed", status.includes('reason: "stale_running"'));
  assert("stale persists failXhighJob", status.includes("failXhighJob"));

  assert("poll hard timeout 290s", poll.includes("XHIGH_JOB_POLL_MAX_MS = 290_000"));
  assert("poll_timeout reason", poll.includes('reason: "poll_timeout"'));

  assert("failure reason stale_running", types.includes('"stale_running"'));
  assert("failure reason transport_error", types.includes('"transport_error"'));

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ All Block 105 checks passed."
        : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`),
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
