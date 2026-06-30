/**
 * Block 48 — post Block 47: max_tokens, first-question fallback, double-call guard.
 * Run: pnpm exec tsx scripts/test-poju-block48-acceptance.ts
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
  console.log("\n=== Block 48 acceptance ===\n");

  const opening = read("lib/llm/phases/opening-phase.ts");
  assert("opening max_tokens 16000", opening.includes("max_tokens: 16000"));
  assert("opening no 8192 cap", !opening.includes("max_tokens: 8192"));

  const agent = read("lib/poju/agent.ts");
  assert("justConverted fallback", agent.includes("justConverted"));
  assert("tail question check", agent.includes("finalContent.slice(-50)"));
  assert("no appendFirstFocusQuestion import", !agent.includes("appendFirstFocusQuestion"));

  const chatUi = read("components/poju/POJUChatUI.tsx");
  assert("turnInFlightRef guard", chatUi.includes("turnInFlightRef.current"));
  assert("alreadyAnswered guard", chatUi.includes("alreadyAnswered"));
  assert("failed reply allows retry", chatUi.includes('includes("未能生成")'));
  assert("no lastTurnSigRef", !chatUi.includes("lastTurnSigRef"));
  assert("unlock release alreadySent guard kept", chatUi.includes("alreadySent"));

  console.log("\n=== Summary ===\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 48 checks passed.\n");
}

main();
