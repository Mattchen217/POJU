/**
 * S7 — Production Draft DC lifecycle + Chat full_pipeline observation (engineering).
 * Run: pnpm exec tsx scripts/test-s7-dc-lifecycle.ts
 */

import assert from "node:assert/strict";
import {
  applyCallAToSessionDc,
  applyCallBToSessionDc,
  applyCollectingUserTurnToSessionDc,
  canFreezeSessionOnSufficiency,
  seedOpeningDraftDcOnSession,
  shouldRequireFrozenDecisionContext,
} from "../lib/poju/decision-context";
import { createInitialAgentState } from "../lib/poju/agent-state";
import type { POJUSessionState } from "../lib/poju/types";
import { buildLabObservation } from "../lib/llm/pro/delivery/lab/observation";
import { buildLabCallTrace, slimLabCallTrace } from "../lib/llm/pro/delivery/lab/call-trace";

let passed = 0;
let failed = 0;

async function check(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`  FAIL  ${name}`);
    console.error(e);
  }
}

function baseSession(): POJUSessionState {
  const agent = createInitialAgentState({
    original_question: "Should I leave my job?",
  });
  agent.core_dilemma = {
    concrete_event: "Offer to join a startup",
    stakes: "Income stability",
    sticking_point: "Family depends on salary",
  };
  agent.desired_direction = {
    wants: "Keep optionality for 6 months",
    priority: "reversibility",
  };
  agent.current_phase = "awaiting_understanding_confirm";
  return {
    session_id: "sess_s7_lifecycle",
    user_id: "u_s7",
    created_at: "2026-11-03T10:00:00.000Z",
    last_interaction_at: "2026-11-03T10:00:00.000Z",
    expires_at: "2026-12-03T10:00:00.000Z",
    original_question: "Should I leave my job?",
    messages: [
      {
        role: "user",
        content: "I got a startup offer but I am worried about runway.",
        timestamp: "2026-11-03T10:00:01.000Z",
        client_id: "u_open_1",
      },
      {
        role: "assistant",
        content: "理解摘要…",
        timestamp: "2026-11-03T10:00:02.000Z",
        client_id: "a_gate_1",
        meta: { understanding_gate_pending: true },
      },
    ],
    context_collected: {},
    has_profile: false,
    profile_skipped: false,
    actions: [],
    tokens_used: 0,
    abuse_metrics: {
      long_input_count: 0,
      jailbreak_attempts: 0,
      duplicate_attempts: 0,
    },
    agent_v2: agent,
  } as POJUSessionState;
}

const sampleCore = {
  situation_conclusion: "Income risk vs optionality",
  key_crossroads: {
    real_fork: "Stay vs leave",
    path_costs: "Stability vs growth",
    decision_traits: "Risk tolerance",
    structural_basis: "Day master",
    needs_validation: "Family cash runway",
  },
  modern_action_frames: [
    {
      direction: "Negotiate bridge",
      why_fits: "Keeps optionality",
      structural_basis: "Resource star",
      needs_validation: "Manager flexibility",
    },
  ],
  primary_path: {
    direction: "Negotiate bridge",
    why_fits: "Keeps optionality",
    structural_basis: "Resource star",
    needs_validation: "Manager flexibility",
  },
  backup_path: {
    direction: "Defer leave 6 months",
    why_fits: "Buys runway",
    structural_basis: "Timing",
    needs_validation: "Offer expiry",
  },
  energy_retune_frame: {
    direction_fit: "Water support",
    timing_ripeness: "Next quarter",
    daily_retune: "Sleep",
    complementary: "Mentor",
    structural_basis: "Basis",
    needs_validation: "Stress",
  },
  rhythm_frame: {
    phase1_observe: "Watch cash",
    phase2_adjust: "Talk terms",
    phase3_consolidate: "Decide",
  },
  self_check_signals: ["anxiety spike"],
} as import("../lib/poju/agent-state").BreakthroughCore;

const sampleAgenda = [
  {
    id: "ag_1",
    label: "Current savings runway",
    critical: true,
    status: "unexplored" as const,
    collection_goal: "Know months of runway",
    role: "fill" as const,
    serves_page: "05",
    frame_kind: "modern_action" as const,
    frame_index: 1,
  },
];

