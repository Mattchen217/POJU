/**
 * Block 21 — breakthrough core reads the user's real question (not stale session.original_question)
 * Run: pnpm exec tsx scripts/test-poju-block21-acceptance.ts
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
  console.log("\n========== POJU Block 21 Acceptance ==========\n");

  console.log("=== Fix A · sync core passes top-level original_question ===\n");
  const agent = read("lib/poju/agent.ts");
  assert(
    "trigger block sets session original_question",
    /trigger_breakthrough_core[\s\S]*original_question:\s*freshQuestion/.test(agent),
  );
  assert(
    "freshQuestion from resolveOriginalQuestion",
    agent.includes("const freshQuestion = resolveOriginalQuestion"),
  );

  console.log("\n=== Fix B · breakthrough-core prefers agent_v2 question ===\n");
  const bt = read("lib/llm/deepseek/breakthrough-core.ts");
  assert(
    "reads agent_v2 before session top-level",
    /session\.agent_v2\?\.original_question\?\.trim\(\)\s*\|\|\s*session\.original_question/.test(bt),
  );
  assert("rejects empty original_question", bt.includes("original_question empty"));
  assert("logs input original_question", bt.includes("[breakthrough-core] input original_question:"));
  assert("fetch body uses resolved original_question", /original_question,\s*\n\s*agent_v2: agent/.test(bt));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 21 acceptance checks passed.\n");
}

main();
