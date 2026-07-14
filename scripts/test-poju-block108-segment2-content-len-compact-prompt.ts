/**
 * Block 108 — content_len diagnostics (A vs B: slow growth vs stall)
 * Prompt stays full quality — do NOT require compact marking.
 *
 *   pnpm exec tsx scripts/test-poju-block108-segment2-content-len-compact-prompt.ts
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
  console.log("\n========== POJU Block 108 · content_len diagnostics ==========\n");

  const status = read("app/api/poju/breakthrough-core/status/route.ts");
  const runner = read("lib/poju/xhigh-job-runner.ts");
  const core = read("lib/llm/deepseek/breakthrough-core.ts");
  const marking = read("lib/llm/sanitize/term-marking.ts");

  assert("status logs content_len", status.includes("content_len"));
  assert("runner fail log elapsed_ms", runner.includes("elapsed_ms: Date.now() - invocationStartedAt"));
  assert("runner fail log content_len", runner.includes("content_len"));
  assert("runner fail log prompt_tokens", runner.includes("prompt_tokens: out"));
  assert("runner fail log finish_reason", runner.includes("finish_reason"));
  assert("timeout stays 270s", runner.includes("SEGMENT2_XHIGH_TIMEOUT_MS = 270_000"));

  // Quality: full marking injection, no compact mode wired into breakthrough.
  assert("breakthrough uses full marking block", core.includes("buildTermMarkingPromptBlock(locale)"));
  assert("no compact wired into breakthrough", !core.includes("compact: true"));
  assert("marking has full closed-set path", marking.includes("buildClosedSetConstraintPromptBlock"));

  console.log(
    "\n" +
      (failures.length === 0
        ? "✅ All Block 108 checks passed."
        : `❌ ${failures.length} failure(s):\n  - ${failures.join("\n  - ")}`),
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
