/**
 * Block 12 — unlock session starts at opening (not collecting_context)
 * Run: pnpm exec tsx scripts/test-poju-block12-acceptance.ts
 */
import fs from "node:fs";
import path from "node:path";

import { createInitialAgentState } from "@/lib/poju/agent-state";
import {
  finalizeUnlockBaziSession,
  prepareUnlockReleaseSession,
} from "@/lib/poju/finalize-unlock-bazi-session";
import { resolveActiveAgentPhase } from "@/lib/poju/state-machine";
import type { POJUSessionState } from "@/lib/poju/types";

const ROOT = path.join(process.cwd());
const failures: string[] = [];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assert(label: string, ok: boolean): void {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

function baseSession(): POJUSessionState {
  const agent = createInitialAgentState({
    original_question: "default",
    selected_profile_id: "profile-1",
  });
  return {
    session_id: "s1",
    original_question: "default",
    messages: [],
    has_profile: true,
    agent_v2: agent,
  } as unknown as POJUSessionState;
}

function main(): void {
  console.log("\n========== POJU Block 12 Acceptance ==========\n");

  console.log("=== Fix · unlock session phase = opening ===\n");
  const src = read("lib/poju/finalize-unlock-bazi-session.ts");
  assert("finalizeUnlock no collecting_context preset", !src.includes('current_phase: "collecting_context"'));
  assert("finalizeUnlock sets opening", (src.match(/current_phase: "opening"/g) ?? []).length >= 2);

  const finalized = finalizeUnlockBaziSession(baseSession(), "report body", "profile-1");
  assert(
    "finalizeUnlockBaziSession → opening",
    finalized.agent_v2?.current_phase === "opening",
  );
  assert(
    "finalizeUnlock active phase is opening",
    resolveActiveAgentPhase(finalized) === "opening",
  );

  const released = prepareUnlockReleaseSession(finalized, "事业这几年一直不顺");
  assert(
    "prepareUnlockReleaseSession → opening",
    released.agent_v2?.current_phase === "opening",
  );
  assert(
    "released question preserved",
    released.original_question === "事业这几年一直不顺",
  );
  assert(
    "released session still resolves opening",
    resolveActiveAgentPhase(released) === "opening",
  );

  console.log("\n=== Audit · other collecting_context presets ===\n");
  const pojuLib = read("lib/poju/cycle-manager.ts");
  assert("cycle-manager still has new-cycle collecting", pojuLib.includes('current_phase: "collecting_context"'));
  const unlockOnly = read("lib/poju/finalize-unlock-bazi-session.ts");
  assert("unlock file has no collecting_context", !unlockOnly.includes("collecting_context"));

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 12 acceptance checks passed.\n");
}

main();
