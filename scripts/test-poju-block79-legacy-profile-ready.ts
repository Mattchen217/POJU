/**
 * Block 79 — legacy profile binding must not block opening→collecting gate
 *
 *   pnpm exec tsx scripts/test-poju-block79-legacy-profile-ready.ts
 */
import fs from "node:fs";
import path from "node:path";
import { createInitialAgentState, withCompleteUnderstanding } from "@/lib/poju/agent-state";
import { advanceStateMachine, extractModelTurnSignals } from "@/lib/poju/state-machine";
import {
  backfillSessionProfileBinding,
  resolveSessionHasProfile,
  withSessionProfileFlags,
} from "@/lib/poju/session-profile";
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

function legacyAgentOnlySession(): POJUSessionState {
  return {
    session_id: "legacy-profile",
    original_question: "徒弟坐了我的位置",
    messages: [],
    selected_stored_profile_id: null,
    has_profile: false,
    birth_submitted_in_session: false,
    profile_skipped: false,
    main_delivery_done: false,
    tokens_used: 0,
    context_collected: {},
    agent_v2: createInitialAgentState({
      original_question: "徒弟坐了我的位置",
      selected_profile_id: "active_user_profile",
    }),
  } as unknown as POJUSessionState;
}

function main(): void {
  console.log("\n========== POJU Block 79 · Legacy profile ready ==========\n");

  const sessionProfile = read("lib/poju/session-profile.ts");
  const agentTs = read("lib/poju/agent.ts");

  assert("resolveSessionHasProfile checks agent_v2.selected_profile_id", sessionProfile.includes("agent_v2?.selected_profile_id"));
  assert("resolveSessionHasProfile checks has_base_analysis", sessionProfile.includes("has_base_analysis === true"));
  assert("backfillSessionProfileBinding exported", sessionProfile.includes("export function backfillSessionProfileBinding"));
  assert("withSessionProfileFlags uses backfill", sessionProfile.includes("backfillSessionProfileBinding({"));
  assert("loadSessionProfileBundle tries candidate ids", sessionProfile.includes("collectSessionProfileCandidateIds(session)"));
  assert("loadSessionProfileBundle not gated by resolveSessionHasProfile", !sessionProfile.includes("if (!resolveSessionHasProfile(session)) return { profile: null, base_analysis: null }"));
  assert("loadSessionProfileBundle returns resolved_profile_id", sessionProfile.includes("resolved_profile_id"));
  assert("agent base_analysis_ready prioritizes loadedBaseAnalysis", /loadedBaseAnalysis != null[\s\S]*merged\.has_base_analysis/.test(agentTs));
  assert("agent backfills resolved profile id", agentTs.includes("resolved_profile_id"));

  const legacy = legacyAgentOnlySession();
  assert("legacy agent-only session has profile", resolveSessionHasProfile(legacy));

  const backfilled = backfillSessionProfileBinding(legacy);
  assert("backfill writes selected_stored_profile_id", backfilled.selected_stored_profile_id === "active_user_profile");
  assert("backfill syncs has_profile", withSessionProfileFlags(backfilled).has_profile === true);

  const nonUuidStored: POJUSessionState = {
    ...legacy,
    selected_stored_profile_id: "legacy-row-42",
    agent_v2: createInitialAgentState({ original_question: "q" }),
  };
  assert("non-uuid stored id recognized", resolveSessionHasProfile(nonUuidStored));

  const noProfile: POJUSessionState = {
    ...legacy,
    selected_stored_profile_id: null,
    agent_v2: createInitialAgentState({ original_question: "q" }),
  };
  assert("pure legacy without binding stays false", !resolveSessionHasProfile(noProfile));

  const agent = withCompleteUnderstanding(
    createInitialAgentState({ original_question: "徒弟坐了我的位置" }),
  );
  const signals = extractModelTurnSignals({
    understanding_sufficient: true,
    base_analysis_ready: true,
    substantive_opening_turns: 2,
    opening_problem_statement: "徒弟坐了我的位置",
  });
  const advance = advanceStateMachine(agent, signals, "我最想保住手艺传承");
  assert("struct complete + base ready advances to understanding gate", advance.next_agent.current_phase === "awaiting_understanding_confirm");
  assert("gate turn does not trigger breakthrough core", advance.trigger_breakthrough_core === false);

  const blocked = advanceStateMachine(
    agent,
    extractModelTurnSignals({ base_analysis_ready: false, substantive_opening_turns: 2 }),
    "我最想保住手艺传承",
  );
  assert("base not ready blocks advance", blocked.next_agent.current_phase === "opening");

  console.log("\n========================================\n");
  if (failures.length) {
    console.error(`FAILED (${failures.length}):`, failures.join(", "));
    process.exit(1);
  }
  console.log("All Block 79 checks passed.\n");
}

main();
