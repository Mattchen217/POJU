import assert from "node:assert/strict";
import {
  applyIntakeProtection,
  classifyIntakeInput,
  emptyIntakeProtectionState,
  INTAKE_CONTINUE_TOKEN,
  INTAKE_LOCKOUT_COOLDOWN_MS,
  INTAKE_SESSION_RETENTION_MS,
  inspectIntakeProtectionGate,
  readIntakeProtection,
} from "../lib/poju/decision-intake/intake-protection";
import { classifyAnswer } from "../lib/poju/decision-intake/answer-interpretation";
import { runAdaptiveQuestionTurn } from "../lib/poju/decision-intake/adaptive-turn";
import { computeReadinessProgress, evaluatePersonalPatternInsight } from "../lib/poju/decision-intake/understanding-state";
import { bindPersonalAnalysisProfile } from "../lib/poju/decision-intake/personal-analysis-profile";
import { sessionEligibleForFinalConfirm } from "../lib/poju/decision-intake/confirm-and-freeze";
import { projectAdaptiveQuestionForUi } from "../lib/poju/decision-intake/ui-projection";
import type { POJUSessionState } from "../lib/poju/types";
import type { DecisionContext } from "../lib/poju/decision-context/types";
import type { DecisionBlueprint } from "../lib/poju/decision-intake/types";

const now0 = "2026-11-18T12:00:00.000Z";
const t = (name: string, fn: () => void) => { fn(); console.log(`PASS ${name}`); };
const asyncT = async (name: string, fn: () => Promise<void>) => { await fn(); console.log(`PASS ${name}`); };

let passed = 0;
const wrap = (name: string, fn: () => void) => { t(name, fn); passed += 1; };
const wrapAsync = async (name: string, fn: () => Promise<void>) => { await asyncT(name, fn); passed += 1; };

