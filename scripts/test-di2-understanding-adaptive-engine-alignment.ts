/**
 * DI2 Phase 2 pre-verification — Understanding vs Adaptive Question Engine duties.
 *
 *   pnpm exec tsx scripts/test-di2-understanding-adaptive-engine-alignment.ts
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

installIntakeR6TestGlobals("dev_di2_understanding_engine_align");
Object.defineProperty(globalThis, "requestAnimationFrame", {
  value: (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 0),
  configurable: true,
  writable: true,
});

const NOW = "2026-11-19T07:00:00.000Z";

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
    partial_satisfaction: input.state === "conflict" ? false : false,
    agenda_item_ids: [] as string[],
    id_lifecycle: "active" as const,
    may_affect_p5_ranking: input.p5 ?? true,
  };
}

async function main() {
  console.log("DI2 Understanding / Adaptive Question Engine alignment");

  const { __resetPojuDbForTests, ensurePojuDbReady } = await import("../lib/db/poju-db");
  const { createPOJUSession, loadPOJUSession, savePOJUSession } = await import(
    "../lib/poju/session-manager"
  );
  const { handleUserMessage: handleUserMessageRaw } = await import("../lib/poju/agent");
  const handleUserMessage: typeof handleUserMessageRaw = (input) =>
    handleUserMessageRaw(withDeterministicHandleHooks(input));
  const { ensureDecisionBlueprint } = await import("../lib/poju/decision-intake/blueprint");
  const { buildUnderstandingState } = await import(
    "../lib/poju/decision-intake/understanding-state"
  );
  const { generateQuestionText, buildAdaptiveQuestionPlan, assertQuestionMatchesPlan } =
    await import("../lib/poju/decision-intake/question-generation");
  const { validateScopeDepthBudget } = await import("../lib/poju/decision-intake/scope-budget");
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
  type RankedPlanningCandidate = import("../lib/poju/decision-context/question-plan-cycle").RankedPlanningCandidate;
  type AdaptiveQuestionPlan = import("../lib/poju/decision-intake/types").AdaptiveQuestionPlan;
  type DecisionBlueprint = import("../lib/poju/decision-intake/types").DecisionBlueprint;
  type SessionBudgetSnapshot = import("../lib/poju/decision-intake/types").SessionBudgetSnapshot;

  await __resetPojuDbForTests();
  await ensurePojuDbReady();

  function draftDc(dirs: DecisionContext["dirs"], extras?: Partial<DecisionContext>): DecisionContext {
    return {
      context_id: "dc_align",
      version: 1,
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
      testSessionState("sess_align", NOW, {
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

  function budget(overrides?: Partial<SessionBudgetSnapshot>): SessionBudgetSnapshot {
    return {
      soft_budget_limit: 12,
      hard_budget_limit: 15,
      session_asked_count: 0,
      review_cycle: 1,
      cycle_base_asked: 0,
      remaining_hard_budget: 15,
      depth_by_dir: {},
      ...overrides,
    };
  }

  function planShell(
    blueprint: DecisionBlueprint,
    overrides?: Partial<AdaptiveQuestionPlan>,
  ): AdaptiveQuestionPlan {
    const direction = blueprint.directions[0];
    assert.ok(direction, "blueprint direction required");
    const dirId = direction.dir_ids[0] ?? blueprint.dir_ids[0];
    return {
      plan_id: "qp_test",
      candidate_id: "cand_test",
      direction_id: direction.direction_id,
      ddr_ids: blueprint.ddr_ids?.length ? [blueprint.ddr_ids[0]!] : ["DDR-TEST"],
      dir_ids: dirId ? [dirId] : [],
      fact_role_codes: ["v1/dir/DIR-OPT-ON-TABLE/role/option"],
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

  function rankedFor(blueprint: DecisionBlueprint, dirId: string, role: string): RankedPlanningCandidate {
    return {
      candidate: {
        candidate_id: `cand_${dirId}_${role}`,
        kind: "dir_based",
        ddr_ids: blueprint.ddr_ids?.length ? [blueprint.ddr_ids[0]!] : ["DDR-TEST"],
        dir_ids: [dirId],
        need_ids: [`need:dc:${dirId}`],
        fact_role_codes: [`v1/dir/${dirId}/role/${role}`],
        missing_info: "unknown",
        decision_value: "decision_critical",
        ask_now_reason: "test",
        expected_info: role,
        impact: {
          affects_option_ranking: true,
          may_affect_p5_ranking: true,
          decision_critical: true,
          gate_class: "P0",
        },
        depth: 1,
        repetition_count: 0,
        budget_cost: 1,
        direction_id: blueprint.directions.find((d) => d.dir_ids.includes(dirId))?.direction_id ?? blueprint.directions[0]!.direction_id,
        blueprint_version: blueprint.blueprint_version,
        id_schema_version: 1,
      },
      score: {
        gap_type: "unknown",
        information_gain_est: 1,
        unresolved_count: 1,
      },
    } as RankedPlanningCandidate;
  }

  await check("static: authorized M1 path returns before generic Chat LLM", async () => {
    const src = readFileSync(join(process.cwd(), "lib/poju/agent.ts"), "utf8");
    const early = src.indexOf("m1_skipped_generic_chat_llm");
    const llm = src.indexOf("const llmResponse = input.server_invoke");
    assert.ok(early > 0, "early-return skip flag must exist");
    assert.ok(llm > early, "generic Chat LLM call must come after the M1 early return");
    assert.match(src, /m1HasAuthorizedQuestion/);
    assert.match(src, /assertQuestionMatchesPlan/);
    assert.match(src, /guardAndAttachAuthorizedQuestion/);
    assert.match(src, /reserveClarificationClaimCas/);
    assert.doesNotMatch(src, /confirmAuthorizedQuestionSend/);
    const gen = readFileSync(
      join(process.cwd(), "lib/poju/decision-intake/question-generation.ts"),
      "utf8",
    );
    assert.equal(/openRouterChatCompletion|callPOJULLM/.test(gen), false);
  });

  await check("Understanding maps unknown/n_a/declined/conflict distinctly and does not re-ask confirmed", async () => {
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
              statement: "Options are stay or leave",
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
    // Add declined DIR after blueprint so it stays in scope if the catalog includes it.
    const dc = session.decision_context!;
    if (!dc.dirs.some((d) => d.dir_id === "DIR-STAKEHOLDERS") && blueprint.dir_ids.includes("DIR-STAKEHOLDERS")) {
      dc.dirs = [
        ...dc.dirs,
        dir({ dir_id: "DIR-STAKEHOLDERS", need: "Stakeholders", roles: ["stakeholder"], state: "unknown" }),
      ];
    }
    const understanding = buildUnderstandingState({ session, blueprint, now: NOW });
    const understoodIds = understanding.understood.items.map((i) => i.dir_id);
    const needIds = understanding.need_to_understand.items
      .filter((i) => i.kind === "dir_based")
      .map((i) => i.dir_id);
    const needById = new Map(
      understanding.need_to_understand.items
        .filter((i): i is Extract<typeof i, { kind: "dir_based" }> => i.kind === "dir_based")
        .map((i) => [i.dir_id, i]),
    );

    assert.ok(understoodIds.includes("DIR-OPT-ON-TABLE"), "confirmed known DIR is Understood");
    assert.equal(needIds.includes("DIR-OPT-ON-TABLE"), false, "confirmed known DIR is not an open need");
    assert.ok(understoodIds.includes("DIR-STATUS-QUO"), "n_a DIR is Understood, not unknown");
    assert.equal(needIds.includes("DIR-STATUS-QUO"), false, "n_a is not re-asked as unknown");

    const constraintNeed = needById.get("DIR-OPT-CONSTRAINTS");
    assert.ok(constraintNeed, "unanswered DIR stays a need");
    assert.equal(constraintNeed!.gap_type, "unknown");

    const conflictNeed = needById.get("DIR-RISK-TOLERANCE");
    assert.ok(conflictNeed, "conflict DIR stays a need");
    assert.equal(conflictNeed!.gap_type, "conflict");
    assert.notEqual(conflictNeed!.gap_type, "unknown");
    assert.notEqual(conflictNeed!.gap_type, "declined");

    const stakeholderNeed = needById.get("DIR-STAKEHOLDERS");
    if (stakeholderNeed) {
      assert.equal(stakeholderNeed.gap_type, "declined");
      assert.notEqual(stakeholderNeed.gap_type, "unknown");
      assert.notEqual(stakeholderNeed.gap_type, "conflict");
    }

    assert.equal(
      understanding.understood.items.find((i) => i.dir_id === "DIR-OPT-ON-TABLE")?.status,
      "known",
    );
    assert.equal(
      understanding.understood.items.find((i) => i.dir_id === "DIR-STATUS-QUO")?.status,
      "n_a",
    );
  });

  await check("server rejects out-of-scope, repeated, and over-budget proposed questions", async () => {
    const { session, blueprint } = sessionWithDc(
      draftDc([
        dir({ dir_id: "DIR-OPT-ON-TABLE", need: "Options on the table", roles: ["option"], state: "unknown" }),
      ]),
    );
    const legal = planShell(blueprint);
    const ok = validateScopeDepthBudget({
      blueprint,
      plan: legal,
      budget: budget(),
    });
    assert.equal(ok.ok, true, "in-scope plan must pass");

    const outOfScope = validateScopeDepthBudget({
      blueprint,
      plan: { ...legal, dir_ids: ["DIR-NOT-IN-BLUEPRINT"] },
      budget: budget(),
    });
    assert.equal(outOfScope.ok, false);
    if (!outOfScope.ok) assert.equal(outOfScope.reason_code, "dir_out_of_blueprint_scope");

    const overBudget = validateScopeDepthBudget({
      blueprint,
      plan: { ...legal, budget_cost: 5 },
      budget: budget({ remaining_hard_budget: 1, session_asked_count: 14, hard_budget_limit: 15 }),
    });
    assert.equal(overBudget.ok, false);
    if (!overBudget.ok) assert.equal(overBudget.reason_code, "hard_budget_insufficient");

    const hardReached = validateScopeDepthBudget({
      blueprint,
      plan: { ...legal, budget_cost: 1 },
      budget: budget({
        remaining_hard_budget: 1,
        session_asked_count: 15,
        hard_budget_limit: 15,
      }),
    });
    assert.equal(hardReached.ok, false);
    if (!hardReached.ok) assert.equal(hardReached.reason_code, "hard_budget_reached");

    const dirId = legal.dir_ids[0]!;
    const ranked = rankedFor(blueprint, dirId, "option");
    const first = generateQuestionText({
      dc: session.decision_context!,
      blueprint,
      selected: ranked,
    });
    assert.ok(first && first.trim(), "first generation must produce a question");
    const repeated = generateQuestionText({
      dc: session.decision_context!,
      blueprint,
      selected: ranked,
      last_sent_question_text: first,
      prior_dir_questions: [first],
    });
    assert.equal(repeated, null, "repeat of the last sent question must be rejected");

    const builtRepeat = buildAdaptiveQuestionPlan({
      dc: session.decision_context!,
      blueprint,
      selected: ranked,
      budget: budget(),
      now: NOW,
      scoring_path: "test",
      last_sent_question_text: first,
      prior_dir_questions: [first],
    });
    assert.equal(builtRepeat.validation.ok, false);
    if (!builtRepeat.validation.ok) {
      assert.equal(builtRepeat.validation.reason_code, "no_remaining_info_need");
    }
  });

  await check("Readiness sufficient: no new question is generated", async () => {
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
    // Keep only known DIRs that are already on the blueprint; do not leave extra open catalog DIRs.
    const allowed = new Set(["DIR-OPT-ON-TABLE", "DIR-STATUS-QUO", "DIR-OPT-CONSTRAINTS", "DIR-RISK-TOLERANCE"]);
    const trimmed: POJUSessionState = {
      ...session,
      decision_context: {
        ...session.decision_context!,
        dirs: session.decision_context!.dirs.map((d) =>
          allowed.has(d.dir_id)
            ? { ...d, current_state: "known" as const, partial_satisfaction: false }
            : { ...d, id_lifecycle: "deprecated" as const, current_state: "n_a" as const },
        ),
      },
      decision_blueprint: {
        ...blueprint,
        dir_ids: [...allowed].filter((id) => blueprint.dir_ids.includes(id)),
        directions: blueprint.directions
          .map((d) => ({ ...d, dir_ids: d.dir_ids.filter((id) => allowed.has(id)) }))
          .filter((d) => d.dir_ids.length > 0),
      },
    };
    const understanding = buildUnderstandingState({
      session: trimmed,
      blueprint: trimmed.decision_blueprint!,
      now: NOW,
    });
    assert.equal(understanding.readiness.can_ask, false);
    assert.ok(
      understanding.readiness.verdict === "ready_for_final_confirm" ||
        understanding.readiness.verdict === "hard_budget_exhausted",
    );
    const turn = await runAdaptiveQuestionTurn({
      session: { ...trimmed, decision_understanding: understanding },
      statement: "那就可以确认了",
      source_turn_id: "turn_ready",
      now: NOW,
      test_hooks: {
        interpretAnswerModel: async () => ({
          classification: "clear_answer",
          extracted_items: [],
          unresolved_aspects: [],
          explanation: "ready confirm, no new facts",
        }),
      },
    });
    assert.equal(turn.authorized_question, null);
    assert.equal(turn.plan, null);
    assert.equal(turn.understanding?.readiness.can_ask, false);
  });

  await check("model timeout or invalid structure fails closed", async () => {
    const invalid = parseAndValidateModelAnswerDraft("not-json");
    assert.equal(invalid.ok, false);
    if (!invalid.ok) assert.equal(invalid.reason, "invalid_json");

    const badSchema = parseAndValidateModelAnswerDraft({ hello: "world" });
    assert.equal(badSchema.ok, false);
    if (!badSchema.ok) assert.equal(badSchema.reason, "invalid_schema");

    const { session } = sessionWithDc(
      draftDc([
        dir({ dir_id: "DIR-OPT-ON-TABLE", need: "Options on the table", roles: ["option"], state: "unknown" }),
      ]),
    );
    const timeout = await interpretAnswerWithModel({
      session,
      statement: "可选方案是留任或离职。",
      source_turn_id: "turn_timeout",
      testHook: async () => {
        throw new Error("llm_timeout: wall exceeded");
      },
    });
    assert.equal(timeout.ok, false);
    if (!timeout.ok) assert.equal(timeout.reason, "timeout");

    const { session: live } = sessionWithDc(
      draftDc([
        dir({ dir_id: "DIR-OPT-ON-TABLE", need: "Options on the table", roles: ["option"], state: "unknown" }),
      ]),
    );
    const failedTurn = await runAdaptiveQuestionTurn({
      session: live,
      statement: "可选方案是留任或离职。",
      source_turn_id: "turn_invalid",
      now: NOW,
      test_hooks: {
        interpretAnswerModel: async () => {
          throw new Error("llm_timeout: wall exceeded");
        },
      },
    });
    assert.ok(
      failedTurn.outcome === "answer_interpretation_failed" ||
        failedTurn.ask_error?.includes("timeout") ||
        failedTurn.authorized_question == null,
    );
    assert.equal(failedTurn.authorized_question, null);
  });

  await check("handleUserMessage sends the validated plan and does not call generic Chat LLM", async () => {
    const fetchCalls: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
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
        payment_id: "pay_di2_align_01",
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
      assert.equal(
        fetchCalls.some((u) => u.includes("/api/poju/chat")),
        false,
        "generic Chat LLM fetch must not run after an authorized M1 question",
      );
      assert.equal(asst!.content.includes("MODEL FREEFORM"), false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await check("Answer Interpretation context comes from latest Understanding/DC; UI shares the same state", async () => {
    const { session, blueprint } = sessionWithDc(
      draftDc(
        [dir({ dir_id: "DIR-OPT-ON-TABLE", need: "Options on the table", roles: ["option"], state: "unknown" })],
        {
          reality_facts: [
            fact({
              fact_id: "f_latest",
              statement: "Latest confirmed option set: stay, transfer, or start a consultancy",
              status: "unverified",
              dir_id: "DIR-OPT-ON-TABLE",
              role: "option",
            }),
          ],
        },
      ),
    );
    const understanding = buildUnderstandingState({ session, blueprint, now: NOW });
    const plan = planShell(blueprint, {
      question_text: "关于「Should I leave my job?」——最新问题：还有哪些真实可选方案？",
      dir_ids: ["DIR-OPT-ON-TABLE"],
    });
    const withUnderstanding: POJUSessionState = {
      ...session,
      decision_understanding: {
        ...understanding,
        last_sent_question: {
          question_text: plan.question_text,
          plan_id: plan.plan_id,
          direction_id: plan.direction_id,
          dir_ids: plan.dir_ids,
          ddr_ids: plan.ddr_ids,
          fact_role_codes: plan.fact_role_codes,
          turn_id: "turn_last",
          conflict_clarification: null,
        },
        next_question_plan: plan,
      },
      adaptive_ask_plan: plan,
    };
    const context = buildModelInterpretationContext({
      session: withUnderstanding,
      statement: "还有内部转岗一条路。",
      locale: "zh",
    });
    assert.equal(context.last_sent_question?.question_text, plan.question_text);
    assert.equal(
      context.last_sent_question?.question_text,
      withUnderstanding.decision_understanding?.last_sent_question?.question_text,
    );
    assert.equal(context.decision_question, "Should I leave my job?");
    assert.ok(
      context.related_reality_facts.some((f) => f.statement.includes("Latest confirmed option set")),
      "related facts must come from the latest DC behind Understanding",
    );
    const u = withUnderstanding.decision_understanding;
    assert.ok(context.understanding, "model context must include the full Understanding State");
    assert.equal(context.understanding_id, u!.understanding_id);
    assert.equal(context.context_id, u!.context_id);
    assert.equal(context.context_version, u!.context_version);
    assert.equal(context.blueprint_version, u!.blueprint_version);
    assert.deepEqual(context.understanding!.current_understanding, u!.current_understanding);
    assert.deepEqual(context.understanding!.understood, u!.understood);
    assert.deepEqual(context.understanding!.answered_pending_confirmation, u!.answered_pending_confirmation);
    assert.deepEqual(context.understanding!.need_to_understand, u!.need_to_understand);
    assert.deepEqual(context.understanding!.personal_pattern_insight, u!.personal_pattern_insight);
    assert.deepEqual(context.understanding!.readiness, u!.readiness);
    assert.deepEqual(context.understanding!.readiness_progress, u!.readiness_progress);
    assert.deepEqual(context.understanding!.budget, u!.budget);
    assert.equal(context.understanding!.last_answer_event_id, u!.last_answer_event_id);
    assert.deepEqual(context.understanding!.last_sent_question, u!.last_sent_question);
    const box = projectDecisionUnderstandingBox(withUnderstanding);
    const ui = projectAdaptiveQuestionForUi(withUnderstanding);
    assert.equal(box.current_understanding, understanding.current_understanding.summary);
    assert.equal(box.current_question, plan.question_text);
    assert.equal(ui.understanding_summary, withUnderstanding.decision_understanding?.current_understanding.summary);
    assert.equal(ui.current_question, withUnderstanding.decision_understanding?.last_sent_question?.question_text);
    assert.deepEqual(
      ui.need_labels,
      withUnderstanding.decision_understanding?.need_to_understand.items.map((i) =>
        i.kind === "dir_based" ? i.missing_content : i.why,
      ),
    );
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
