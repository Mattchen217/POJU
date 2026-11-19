/**
 * DI2 Phase 2 pre-verification — Answer Interpretation receives the complete
 * structured Understanding State as read-only context.
 *
 *   pnpm test:di2-understanding-answer-interpretation-context
 *
 * Calls production functions (not source-regex-only proof). Deterministic
 * Answer Interpretation hooks / MemoryKv / fake-IndexedDB. No live OpenRouter.
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";
import { testSessionState } from "./fixtures/intake-r6-session";
import { withDeterministicHandleHooks } from "./fixtures/test-answer-interpretation-hook";

installIntakeR6TestGlobals("dev_di2_understanding_ai_context");
Object.defineProperty(globalThis, "requestAnimationFrame", {
  value: (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 0),
  configurable: true,
  writable: true,
});

const NOW = "2026-11-19T08:00:00.000Z";
const OPTION_ROLE = "v1/dir/DIR-OPT-ON-TABLE/role/option";

let passed = 0;
let failed = 0;

async function check(label: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${label}`);
  } catch (e) {
    failed += 1;
    console.error(`  FAIL  ${label}`);
    console.error(e);
  }
}

function fact(input: {
  fact_id: string;
  statement: string;
  status: "confirmed" | "unverified" | "unknown" | "declined";
  dir_id: string;
  role: string;
  user_confirmed?: boolean;
}) {
  return {
    fact_id: input.fact_id,
    statement: input.statement,
    status: input.status,
    verification_level: "user_stated" as const,
    source_stage: "collecting_context",
    source_turn_id: "turn_src",
    user_confirmed: input.user_confirmed ?? input.status === "confirmed",
    fact_roles: [input.role],
    related_dir_ids: [input.dir_id],
  };
}

function dir(input: {
  dir_id: string;
  need: string;
  roles: string[];
  state: "unknown" | "known" | "n_a" | "conflict";
  p5?: boolean;
}) {
  return {
    dir_id: input.dir_id,
    need: input.need,
    why: `Needed for ${input.dir_id}`,
    required_fact_roles: input.roles,
    current_state: input.state,
    partial_satisfaction: false,
    agenda_item_ids: [] as string[],
    id_lifecycle: "active" as const,
    may_affect_p5_ranking: input.p5 ?? true,
  };
}

function legalDraft(statement: string, extras?: Record<string, unknown>) {
  return {
    classification: "clear_answer",
    extracted_items: [
      {
        text: "Stay, leave, or transfer internally",
        semantic_kind: "reality_fact",
        role_hint: null,
        role_code_hint: OPTION_ROLE,
        certainty: "explicit",
        source_quote: statement,
      },
    ],
    unresolved_aspects: [] as string[],
    explanation: "User named options.",
    ...extras,
  };
}

async function main() {
  console.log("DI2 Understanding / Answer Interpretation context alignment");

  const { __resetPojuDbForTests, ensurePojuDbReady } = await import("../lib/db/poju-db");
  const { createPOJUSession, loadPOJUSession, savePOJUSession } = await import(
    "../lib/poju/session-manager"
  );
  const { handleUserMessage: handleUserMessageRaw } = await import("../lib/poju/agent");
  const handleUserMessage: typeof handleUserMessageRaw = (input) =>
    handleUserMessageRaw(withDeterministicHandleHooks(input));
  const { ensureDecisionBlueprint } = await import("../lib/poju/decision-intake/blueprint");
  const { buildUnderstandingState, refreshDecisionUnderstanding } = await import(
    "../lib/poju/decision-intake/understanding-state"
  );
  const { assertQuestionMatchesPlan } = await import(
    "../lib/poju/decision-intake/question-generation"
  );
  const {
    buildModelInterpretationContext,
    parseAndValidateModelAnswerDraft,
    interpretAnswerWithModel,
  } = await import("../lib/poju/decision-intake/answer-interpretation-model");
  const { projectDecisionUnderstandingBox, projectAdaptiveQuestionForUi } = await import(
    "../lib/poju/decision-intake/ui-projection"
  );
  const { runAdaptiveQuestionTurn } = await import("../lib/poju/decision-intake/adaptive-turn");
  const { createInitialAgentState } = await import("../lib/poju/agent-state");
  const { createDefaultControlPlane } = await import("../lib/poju/decision-context/control-plane");
  type POJUSessionState = import("../lib/poju/types").POJUSessionState;
  type DecisionContext = import("../lib/poju/decision-context/types").DecisionContext;
  type AdaptiveQuestionPlan = import("../lib/poju/decision-intake/types").AdaptiveQuestionPlan;
  type DecisionBlueprint = import("../lib/poju/decision-intake/types").DecisionBlueprint;
  type UnderstandingState = import("../lib/poju/decision-intake/types").UnderstandingState;
  type ModelInterpretationContext =
    import("../lib/poju/decision-intake/answer-interpretation-model").ModelInterpretationContext;

  await __resetPojuDbForTests();
  await ensurePojuDbReady();

  function draftDc(dirs: DecisionContext["dirs"], extras?: Partial<DecisionContext>): DecisionContext {
    return {
      context_id: "dc_ai_ctx",
      version: 3,
      status: "draft",
      definition: {
        concrete_event: "Career fork",
        stakes: "Income + family",
        desired_outcome: null,
        decision_question: "Should I leave my job?",
        goal_priorities: [],
        unacceptable_outcomes: [],
      },
      reality_facts: extras?.reality_facts ?? [],
      constraints: extras?.constraints ?? [],
      hypotheses: extras?.hypotheses ?? [],
      dirs,
      conflicts: extras?.conflicts ?? [],
      content_hash: null,
      created_at: NOW,
      updated_at: NOW,
    };
  }

  function sessionWithDc(dc: DecisionContext): { session: POJUSessionState; blueprint: DecisionBlueprint } {
    const agent = createInitialAgentState({ original_question: "Should I leave my job?" });
    agent.current_phase = "collecting_context";
    const withBp = ensureDecisionBlueprint(
      testSessionState("sess_ai_ctx", NOW, {
        original_question: "Should I leave my job?",
        has_profile: true,
        agent_v2: agent,
        control_plane: createDefaultControlPlane("collecting_context"),
        decision_context: dc,
      }),
      { now: NOW },
    );
    assert.ok(withBp.session.decision_blueprint, "blueprint required");
    return { session: withBp.session, blueprint: withBp.session.decision_blueprint! };
  }

  function planShell(blueprint: DecisionBlueprint, overrides?: Partial<AdaptiveQuestionPlan>): AdaptiveQuestionPlan {
    const direction = blueprint.directions[0];
    assert.ok(direction, "blueprint direction required");
    const dirId = direction.dir_ids[0] ?? blueprint.dir_ids[0] ?? "DIR-OPT-ON-TABLE";
    return {
      plan_id: "qp_ai_ctx",
      candidate_id: "cand_ai_ctx",
      direction_id: direction.direction_id,
      ddr_ids: blueprint.ddr_ids?.length ? [blueprint.ddr_ids[0]!] : ["DDR-TEST"],
      dir_ids: [dirId],
      fact_role_codes: [OPTION_ROLE],
      missing_info: "unknown",
      decision_value: "decision_critical",
      ask_now_reason: "test",
      expected_info: "options",
      depth: 1,
      budget_cost: 1,
      remaining_hard_budget: 15,
      gate_class: "P0",
      scope_boundary: "Only Blueprint DIR/DDR; no model scope expansion",
      rationale: "test",
      question_text: "关于「Should I leave my job?」——有哪些真实可选方案（不要只重复决策目标）？",
      built_at: NOW,
      scoring_path: "test",
      ...overrides,
    };
  }

  function attachUnderstanding(
    session: POJUSessionState,
    blueprint: DecisionBlueprint,
    plan?: AdaptiveQuestionPlan,
  ): POJUSessionState {
    const understanding = buildUnderstandingState({
      session,
      blueprint,
      now: NOW,
      last_answer_event_id: session.decision_understanding?.last_answer_event_id ?? "evt_prev",
    });
    const usedPlan = plan ?? planShell(blueprint);
    const withU: POJUSessionState = {
      ...session,
      decision_understanding: {
        ...understanding,
        last_sent_question: {
          question_text: usedPlan.question_text,
          plan_id: usedPlan.plan_id,
          direction_id: usedPlan.direction_id,
          dir_ids: usedPlan.dir_ids,
          ddr_ids: usedPlan.ddr_ids,
          fact_role_codes: usedPlan.fact_role_codes,
          turn_id: "turn_last",
          conflict_clarification: null,
        },
        next_question_plan: usedPlan,
      },
      adaptive_ask_plan: usedPlan,
    };
    return refreshDecisionUnderstanding(withU, { now: NOW, last_answer_event_id: "evt_prev" });
  }

  const requiredUnderstandingKeys: Array<keyof UnderstandingState> = [
    "current_understanding",
    "understood",
    "answered_pending_confirmation",
    "need_to_understand",
    "personal_pattern_insight",
    "readiness",
    "readiness_progress",
    "budget",
    "last_answer_event_id",
    "last_sent_question",
    "understanding_id",
    "context_id",
    "context_version",
    "blueprint_version",
  ];

  function assertCompleteUnderstanding(
    context: ModelInterpretationContext,
    session: POJUSessionState,
  ) {
    const u = session.decision_understanding;
    assert.ok(u, "session must have decision_understanding");
    assert.ok(context.understanding, "model context must include complete Understanding");
    assert.notEqual(context.understanding, u, "context understanding must be a copy, not the same object");
    for (const key of requiredUnderstandingKeys) {
      assert.ok(key in context.understanding!, `context.understanding missing ${key}`);
    }
    assert.equal(context.understanding_id, u!.understanding_id);
    assert.equal(context.context_id, u!.context_id);
    assert.equal(context.context_version, u!.context_version);
    assert.equal(context.blueprint_version, u!.blueprint_version);
    assert.deepEqual(context.understanding!.current_understanding, u!.current_understanding);
    assert.deepEqual(context.understanding!.understood, u!.understood);
    assert.deepEqual(
      context.understanding!.answered_pending_confirmation,
      u!.answered_pending_confirmation,
    );
    assert.deepEqual(context.understanding!.need_to_understand, u!.need_to_understand);
    assert.deepEqual(context.understanding!.personal_pattern_insight, u!.personal_pattern_insight);
    assert.deepEqual(context.understanding!.readiness, u!.readiness);
    assert.deepEqual(context.understanding!.readiness_progress, u!.readiness_progress);
    assert.deepEqual(context.understanding!.budget, u!.budget);
    assert.equal(context.understanding!.last_answer_event_id, u!.last_answer_event_id);
    assert.deepEqual(context.understanding!.last_sent_question, u!.last_sent_question);
    assert.equal(
      context.last_sent_question?.question_text,
      u!.last_sent_question?.question_text,
    );
  }

  const mixedSessionBase = () => {
    const { session, blueprint } = sessionWithDc(
      draftDc(
        [
          dir({ dir_id: "DIR-OPT-ON-TABLE", need: "Options on the table", roles: ["option"], state: "known" }),
          dir({ dir_id: "DIR-STATUS-QUO", need: "Status quo cost", roles: ["status_quo"], state: "n_a" }),
          dir({ dir_id: "DIR-OPT-CONSTRAINTS", need: "Hard constraints", roles: ["hard_constraint"], state: "unknown" }),
          dir({ dir_id: "DIR-RISK-TOLERANCE", need: "Risk tolerance", roles: ["risk_tolerance"], state: "conflict" }),
        ],
        {
          reality_facts: [
            fact({
              fact_id: "f_opt",
              statement: "Latest confirmed option set: stay or leave",
              status: "confirmed",
              dir_id: "DIR-OPT-ON-TABLE",
              role: "option",
              user_confirmed: true,
            }),
            fact({
              fact_id: "f_sq",
              statement: "Status quo is not applicable",
              status: "confirmed",
              dir_id: "DIR-STATUS-QUO",
              role: "status_quo",
              user_confirmed: true,
            }),
            fact({
              fact_id: "f_risk_a",
              statement: "Can take a one-year pay cut",
              status: "unverified",
              dir_id: "DIR-RISK-TOLERANCE",
              role: "risk_tolerance",
            }),
            fact({
              fact_id: "f_risk_b",
              statement: "Cannot take any pay cut",
              status: "unverified",
              dir_id: "DIR-RISK-TOLERANCE",
              role: "risk_tolerance",
            }),
            fact({
              fact_id: "f_declined",
              statement: "Prefers not to discuss stakeholders",
              status: "declined",
              dir_id: "DIR-STAKEHOLDERS",
              role: "stakeholder",
            }),
            fact({
              fact_id: "f_unknown",
              statement: "Hard constraints are still unknown",
              status: "unknown",
              dir_id: "DIR-OPT-CONSTRAINTS",
              role: "hard_constraint",
            }),
          ],
          hypotheses: [
            {
              hypothesis_id: "h_motive",
              statement: "Maybe the user wants more status",
              status: "open",
            } as DecisionContext["hypotheses"][number],
          ],
          conflicts: [
            {
              conflict_id: "c_risk",
              conflict_field: "risk_tolerance",
              fact_ids: ["f_risk_a", "f_risk_b"],
              state: "open",
              statements_snapshot: [
                "Can take a one-year pay cut",
                "Cannot take any pay cut",
              ],
            },
          ],
        },
      ),
    );
    return { session: attachUnderstanding(session, blueprint), blueprint };
  };

  await check("1. model call receives complete Understanding State, not only last_sent_question", async () => {
    const { session } = mixedSessionBase();
    let captured: ModelInterpretationContext | null = null;
    const result = await interpretAnswerWithModel({
      session,
      statement: "还有内部转岗一条路。",
      source_turn_id: "turn_full_u",
      locale: "zh",
      testHook: (input) => {
        captured = input.context;
        return legalDraft(input.statement);
      },
    });
    assert.equal(result.ok, true);
    assert.ok(captured);
    assertCompleteUnderstanding(captured!, session);
    assert.ok(captured!.last_sent_question?.question_text);
    assert.notEqual(
      Object.keys(captured!),
      ["last_sent_question"],
      "context must not be last_sent_question only",
    );
    assert.ok(
      captured!.related_reality_facts.some((f) => f.statement.includes("Latest confirmed option set")),
      "question-scoped DC fact context must still be present",
    );
    assert.ok(captured!.authorized.fact_role_codes.includes(OPTION_ROLE));
    assert.equal(captured!.user_answer.includes("内部转岗"), true);
    assert.equal(captured!.locale, "zh");
  });

  await check("2. UI projection and model context come from the same session.decision_understanding", async () => {
    const { session } = mixedSessionBase();
    const context = buildModelInterpretationContext({
      session,
      statement: "还有内部转岗一条路。",
      locale: "zh",
    });
    assertCompleteUnderstanding(context, session);
    const box = projectDecisionUnderstandingBox(session);
    const ui = projectAdaptiveQuestionForUi(session);
    const u = session.decision_understanding!;
    assert.equal(box.current_understanding, u.current_understanding.summary);
    assert.equal(ui.understanding_summary, u.current_understanding.summary);
    assert.equal(box.current_question, u.last_sent_question?.question_text);
    assert.equal(ui.current_question, u.last_sent_question?.question_text);
    assert.equal(ui.readiness_verdict, u.readiness.verdict);
    assert.equal(ui.readiness_can_ask, u.readiness.can_ask);
    assert.equal(ui.budget_asked, u.budget.session_asked_count);
    assert.equal(ui.budget_hard, u.budget.hard_budget_limit);
    assert.equal(ui.readiness_progress_percent, u.readiness_progress?.percent ?? null);
    assert.equal(ui.personal_pattern_status, u.personal_pattern_insight.status);
    assert.deepEqual(
      ui.need_labels,
      u.need_to_understand.items.map((i) => (i.kind === "dir_based" ? i.missing_content : i.why)),
    );
  });

  await check("3. Understanding fields are not dropped when assembling model context", async () => {
    const { session } = mixedSessionBase();
    const context = buildModelInterpretationContext({
      session,
      statement: "还有内部转岗一条路。",
      locale: "zh",
    });
    assertCompleteUnderstanding(context, session);
    const u = session.decision_understanding!;
    const copy = context.understanding!;
    for (const key of Object.keys(u) as Array<keyof UnderstandingState>) {
      assert.ok(key in copy, `dropped Understanding field: ${String(key)}`);
      assert.deepEqual(copy[key], u[key], `Understanding field changed: ${String(key)}`);
    }
  });

  await check("4. model cannot turn a hypothesis into a confirmed fact", async () => {
    const { session } = mixedSessionBase();
    const beforeHypotheses = JSON.parse(JSON.stringify(session.decision_context?.hypotheses ?? []));
    const beforeVersion = session.decision_context!.version;
    const statement = "还有内部转岗一条路。";
    const turn = await runAdaptiveQuestionTurn({
      session,
      statement,
      source_turn_id: "turn_hyp",
      now: NOW,
      test_hooks: {
        interpretAnswerModel: () => ({
          ...legalDraft(statement, {
            user_confirmed: true,
            confirmed: true,
            status: "confirmed",
            verification_level: "user_asserted",
            hypothesis_id: "h_motive",
          }),
        }),
      },
    });
    assert.notEqual(turn.outcome, "answer_interpretation_failed");
    const facts = turn.session.decision_context?.reality_facts ?? [];
    const written = facts.filter((f) => f.source_turn_id === "turn_hyp");
    for (const row of written) {
      assert.notEqual(row.status, "confirmed", "model must not write confirmed facts");
      assert.equal(row.user_confirmed, false, "model must not mark user_confirmed");
    }
    assert.deepEqual(turn.session.decision_context?.hypotheses ?? [], beforeHypotheses);
    const hypothesisStillOpen = (turn.session.decision_context?.hypotheses ?? []).some(
      (h) => "hypothesis_id" in h && (h as { hypothesis_id?: string }).hypothesis_id === "h_motive",
    );
    assert.equal(hypothesisStillOpen, true, "hypothesis record must remain");
    if (turn.session.decision_context!.version !== beforeVersion) {
      assert.ok(written.every((f) => f.status === "unverified" || f.status === "unknown" || f.status === "declined"));
    }
  });

  await check("5. model cannot modify Readiness, Scope, Budget, or Freeze", async () => {
    const { session } = mixedSessionBase();
    const before = {
      readiness: JSON.parse(JSON.stringify(session.decision_understanding!.readiness)),
      budget_hard: session.decision_understanding!.budget.hard_budget_limit,
      budget_soft: session.decision_understanding!.budget.soft_budget_limit,
      dir_ids: [...(session.decision_blueprint?.dir_ids ?? [])],
      receipts: [...(session.dc_freeze_receipts ?? [])],
      jobs: [...(session.freeze_bound_report_jobs ?? [])],
    };
    const statement = "还有内部转岗一条路。";
    let mutatedCopy = false;
    const turn = await runAdaptiveQuestionTurn({
      session,
      statement,
      source_turn_id: "turn_auth",
      now: NOW,
      test_hooks: {
        interpretAnswerModel: (input) => {
          if (input.context.understanding) {
            input.context.understanding.readiness.verdict = "ready_for_final_confirm";
            input.context.understanding.readiness.can_ask = false;
            input.context.understanding.budget.hard_budget_limit = 0;
            mutatedCopy = true;
          }
          return legalDraft(statement, {
            readiness: { verdict: "ready_for_final_confirm", can_ask: false, reasons: ["model"] },
            freeze: true,
            freeze_state: "frozen",
            budget: { hard_budget_limit: 0, soft_budget_limit: 0 },
            question_budget: { hard: 0, soft: 0 },
            blueprint_scope: { dir_ids: ["DIR-INVENTED"] },
            next_question_plan: { question_text: "MODEL SHOULD NOT CHOOSE THIS" },
          });
        },
      },
    });
    assert.equal(mutatedCopy, true);
    assert.equal(session.decision_understanding!.readiness.verdict, before.readiness.verdict);
    assert.equal(session.decision_understanding!.budget.hard_budget_limit, before.budget_hard);
    const after = turn.session;
    assert.deepEqual(after.decision_blueprint?.dir_ids ?? [], before.dir_ids, "Blueprint scope must not expand");
    assert.equal(after.decision_understanding?.budget.hard_budget_limit, before.budget_hard);
    assert.equal(after.decision_understanding?.budget.soft_budget_limit, before.budget_soft);
    assert.notEqual(after.decision_understanding?.readiness.verdict, undefined);
    assert.equal((after.dc_freeze_receipts ?? []).length, before.receipts.length);
    assert.equal((after.freeze_bound_report_jobs ?? []).length, before.jobs.length);
    assert.notEqual(after.decision_context?.status, "final");
    if (turn.authorized_question) {
      assert.notEqual(turn.authorized_question, "MODEL SHOULD NOT CHOOSE THIS");
    }
  });

  await check("6. confirmed, unknown, n_a, declined, and conflict stay distinct in model context", async () => {
    // Career blueprint seeds four DIRs. Use them to keep statuses distinct:
    // known / n_a → understood; unanswered → need(unknown); conflict → need(conflict);
    // unknown/declined answers → answered_pending_confirmation (not collapsed into known).
    const { session: base, blueprint } = sessionWithDc(
      draftDc(
        [
          dir({ dir_id: "DIR-OPT-ON-TABLE", need: "Options on the table", roles: ["option"], state: "known" }),
          dir({ dir_id: "DIR-STATUS-QUO", need: "Status quo cost", roles: ["status_quo"], state: "n_a" }),
          dir({ dir_id: "DIR-OPT-CONSTRAINTS", need: "Hard constraints", roles: ["hard_constraint"], state: "unknown" }),
          dir({ dir_id: "DIR-RISK-TOLERANCE", need: "Risk tolerance", roles: ["risk_tolerance"], state: "conflict" }),
          dir({ dir_id: "DIR-STAKEHOLDERS", need: "Stakeholders", roles: ["stakeholder"], state: "unknown" }),
        ],
        {
          reality_facts: [
            fact({
              fact_id: "f_opt",
              statement: "Latest confirmed option set: stay or leave",
              status: "confirmed",
              dir_id: "DIR-OPT-ON-TABLE",
              role: "option",
              user_confirmed: true,
            }),
            fact({
              fact_id: "f_sq",
              statement: "Status quo is not applicable",
              status: "confirmed",
              dir_id: "DIR-STATUS-QUO",
              role: "status_quo",
              user_confirmed: true,
            }),
            fact({
              fact_id: "f_risk_a",
              statement: "Can take a one-year pay cut",
              status: "unverified",
              dir_id: "DIR-RISK-TOLERANCE",
              role: "risk_tolerance",
            }),
            fact({
              fact_id: "f_risk_b",
              statement: "Cannot take any pay cut",
              status: "unverified",
              dir_id: "DIR-RISK-TOLERANCE",
              role: "risk_tolerance",
            }),
            fact({
              fact_id: "f_declined",
              statement: "Prefers not to discuss stakeholders",
              status: "declined",
              dir_id: "DIR-STAKEHOLDERS",
              role: "stakeholder",
            }),
            fact({
              fact_id: "f_unknown_answer",
              statement: "User said hard constraints are unknown for now",
              status: "unknown",
              dir_id: "DIR-OPT-CONSTRAINTS",
              role: "hard_constraint",
            }),
          ],
          conflicts: [
            {
              conflict_id: "c_risk",
              conflict_field: "risk_tolerance",
              fact_ids: ["f_risk_a", "f_risk_b"],
              state: "open",
              statements_snapshot: [
                "Can take a one-year pay cut",
                "Cannot take any pay cut",
              ],
            },
          ],
        },
      ),
    );
    // Include DIR-STAKEHOLDERS so declined answers can surface in Understanding.
    const stakeholderDirection = {
      direction_id: "dir_stakeholders_test",
      label: "Stakeholders",
      needed_info: "Who is affected",
      completion_criteria: "Stakeholder impact is known or declined",
      depth_soft_cap: 1,
      scope_boundary: "People affected by the decision",
      priority: "P2" as const,
      dir_ids: ["DIR-STAKEHOLDERS"],
    };
    const patchedBp: DecisionBlueprint = {
      ...blueprint,
      dir_ids: Array.from(new Set([...blueprint.dir_ids, "DIR-STAKEHOLDERS"])),
      directions: blueprint.directions.some((d) => d.dir_ids.includes("DIR-STAKEHOLDERS"))
        ? blueprint.directions
        : [...blueprint.directions, stakeholderDirection],
    };
    const session = attachUnderstanding(
      { ...base, decision_blueprint: patchedBp },
      patchedBp,
    );
    const context = buildModelInterpretationContext({
      session,
      statement: "还有内部转岗一条路。",
      locale: "zh",
    });
    const u = context.understanding!;
    const understoodById = new Map(u.understood.items.map((i) => [i.dir_id, i]));
    const answeredById = new Map(
      (u.answered_pending_confirmation?.items ?? []).map((i) => [i.dir_id, i]),
    );
    const needs = new Map(
      u.need_to_understand.items
        .filter((i): i is Extract<typeof i, { kind: "dir_based" }> => i.kind === "dir_based")
        .map((i) => [i.dir_id, i]),
    );
    assert.equal(understoodById.get("DIR-OPT-ON-TABLE")?.status, "known");
    assert.equal(understoodById.get("DIR-STATUS-QUO")?.status, "n_a");
    assert.equal(needs.has("DIR-OPT-ON-TABLE"), false);
    assert.equal(needs.has("DIR-STATUS-QUO"), false);
    assert.ok(
      answeredById.get("DIR-OPT-CONSTRAINTS")?.answer_statuses.includes("unknown"),
      "status=unknown answer must stay answered_pending, not collapse into known/need",
    );
    assert.equal(needs.has("DIR-OPT-CONSTRAINTS"), false);
    assert.ok(
      answeredById.get("DIR-STAKEHOLDERS")?.answer_statuses.includes("declined"),
      "declined answer must stay answered_pending and distinct from unknown/conflict",
    );
    assert.equal(needs.get("DIR-RISK-TOLERANCE")?.gap_type, "conflict");
    assert.notEqual(needs.get("DIR-RISK-TOLERANCE")?.gap_type, "unknown");
    assert.notEqual(needs.get("DIR-RISK-TOLERANCE")?.gap_type, "declined");
    // Unanswered open DIRs (if any remain outside answered/understood) keep gap_type unknown.
    for (const [dirId, need] of needs) {
      if (dirId === "DIR-RISK-TOLERANCE") continue;
      assert.equal(need.gap_type, "unknown", `${dirId} unanswered need must stay unknown`);
    }
    const factStatus = new Map(
      context.related_reality_facts.map((f) => [f.fact_id, f.status]),
    );
    if (factStatus.has("f_opt")) assert.equal(factStatus.get("f_opt"), "confirmed");
    if (factStatus.has("f_unknown_answer")) assert.equal(factStatus.get("f_unknown_answer"), "unknown");
    if (factStatus.has("f_declined")) assert.equal(factStatus.get("f_declined"), "declined");
    assert.notEqual(
      answeredById.get("DIR-OPT-CONSTRAINTS")?.answer_statuses.join(","),
      answeredById.get("DIR-STAKEHOLDERS")?.answer_statuses.join(","),
    );
  });

  await check("7. model timeout, invalid JSON, and invalid schema still fail closed", async () => {
    const invalidJson = parseAndValidateModelAnswerDraft("not-json");
    assert.equal(invalidJson.ok, false);
    if (!invalidJson.ok) assert.equal(invalidJson.reason, "invalid_json");
    const invalidSchema = parseAndValidateModelAnswerDraft({ hello: "world" });
    assert.equal(invalidSchema.ok, false);
    if (!invalidSchema.ok) assert.equal(invalidSchema.reason, "invalid_schema");

    const { session: timeoutSession } = mixedSessionBase();
    const timeout = await interpretAnswerWithModel({
      session: timeoutSession,
      statement: "还有内部转岗一条路。",
      source_turn_id: "turn_timeout",
      testHook: async () => {
        throw new Error("llm_timeout: wall exceeded");
      },
    });
    assert.equal(timeout.ok, false);
    if (!timeout.ok) assert.equal(timeout.reason, "timeout");

    for (const [label, hook] of [
      [
        "timeout",
        async () => {
          throw new Error("llm_timeout: wall exceeded");
        },
      ],
      ["invalid_json", async () => "not-json"],
      ["invalid_schema", async () => ({ hello: "world" })],
    ] as const) {
      const { session } = mixedSessionBase();
      const beforeVersion = session.decision_context!.version;
      const beforeFacts = session.decision_context!.reality_facts.length;
      const turn = await runAdaptiveQuestionTurn({
        session,
        statement: "还有内部转岗一条路。",
        source_turn_id: `turn_fail_${label}`,
        now: NOW,
        test_hooks: { interpretAnswerModel: hook },
      });
      assert.ok(
        turn.outcome === "answer_interpretation_failed" ||
          turn.outcome === "answer_interpretation_invalid_schema",
        `${label} must fail closed, got ${turn.outcome}`,
      );
      assert.equal(turn.authorized_question, null);
      assert.equal(turn.answer_event, null);
      assert.equal(turn.session.decision_context!.version, beforeVersion, `${label} must not write DC`);
      assert.equal(turn.session.decision_context!.reality_facts.length, beforeFacts);
    }
  });

  await check("8. context-version mismatch does not write DC", async () => {
    const { session } = mixedSessionBase();
    const beforeVersion = session.decision_context!.version;
    const beforeFacts = [...session.decision_context!.reality_facts];
    const statement = "还有内部转岗一条路。";
    const turn = await runAdaptiveQuestionTurn({
      session,
      statement,
      source_turn_id: "turn_mismatch",
      now: NOW,
      test_hooks: {
        interpretAnswerModel: (input) => {
          if (input.session.decision_context) {
            input.session.decision_context = {
              ...input.session.decision_context,
              version: input.session.decision_context.version + 99,
            };
          }
          if (input.session.decision_understanding) {
            input.session.decision_understanding = {
              ...input.session.decision_understanding,
              understanding_id: "u_tampered",
              context_version: 999,
            };
          }
          return legalDraft(statement);
        },
      },
    });
    assert.equal(turn.outcome, "answer_interpretation_failed");
    assert.match(turn.ask_error ?? "", /context_version_mismatch/);
    assert.equal(turn.answer_event, null);
    assert.equal(turn.authorized_question, null);
    // fail-closed session is the raw-answer record only, not the hook-mutated session
    const dc = turn.session.decision_context!;
    assert.equal(dc.version, beforeVersion);
    assert.equal(dc.reality_facts.length, beforeFacts.length);
    assert.deepEqual(
      dc.reality_facts.map((f) => f.fact_id),
      beforeFacts.map((f) => f.fact_id),
    );
  });

  await check("9. final question equals the server-validated plan.question_text", async () => {
    const fetchCalls: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      fetchCalls.push(url);
      return new Response(
        JSON.stringify({
          response: "MODEL FREEFORM QUESTION THAT MUST NEVER REACH THE USER",
          collection_progress: "advancing",
          question_status: "asked",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };
    try {
      const sid = await createPOJUSession({
        payment_id: "pay_di2_ai_ctx_01",
        original_question: "要不要离职去创业？",
      });
      const before = await loadPOJUSession(sid);
      assert.ok(before);
      fetchCalls.length = 0;
      const out = await handleUserMessage({
        session: before!,
        userMessage: "我在犹豫要不要离职去创业，家里还有贷款。",
        locale: "zh",
      });
      await savePOJUSession(out);
      const after = await loadPOJUSession(sid);
      assert.ok(after?.adaptive_ask_plan?.question_text);
      const asst = [...after!.messages].reverse().find((m) => m.role === "assistant");
      assert.ok(asst);
      assert.equal(asst!.content, after!.adaptive_ask_plan!.question_text);
      const matched = assertQuestionMatchesPlan(asst!.content, after!.adaptive_ask_plan!);
      assert.equal(matched.ok, true);
      assert.equal(matched.text, after!.adaptive_ask_plan!.question_text);
      assert.equal(
        after!.decision_understanding?.last_sent_question?.question_text,
        after!.adaptive_ask_plan!.question_text,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await check("10. authorized question and Readiness confirm still skip the generic Chat LLM", async () => {
    const src = readFileSync(join(process.cwd(), "lib/poju/agent.ts"), "utf8");
    const early = src.indexOf("m1_skipped_generic_chat_llm");
    const llm = src.indexOf("const llmResponse = input.server_invoke");
    assert.ok(early > 0, "early-return skip flag must exist");
    assert.ok(llm > early, "generic Chat LLM call must come after the M1 early return");

    const fetchCalls: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      fetchCalls.push(url);
      return new Response(
        JSON.stringify({
          response: "MODEL FREEFORM QUESTION THAT MUST NEVER REACH THE USER",
          collection_progress: "advancing",
          question_status: "asked",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };
    try {
      const sid = await createPOJUSession({
        payment_id: "pay_di2_ai_ctx_02",
        original_question: "要不要离职去创业？",
      });
      const before = await loadPOJUSession(sid);
      fetchCalls.length = 0;
      const out = await handleUserMessage({
        session: before!,
        userMessage: "我在犹豫要不要离职去创业，家里还有贷款。",
        locale: "zh",
      });
      const asst = [...out.messages].reverse().find((m) => m.role === "assistant");
      assert.ok(asst);
      assert.equal(asst!.meta?.m1_skipped_generic_chat_llm, true);
      assert.equal(asst!.meta?.m1_authorized_question, true);
      assert.equal(
        fetchCalls.some((u) => u.includes("/api/poju/chat")),
        false,
        "authorized question must not call generic Chat LLM",
      );
      assert.equal(asst!.content.includes("MODEL FREEFORM"), false);

      const { session, blueprint } = sessionWithDc(
        draftDc(
          [
            dir({ dir_id: "DIR-OPT-ON-TABLE", need: "Options on the table", roles: ["option"], state: "known" }),
            dir({ dir_id: "DIR-STATUS-QUO", need: "Status quo cost", roles: ["status_quo"], state: "known" }),
            dir({ dir_id: "DIR-OPT-CONSTRAINTS", need: "Hard constraints", roles: ["hard_constraint"], state: "known" }),
            dir({ dir_id: "DIR-RISK-TOLERANCE", need: "Risk tolerance", roles: ["risk_tolerance"], state: "known" }),
          ],
          {
            reality_facts: [
              fact({ fact_id: "f1", statement: "Stay or leave", status: "confirmed", dir_id: "DIR-OPT-ON-TABLE", role: "option", user_confirmed: true }),
              fact({ fact_id: "f2", statement: "Status quo is stagnant", status: "confirmed", dir_id: "DIR-STATUS-QUO", role: "status_quo", user_confirmed: true }),
              fact({ fact_id: "f3", statement: "Six months of savings", status: "confirmed", dir_id: "DIR-OPT-CONSTRAINTS", role: "hard_constraint", user_confirmed: true }),
              fact({ fact_id: "f4", statement: "Can accept one year of lower pay", status: "confirmed", dir_id: "DIR-RISK-TOLERANCE", role: "risk_tolerance", user_confirmed: true }),
            ],
          },
        ),
      );
      const allowed = new Set(["DIR-OPT-ON-TABLE", "DIR-STATUS-QUO", "DIR-OPT-CONSTRAINTS", "DIR-RISK-TOLERANCE"]);
      const readySid = await createPOJUSession({
        payment_id: "pay_di2_ai_ctx_ready",
        original_question: "Should I leave my job?",
      });
      const readyBase = await loadPOJUSession(readySid);
      assert.ok(readyBase);
      const trimmedBp = {
        ...blueprint,
        session_id: readySid,
        context_id: session.decision_context!.context_id,
        dir_ids: [...allowed].filter((id) => blueprint.dir_ids.includes(id)),
        directions: blueprint.directions
          .map((d) => ({ ...d, dir_ids: d.dir_ids.filter((id) => allowed.has(id)) }))
          .filter((d) => d.dir_ids.length > 0),
      };
      const trimmed: POJUSessionState = attachUnderstanding(
        {
          ...readyBase!,
          ...session,
          session_id: readySid,
          device_id: readyBase!.device_id,
          created_at: readyBase!.created_at,
          expires_at: readyBase!.expires_at,
          last_interaction_at: new Date().toISOString(),
          messages: readyBase!.messages,
          agent_v2: {
            ...(session.agent_v2 ?? readyBase!.agent_v2!),
            current_phase: "collecting_context",
          },
          decision_context: {
            ...session.decision_context!,
            // Legal ledger combo for a readiness-stop fixture: known DIRs with
            // user_asserted+unverified facts (confirmed×user_stated is illegal).
            reality_facts: [
              {
                fact_id: "f1",
                statement: "Stay or leave",
                status: "unverified" as const,
                verification_level: "user_asserted" as const,
                source_stage: "collecting_context",
                source_turn_id: "turn_ready_f1",
                user_confirmed: false,
                fact_roles: ["option"],
                related_dir_ids: ["DIR-OPT-ON-TABLE"],
              },
              {
                fact_id: "f2",
                statement: "Status quo is stagnant",
                status: "unverified" as const,
                verification_level: "user_asserted" as const,
                source_stage: "collecting_context",
                source_turn_id: "turn_ready_f2",
                user_confirmed: false,
                fact_roles: ["status_quo"],
                related_dir_ids: ["DIR-STATUS-QUO"],
              },
              {
                fact_id: "f3",
                statement: "Six months of savings",
                status: "unverified" as const,
                verification_level: "user_asserted" as const,
                source_stage: "collecting_context",
                source_turn_id: "turn_ready_f3",
                user_confirmed: false,
                fact_roles: ["hard_constraint"],
                related_dir_ids: ["DIR-OPT-CONSTRAINTS"],
              },
              {
                fact_id: "f4",
                statement: "Can accept one year of lower pay",
                status: "unverified" as const,
                verification_level: "user_asserted" as const,
                source_stage: "collecting_context",
                source_turn_id: "turn_ready_f4",
                user_confirmed: false,
                fact_roles: ["risk_tolerance"],
                related_dir_ids: ["DIR-RISK-TOLERANCE"],
              },
            ],
            dirs: session.decision_context!.dirs.map((d) =>
              allowed.has(d.dir_id)
                ? { ...d, current_state: "known" as const, partial_satisfaction: false }
                : { ...d, id_lifecycle: "deprecated" as const, current_state: "n_a" as const },
            ),
            conflicts: [],
          },
          decision_blueprint: trimmedBp,
        },
        trimmedBp,
      );
      assert.equal(trimmed.decision_understanding?.readiness.can_ask, false);
      await savePOJUSession(trimmed);
      fetchCalls.length = 0;
      const readyOut = await handleUserMessage({
        session: trimmed,
        userMessage: "那就确认以上理解吧。",
        locale: "zh",
      });
      const readyAsst = [...readyOut.messages].reverse().find((m) => m.role === "assistant");
      assert.ok(readyAsst);
      assert.notEqual(readyAsst!.meta?.m1_fail_closed, true, "ready path must not fail-closed on persist");
      assert.notEqual(
        readyAsst!.meta?.di2_input_rejection,
        "session_expired",
        "ready session must not be rejected as expired",
      );
      assert.equal(readyAsst!.meta?.m1_skipped_generic_chat_llm, true);
      assert.equal(readyAsst!.meta?.m21_readiness_stop, true);
      assert.equal(
        fetchCalls.some((u) => u.includes("/api/poju/chat")),
        false,
        "Readiness confirm must not call generic Chat LLM",
      );
      assert.equal(readyAsst!.content.includes("MODEL FREEFORM"), false);
      assert.match(readyAsst!.content, /理解确认/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
