/**
 * Block 17 — remove legacy no-profile greeting / in-chat birth form branches
 * Run: pnpm exec tsx scripts/test-poju-block17-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function exists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function main(): void {
  console.log("\n========== POJU Block 17 Acceptance ==========\n");

  console.log("=== Deleted legacy files ===\n");
  assert("greeting-phase removed", !exists("lib/llm/phases/greeting-phase.ts"));
  assert("BirthProfileFlow removed", !exists("components/poju/BirthProfileFlow.tsx"));
  assert("birth-flow-messages removed", !exists("lib/poju/birth-flow-messages.ts"));
  assert("poju-step2-entry removed", !exists("components/poju/poju-step2-entry.tsx"));

  console.log("\n=== Phase runner / LLM no greeting branch ===\n");
  assert("poju-phase-router removed", !exists("lib/llm/poju-phase-router.ts"));
  const runner = read("lib/poju/agent-phase-runner.ts");
  assert("runner resolves phase from state-machine", runner.includes("@/lib/poju/state-machine"));
  assert("opening always callOpeningPhase", runner.includes('case "opening":'));

  const llm = read("lib/llm/poju-llm.ts");
  assert("no shouldUseGreetingPhase", !llm.includes("shouldUseGreetingPhase"));
  assert("no greeting-phase import", !llm.includes("greeting-phase"));
  assert("runner no greeting", !runner.includes("callGreetingPhase"));

  console.log("\n=== Chat UI no in-chat birth form ===\n");
  const ui = read("components/poju/POJUChatUI.tsx");
  assert("no BirthProfileFlow", !ui.includes("BirthProfileFlow"));
  assert("no ProfileSelector in chat", !ui.includes("ProfileSelector"));
  assert("no showProfilePicker", !ui.includes("showProfilePicker"));
  assert("no birthFlowStage", !ui.includes("birthFlowStage"));

  const orch = read("lib/poju/agent-orchestrator.ts");
  assert("no showBirthForm ui", !orch.includes("showBirthForm"));
  assert("no showProfilePicker ui", !orch.includes("showProfilePicker"));

  const sessionPage = read("app/[locale]/(marketing)/poju/session/[sessionId]/page.tsx");
  assert("session gate no profile_skipped bypass", !sessionPage.includes("profile_skipped"));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 17 acceptance checks passed.\n");
}

main();
