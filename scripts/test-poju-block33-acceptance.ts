/**
 * Block 33 — runUserTurn synchronous re-entry guard
 * Run: pnpm exec tsx scripts/test-poju-block33-acceptance.ts
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
  console.log("\n========== POJU Block 33 Acceptance ==========\n");

  const ui = read("components/poju/POJUChatUI.tsx");

  console.log("=== Sync turn-in-flight guard ===\n");
  assert("turnInFlightRef declared", ui.includes("const turnInFlightRef = useRef(false)"));
  assert("runUserTurn blocks when in flight", /if \(turnInFlightRef\.current\) return/.test(ui));
  assert("runUserTurn sets in flight before gen bump", /turnInFlightRef\.current = true[\s\S]*sendGenerationRef\.current/.test(ui));
  assert("finally releases turnInFlightRef", /finally \{[\s\S]*turnInFlightRef\.current = false/.test(ui));
  assert("handleStopGeneration releases turnInFlightRef", /function handleStopGeneration\(\) \{[\s\S]*turnInFlightRef\.current = false/.test(ui));
  assert("confirmEdit calls handleStopGeneration before runUserTurn", /handleStopGeneration\(\)[\s\S]*await runUserTurn/.test(ui));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 33 acceptance checks passed.\n");
}

main();
