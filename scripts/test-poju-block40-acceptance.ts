/**
 * Block 40 — runUserTurn dedupe + provider order doc.
 * Run: pnpm exec tsx scripts/test-poju-block40-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

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
  console.log("\n=== Block 40 acceptance ===\n");

  const chatUi = read("components/poju/POJUChatUI.tsx");
  assert("turnInFlightRef declared", chatUi.includes("turnInFlightRef"));
  assert("alreadyAnswered re-fire guard", chatUi.includes("alreadyAnswered"));
  assert("unlock release alreadySent guard", chatUi.includes("alreadySent"));
  assert("no messages.length sig dedupe", !chatUi.includes("lastTurnSigRef"));

  const routing = read("lib/llm/openrouter-provider-routing.ts");
  assert("allow_fallbacks false", routing.includes("allow_fallbacks = false"));

  console.log("\n=== Summary ===\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 40 checks passed.\n");
  console.log(
    "Reminder: set OPENROUTER_PROVIDER_ORDER to a single stable provider in production (e.g. streamlake).\n",
  );
}

main();