async function main() {
console.log("\nS7 Draft DC lifecycle + Chat observation\n");

await check("Opening seed: draft DC + definition + user facts, no hyp/dirs", () => {
  const seeded = seedOpeningDraftDcOnSession(baseSession());
  assert.equal(seeded.created, true);
  const dc = seeded.session.decision_context!;
  assert.equal(dc.status, "draft");
  assert.ok(dc.definition.concrete_event?.includes("startup"));
  assert.ok(dc.reality_facts.length >= 1);
  assert.equal(dc.hypotheses.length, 0);
  assert.equal(dc.dirs.length, 0);
  assert.equal(seeded.session.control_plane?.opening_gate_state, "confirmed");
});

await check("Opening seed is idempotent when draft already present", () => {
  const once = seedOpeningDraftDcOnSession(baseSession()).session;
  const twice = seedOpeningDraftDcOnSession(once);
  assert.equal(twice.created, false);
  assert.equal(twice.skipped_reason, "already_present");
});

await check("Call A writes hypotheses only (not Facts/Constraints from core)", () => {
  const seeded = seedOpeningDraftDcOnSession(baseSession()).session;
  const factsBefore = seeded.decision_context!.reality_facts.length;
  const constraintsBefore = seeded.decision_context!.constraints.length;
  const applied = applyCallAToSessionDc(seeded, sampleCore, {
    source_ref: "call_a:test",
  });
  assert.equal(applied.applied, true);
  const dc = applied.session.decision_context!;
  assert.ok(dc.hypotheses.length > 0, "expected hypotheses from Call A");
  assert.equal(dc.reality_facts.length, factsBefore);
  assert.equal(dc.constraints.length, constraintsBefore);
  assert.ok(applied.session.control_plane?.last_call_a_fingerprint);
});

await check("Call B maps Agenda → DIR and keeps fingerprint", () => {
  let s = seedOpeningDraftDcOnSession(baseSession()).session;
  s = applyCallAToSessionDc(s, sampleCore, { source_ref: "call_a:test" }).session;
  const applied = applyCallBToSessionDc(s, sampleAgenda);
  assert.equal(applied.applied, true);
  const dc = applied.session.decision_context!;
  assert.ok(dc.dirs.length >= 1);
  assert.ok(
    dc.dirs.some((d) => d.agenda_item_ids?.includes("ag_1") || d.need),
    "DIR should relate to agenda",
  );
  assert.ok(applied.session.control_plane?.last_call_b_fingerprint);
  assert.equal(
    applied.session.control_plane?.investigation_agenda?.[0]?.id,
    "ag_1",
  );
});

await check("Collecting appends unverified fact and never auto-confirms", () => {
  let s = seedOpeningDraftDcOnSession(baseSession()).session;
  s = applyCallAToSessionDc(s, sampleCore, { source_ref: "call_a:test" }).session;
  s = applyCallBToSessionDc(s, sampleAgenda).session;
  const applied = applyCollectingUserTurnToSessionDc(s, {
    statement: "I have about four months of savings.",
    source_turn_id: "u_collect_1",
  });
  assert.equal(applied.applied, true);
  const fact = applied.session.decision_context!.reality_facts.find(
    (f) => f.source_turn_id === "u_collect_1",
  );
  assert.ok(fact);
  assert.equal(fact!.status, "unverified");
  assert.equal(fact!.user_confirmed, false);
  assert.equal(fact!.source_stage, "collecting");
});

await check("Freeze still blocked without Stage3 sufficiency (S5 invariant)", () => {
  let s = seedOpeningDraftDcOnSession(baseSession()).session;
  s = applyCallAToSessionDc(s, sampleCore, { source_ref: "call_a:test" }).session;
  s = applyCallBToSessionDc(s, sampleAgenda).session;
  const gate = canFreezeSessionOnSufficiency({
    session: s,
    trigger: "pre_delivery_safety",
  });
  assert.equal(gate.allowed, false);
});

await check("Legacy no-DC session: soft require still allows delivery", () => {
  const legacy = baseSession();
  assert.equal(legacy.decision_context, undefined);
  assert.equal(shouldRequireFrozenDecisionContext(legacy), false);
});

await check("Chat full_pipeline observation exposes nine layers from real trace", () => {
  const trace = slimLabCallTrace(
    buildLabCallTrace({
      phase: "opening",
      system: "SYSTEM_PROMPT_S7",
      user: "USER_PROMPT_S7\n\n---\n\nFormal Decision Context stub",
      user_feed: "Formal Decision Context stub",
      raw_text: "assistant reply",
      parsed: { options: ["A"] },
      result: {
        reasoning: "think",
        actual_model: "test-model",
        meta: {
          call_type: "chat_flash",
          tokens_used: 10,
          latency_ms: 12,
          cost_usd: 0,
          cached_tokens: 0,
          thinking_enabled: false,
          thinking_effort: "medium",
          generation_id: "gen_s7",
          finish_reason: "stop",
        },
      },
    }),
  );
  const obs = buildLabObservation({
    stage: "opening",
    step_key: "pipeline_chat",
    session_id: "sess_s7_lifecycle",
    lab_id: "lab_s7",
    call_trace: trace,
    input_payload: { user_message: "hi", phase_before: "opening" },
    processing_actions: [{ action: "handleUserMessage", detail: "opening" }],
    gate_verdict: { passed: true },
    raw_model_output: { content: "assistant reply" },
    output_to_next_stage: { phase: "opening" },
    has_context_snapshot: true,
    context_status: "draft",
  });
  assert.equal(obs.stage, "opening");
  assert.ok(obs.input && "user_message" in obs.input);
  assert.ok((obs.prompt?.system_chars ?? 0) > 0);
  assert.ok((obs.prompt?.user_chars ?? 0) > 0);
  assert.equal(obs.prompt?.has_formal_dc, true);
  assert.equal(obs.model?.name, "test-model");
  assert.ok((obs.response?.raw_chars ?? 0) > 0);
  assert.ok((obs.transform?.length ?? 0) >= 1);
  assert.equal(obs.validation?.passed, true);
  assert.ok(obs.render?.preview_kind);
  assert.equal(obs.session_id, "sess_s7_lifecycle");
  assert.equal(obs.lab_id, "lab_s7");
  assert.equal(obs.generation_id, "gen_s7");
});

console.log(`\nS7 result: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
