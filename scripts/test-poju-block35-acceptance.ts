/**
 * Block 35 — confirmation UX + delivery failure handling
 * Run: pnpm exec tsx scripts/test-poju-block35-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { classifyConfirmationAffirmative } from "@/lib/poju/confirmation-reply";

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
  console.log("\n========== POJU Block 35 Acceptance ==========\n");

  console.log("=== Phase + failure UX ===\n");
  const agent = read("lib/poju/agent.ts");
  assert("defer delivered until pipeline", agent.includes('current_phase: "awaiting_confirmation"'));
  assert("delivery failure retry hint", agent.includes("回复「继续」"));
  assert("continue retries delivery", classifyConfirmationAffirmative("继续") === "confirmed");

  const route = read("app/api/poju/final-delivery/route.ts");
  assert("no grounding-only bypass", !route.includes("isOnlyGroundingLowFailure"));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 35 acceptance checks passed.\n");
}

main();
