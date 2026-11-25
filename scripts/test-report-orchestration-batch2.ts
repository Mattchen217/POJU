/**
 * Report orchestration Batch 2 — runs R2 then R1 harnesses sequentially.
 * Run: pnpm exec tsx scripts/test-report-orchestration-batch2.ts
 */

import { spawnSync } from "node:child_process";
import { join } from "node:path";

process.env.REPORT_BATCH2_ALLOW_MEMORY_STORE = "1";

function run(script: string): void {
  const r = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["exec", "tsx", script],
    {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env,
      shell: process.platform === "win32",
    },
  );
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

run(join("scripts", "test-report-orchestration-batch2-r2.ts"));
run(join("scripts", "test-report-orchestration-batch2-r1.ts"));
console.log("ok report orchestration batch2 (r2+r1)");
