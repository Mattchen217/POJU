/**
 * Block 22 — breakthrough-core token budget + graceful soft failure (no 500 crash)
 * Run: pnpm exec tsx scripts/test-poju-block22-acceptance.ts
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
  console.log("\n========== POJU Block 22 Acceptance ==========\n");

  console.log("=== Fix 1 · raised max_tokens ===\n");
  const route = read("app/api/poju/breakthrough-core/route.ts");
  assert("initial max_tokens 16000", route.includes("16_000"));
  assert("no max_tokens 6000", !route.includes("max_tokens: 6000"));

  console.log("\n=== Fix 2 · soft failure instead of 500 ===\n");
  assert("finish_reason length handled", route.includes('finish === "length"'));
  assert("parse failure returns retryable 200", route.includes("retryable: true"));
  assert("BreakthroughCoreRetryableError caught", route.includes("BreakthroughCoreRetryableError"));
  assert("map failure soft degrades", route.includes('retryableResponse("parse_failed"'));

  console.log("\n=== Fix 3 · auto retry at 24000 ===\n");
  assert("retries at 24000 after length", route.includes("24_000"));
  assert("retry log on first truncation", route.includes("retrying at 24000"));

  console.log("\n=== Client · retryable soft fail, no throw ===\n");
  const bt = read("lib/llm/deepseek/breakthrough-core.ts");
  const orch = read("lib/poju/agent-orchestrator.ts");
  assert("client handles retryable payload", bt.includes("payload.retryable"));
  assert("client returns session on soft fail", /retryable[\s\S]*return \{ session, tokens_used: 0 \}/.test(bt));
  assert("ensureBreakthroughCore catches hard errors", orch.includes("Breakthrough core failed"));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 22 acceptance checks passed.\n");
}

main();