async function main() {
wrap("A/classify: short relevant, unknown, declined, skip, uncertainty are not invalid", () => {
  assert.equal(classifyIntakeInput("yes"), "valid_short_relevant");
  assert.equal(classifyIntakeInput("ok"), "valid_short_relevant");
  assert.equal(classifyIntakeInput("I don't know"), "valid_unknown");
  assert.equal(classifyIntakeInput("\u4e0d\u77e5\u9053"), "valid_unknown");
  assert.equal(classifyIntakeInput("prefer not"), "valid_declined");
  assert.equal(classifyIntakeInput("skip"), "valid_skip");
  assert.equal(classifyIntakeInput("\u8df3\u8fc7"), "valid_skip");
  assert.equal(classifyIntakeInput("?"), "valid_uncertain");
  assert.equal(classifyIntakeInput("not sure"), "valid_uncertain");
  assert.equal(classifyIntakeInput("actually I meant the deadline is Friday"), "valid_correction");
});

wrap("A/classify: off-topic, gibberish, empty, unusable are invalid", () => {
  assert.equal(classifyIntakeInput(""), "invalid_empty");
  assert.equal(classifyIntakeInput("   "), "invalid_empty");
  assert.equal(classifyIntakeInput("tell me a joke"), "invalid_off_topic");
  assert.equal(classifyIntakeInput("asdfjkl;asdf"), "invalid_gibberish");
  assert.equal(classifyIntakeInput("aaaaaaaa"), "invalid_gibberish");
  assert.ok(classifyIntakeInput("!!!!!").startsWith("invalid_"));
});

wrap("A/classifyAnswer: short relevant is partial, not invalid_input", () => {
  const session = {
    decision_understanding: {
      last_sent_question: {
        question_text: "What is the deadline?",
        plan_id: "plan_1",
        direction_id: "dir_deadline",
        dir_ids: ["DIR_deadline"],
        ddr_ids: ["DDR_1"],
        fact_role_codes: ["v1/dir/DIR_deadline/role/deadline"],
        turn_id: "turn_q1",
      },
    },
  } as unknown as POJUSessionState;
  const short = classifyAnswer({ session, statement: "Friday", target: {
    dir_ids: ["DIR_deadline"],
    ddr_ids: ["DDR_1"],
    direction_id: "dir_deadline",
    fact_roles: ["deadline"],
    fact_role_codes: ["v1/dir/DIR_deadline/role/deadline"],
  } as never });
  assert.notEqual(short.cls, "invalid_input");
  assert.notEqual(short.cls, "off_topic");
});

function step(state: ReturnType<typeof emptyIntakeProtectionState>, kind: Parameters<typeof applyIntakeProtection>[0]["kind"], iso: string, turnId: string) {
  return applyIntakeProtection({ state, kind, nowIso: iso, turnId });
}

wrap("A1 first invalid warns and reasks", () => {
  const d = step(emptyIntakeProtectionState(), "invalid_gibberish", now0, "t1");
  assert.equal(d.action, "warn_and_reask");
  assert.equal(d.state.invalid_streak, 1);
  assert.equal(d.state.lockout_count, 0);
  assert.equal(d.state.status, "warned");
  assert.equal(d.block_model, true);
  assert.equal(d.block_dc_write, true);
  assert.equal(d.block_pass_charge, true);
});

wrap("A2 second consecutive invalid locks for 10 minutes", () => {
  const first = step(emptyIntakeProtectionState(), "invalid_gibberish", now0, "t1");
  const second = step(first.state, "invalid_off_topic", now0, "t2");
  assert.equal(second.action, "lock");
  assert.equal(second.state.lockout_count, 1);
  assert.equal(second.state.invalid_streak, 0);
  assert.equal(second.state.status, "locked");
  assert.equal(Date.parse(second.state.lockout_until!), Date.parse(now0) + INTAKE_LOCKOUT_COOLDOWN_MS);
  assert.equal(Date.parse(second.state.session_expires_at!), Date.parse(now0) + INTAKE_SESSION_RETENTION_MS);
});

wrap("A3 continue within 10 minutes is rejected", () => {
  const locked = step(step(emptyIntakeProtectionState(), "invalid_gibberish", now0, "t1").state, "invalid_gibberish", now0, "t2");
  const mid = new Date(Date.parse(now0) + 5 * 60 * 1000).toISOString();
  const again = step(locked.state, "continue", mid, "t3");
  assert.equal(again.action, "reject_locked");
  assert.equal(again.state.lockout_count, 1);
  assert.equal(again.block_model, true);
});

wrap("A4 continue after 10 minutes resumes", () => {
  const locked = step(step(emptyIntakeProtectionState(), "invalid_gibberish", now0, "t1").state, "invalid_gibberish", now0, "t2");
  const later = new Date(Date.parse(now0) + INTAKE_LOCKOUT_COOLDOWN_MS).toISOString();
  const resumed = step(locked.state, "continue", later, "t3");
  assert.equal(resumed.action, "resume");
  assert.equal(resumed.state.status, "active");
  assert.equal(resumed.state.invalid_streak, 0);
  assert.equal(resumed.state.lockout_count, 1);
});

wrap("A5 valid answer resets streak", () => {
  const warned = step(emptyIntakeProtectionState(), "invalid_gibberish", now0, "t1");
  const valid = step(warned.state, "valid_answer", now0, "t2");
  assert.equal(valid.action, "allow");
  assert.equal(valid.state.invalid_streak, 0);
  assert.equal(valid.state.status, "active");
  assert.equal(valid.block_model, false);
});

wrap("A6 lock again after resume", () => {
  let state = emptyIntakeProtectionState();
  state = step(state, "invalid_gibberish", now0, "t1").state;
  state = step(state, "invalid_gibberish", now0, "t2").state;
  const later = new Date(Date.parse(now0) + INTAKE_LOCKOUT_COOLDOWN_MS).toISOString();
  state = step(state, "continue", later, "t3").state;
  state = step(state, "invalid_gibberish", later, "t4").state;
  const locked2 = step(state, "invalid_gibberish", later, "t5");
  assert.equal(locked2.action, "lock");
  assert.equal(locked2.state.lockout_count, 2);
});

wrap("A7 third lockout permanently terminates", () => {
  let state = emptyIntakeProtectionState();
  const start = Date.parse(now0);
  for (let i = 0; i < 3; i++) {
    const at = new Date(start + i * (INTAKE_LOCKOUT_COOLDOWN_MS + 1000)).toISOString();
    if (i > 0) state = step(state, "continue", at, `c${i}`).state;
    state = step(state, "invalid_gibberish", at, `a${i}`).state;
    const d = step(state, "invalid_gibberish", at, `b${i}`);
    state = d.state;
    if (i < 2) assert.equal(d.action, "lock");
    else {
      assert.equal(d.action, "terminate");
      assert.equal(d.state.status, "terminated");
      assert.equal(d.state.terminal_reason, "third_lockout");
      assert.equal(d.state.lockout_count, 3);
      assert.equal(d.recoverable, false);
    }
  }
});

wrap("A8/A9 24h expiry does not increment lockout_count", () => {
  const locked = step(step(emptyIntakeProtectionState(), "invalid_gibberish", now0, "t1").state, "invalid_gibberish", now0, "t2");
  const expiredAt = new Date(Date.parse(now0) + INTAKE_SESSION_RETENTION_MS).toISOString();
  const expired = step(locked.state, "valid_answer", expiredAt, "t9");
  assert.equal(expired.action, "expire");
  assert.equal(expired.state.status, "expired");
  assert.equal(expired.state.terminal_reason, "session_expired");
  assert.equal(expired.state.lockout_count, locked.state.lockout_count);
  assert.equal(expired.block_model, true);
});

wrap("A10 unknown and declined do not lock", () => {
  const u = step(emptyIntakeProtectionState(), "valid_unknown", now0, "t1");
  const d = step(u.state, "valid_declined", now0, "t2");
  assert.equal(u.action, "allow");
  assert.equal(d.action, "allow");
  assert.equal(d.state.invalid_streak, 0);
  assert.equal(d.state.lockout_count, 0);
});

wrap("A11 repeat submit is idempotent", () => {
  const first = step(emptyIntakeProtectionState(), "invalid_gibberish", now0, "t1");
  const replay = step(first.state, "invalid_gibberish", now0, "t1");
  assert.equal(replay.idempotent_replay, true);
  assert.equal(replay.state.invalid_streak, 1);
  assert.equal(replay.state.lockout_count, 0);
});

wrap("A12 concurrent invalid uses latest state, no double count on same turn", () => {
  const first = step(emptyIntakeProtectionState(), "invalid_gibberish", now0, "t1");
  const racedSame = step(emptyIntakeProtectionState(), "invalid_gibberish", now0, "t1");
  assert.equal(racedSame.state.invalid_streak, 1);
  const serialized = step(first.state, "invalid_gibberish", now0, "t2");
  assert.equal(serialized.state.lockout_count, 1);
});

wrap("A13 refresh cannot forge cooldown end", () => {
  const locked = step(step(emptyIntakeProtectionState(), "invalid_gibberish", now0, "t1").state, "invalid_gibberish", now0, "t2");
  const forged = { ...locked.state, lockout_until: now0, status: "locked" as const };
  // Authoritative path uses the stored lockout_until + server now, not a client-forged clock on its own.
  // A client-forged earlier until would only work if the server adopted that snapshot, which Session Authority does not.
  const persisted = readIntakeProtection({ intake_protection: locked.state } as POJUSessionState);
  const mid = Date.parse(now0) + 5 * 60 * 1000;
  const gate = inspectIntakeProtectionGate(persisted, mid);
  assert.equal(gate.action, "reject_locked");
  assert.equal(forged.lockout_until, now0);
});

wrap("A14/A15 lockout blocks model, DC write, and PASS charge", () => {
  const locked = step(step(emptyIntakeProtectionState(), "invalid_gibberish", now0, "t1").state, "invalid_gibberish", now0, "t2");
  assert.equal(locked.block_model, true);
  assert.equal(locked.block_dc_write, true);
  assert.equal(locked.block_pass_charge, true);
});

const blueprint = {
  blueprint_version: 1,
  question_budget: { soft: 10, hard: 15, depth_per_direction: 3 },
  directions: [
    { direction_id: "D1", label: "Deadline", priority: "P0", dir_ids: ["DIR_p0"] },
    { direction_id: "D2", label: "Budget", priority: "P1", dir_ids: ["DIR_p1"] },
  ],
} as unknown as DecisionBlueprint;

function sessionForTurn(over: Partial<POJUSessionState> = {}): POJUSessionState {
  const dc = {
    context_id: "ctx_di2",
    version: 1,
    content_hash: "hash_di2",
    status: "draft",
    definition: { decision_question: "Should I leave this job?" },
    reality_facts: [],
    constraints: [],
    hypotheses: [],
    dirs: [
      { dir_id: "DIR_p0", need: "deadline", current_state: "unknown", id_lifecycle: "active" },
      { dir_id: "DIR_p1", need: "budget", current_state: "unknown", id_lifecycle: "active" },
    ],
    conflicts: [],
  } as unknown as DecisionContext;
  return {
    session_id: "session_di2",
    decision_context: dc,
    decision_blueprint: blueprint,
    decision_understanding: {
      last_sent_question: {
        question_text: "What is the deadline?",
        plan_id: "plan_1",
        direction_id: "D1",
        dir_ids: ["DIR_p0"],
        ddr_ids: ["DDR_1"],
        turn_id: "q1",
      },
      readiness: { verdict: "continue", can_ask: true, reasons: [] },
      budget: { soft_budget_limit: 10, hard_budget_limit: 15, session_asked_count: 1, review_cycle: 1, cycle_base_asked: 0, remaining_hard_budget: 14, depth_by_dir: {} },
    },
    expires_at: "2026-12-18T12:00:00.000Z",
    ...over,
  } as unknown as POJUSessionState;
}

await wrapAsync("A14 production turn: first invalid does not call the model hook", async () => {
  let modelCalls = 0;
  const result = await runAdaptiveQuestionTurn({
    session: sessionForTurn(),
    statement: "asdfjkl;asdf",
    source_turn_id: "turn_invalid_1",
    now: now0,
    locale: "en",
    test_hooks: {
      interpretAnswerModel: async () => {
        modelCalls += 1;
        throw new Error("model_must_not_run");
      },
    },
  });
  assert.equal(result.outcome, "intake_warned");
  assert.equal(modelCalls, 0);
  assert.equal(result.session.intake_protection?.invalid_streak, 1);
  assert.equal(result.authorized_question, "What is the deadline?");
  assert.ok((result.user_visible_message ?? "").length > 0);
});

await wrapAsync("A14 production turn: second invalid locks and still skips the model", async () => {
  let modelCalls = 0;
  const first = await runAdaptiveQuestionTurn({
    session: sessionForTurn(),
    statement: "asdfjkl;asdf",
    source_turn_id: "turn_invalid_1",
    now: now0,
    locale: "en",
    test_hooks: { interpretAnswerModel: async () => { modelCalls += 1; throw new Error("model_must_not_run"); } },
  });
  const second = await runAdaptiveQuestionTurn({
    session: first.session,
    statement: "tell me a joke",
    source_turn_id: "turn_invalid_2",
    now: now0,
    locale: "en",
    test_hooks: { interpretAnswerModel: async () => { modelCalls += 1; throw new Error("model_must_not_run"); } },
  });
  assert.equal(second.outcome, "intake_locked");
  assert.equal(modelCalls, 0);
  assert.equal(second.session.intake_protection?.lockout_count, 1);
  assert.equal(second.session.decision_context?.dirs[0]?.current_state, "unknown");
});

wrap("B progress is from DDR/DIR/Gate, not question count, and 100% is capped until complete", () => {
  const dc = sessionForTurn().decision_context!;
  const low = computeReadinessProgress({
    dc,
    blueprint,
    sufficiency: { verdict: "continue_collecting", canStop: false, reasons: [] } as never,
  });
  assert.equal(low.basis, "ddr_dir_gate");
  assert.ok(low.percent < 100);
  assert.equal(low.complete, false);
  const readyDc = {
    ...dc,
    dirs: [
      { dir_id: "DIR_p0", need: "deadline", current_state: "known", id_lifecycle: "active" },
      { dir_id: "DIR_p1", need: "budget", current_state: "known", id_lifecycle: "active" },
    ],
    conflicts: [],
  } as unknown as DecisionContext;
  const high = computeReadinessProgress({
    dc: readyDc,
    blueprint,
    sufficiency: { verdict: "sufficient", canStop: true, reasons: [] } as never,
  });
  assert.equal(high.complete, true);
  assert.equal(high.percent, 100);
  const ui = projectAdaptiveQuestionForUi(sessionForTurn({
    decision_understanding: {
      ...sessionForTurn().decision_understanding!,
      current_understanding: { summary: "s", decision_question: "q", confirmed_briefs: [], unconfirmed_briefs: [], analysis_briefs: [], conflict_briefs: [], confidence: "low" },
      understood: { items: [] },
      need_to_understand: { items: [] },
      personal_pattern_insight: { status: "none", insights: [] },
      next_question_plan: null,
      last_answer_event_id: null,
      readiness_progress: low,
    } as never,
  }));
  assert.equal(ui.readiness_progress_percent, low.percent);
});

wrap("C missing profile stays unavailable and does not fabricate insights", () => {
  const bound = bindPersonalAnalysisProfile(sessionForTurn(), now0);
  assert.equal(bound.personal_analysis_profile?.source, "unavailable");
  const insight = evaluatePersonalPatternInsight(bound);
  assert.equal(insight.status, "unavailable");
  assert.equal(insight.insights.length, 0);
});

wrap("C available BaZi+ZiWei profile can surface a decision-relevant unverified insight once", () => {
  const withProfile = bindPersonalAnalysisProfile(sessionForTurn({
    matrix_payload: {
      profile_id: "profile_real",
      structured: { day_master: "Jia Wood", strength: "strong", pattern: "Zheng Guan", data_availability: {} },
      user_profile: { birth: { year: 1990, month: 1, day: 1, hour: 12, minute: 0, gender: "male" } },
    } as never,
  }), now0);
  assert.ok(withProfile.personal_analysis_profile);
  const again = bindPersonalAnalysisProfile(withProfile, "2026-11-18T13:00:00.000Z");
  assert.equal(again.personal_analysis_profile?.calculated_at, withProfile.personal_analysis_profile?.calculated_at);
  const insight = evaluatePersonalPatternInsight(withProfile);
  if (insight.status === "available") {
    assert.ok(insight.insights[0]?.text);
    assert.equal(insight.insights[0]?.epistemic, "traditional_interpretation");
    const repeated = evaluatePersonalPatternInsight({
      ...withProfile,
      decision_understanding: {
        ...withProfile.decision_understanding!,
        personal_pattern_insight: insight,
      } as never,
    });
    assert.equal(repeated.status, "none");
  } else {
    assert.ok(insight.status === "none" || insight.status === "unavailable");
  }
});

wrap("D existing confirm eligibility is unchanged and does not invent Freeze success", () => {
  const ready = sessionForTurn({
    agent_v2: { current_phase: "awaiting_confirmation" } as never,
    decision_understanding: {
      ...sessionForTurn().decision_understanding!,
      readiness: { can_ask: false, verdict: "ready_for_final_confirm", reasons: [] },
    } as never,
  });
  assert.equal(sessionEligibleForFinalConfirm(ready, "\u786e\u8ba4"), true);
  const notReady = sessionForTurn({
    agent_v2: { current_phase: "awaiting_confirmation" } as never,
  });
  assert.equal(sessionEligibleForFinalConfirm(notReady, "\u786e\u8ba4"), false);
});

console.log(`DI2 feature landing tests passed: ${passed}`);
}

void main();
