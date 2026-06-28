/**
 * Part E — dev-only state machine debug panel + API debug_state_ledger
 * Run: pnpm exec tsx scripts/test-poju-block-e-debug-panel.ts
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
  console.log("\n========== POJU Part E · Debug Panel ==========\n");

  console.log("=== E1 · API debug_state_ledger ===\n");
  const route = read("app/api/poju/chat/route.ts");
  const stream = read("lib/poju/poju-chat-stream.ts");
  const devLedger = read("lib/poju/dev-state-ledger.ts");
  assert("attachDevStateLedger helper", devLedger.includes("attachDevStateLedger"));
  assert("NODE_ENV development gate", devLedger.includes('process.env.NODE_ENV !== "development"'));
  assert("route uses attachDevStateLedger", route.includes("attachDevStateLedger"));
  assert("stream uses attachDevStateLedger", stream.includes("attachDevStateLedger"));

  console.log("\n=== E2 · StateMachineDebugPanel ===\n");
  const panel = read("components/poju/StateMachineDebugPanel.tsx");
  const ui = read("components/poju/POJUChatUI.tsx");
  const css = read("components/poju/poju-chat.css");
  assert("panel component exists", panel.includes("StateMachineDebugPanel"));
  assert("panel dev early return", panel.includes('process.env.NODE_ENV !== "development"'));
  assert("UI wires panel", ui.includes("<StateMachineDebugPanel"));
  assert("UI syncs ledger after turn", ui.includes("syncDebugStateLedger"));
  assert("UI shell layout", ui.includes("poju-chat-shell"));
  assert("panel CSS", css.includes(".poju-debug-panel"));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Part E debug panel checks passed.\n");
}

main();
