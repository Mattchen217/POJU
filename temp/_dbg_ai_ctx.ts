import "fake-indexeddb/auto";
import { installIntakeR6TestGlobals } from "../scripts/fixtures/test-browser-globals";
import { testSessionState } from "../scripts/fixtures/intake-r6-session";
import { withDeterministicHandleHooks } from "../scripts/fixtures/test-answer-interpretation-hook";

installIntakeR6TestGlobals("dbg_ai_ctx");

const NOW = "2026-11-19T08:00:00.000Z";
const OPTION_ROLE = "v1/dir/DIR-OPT-ON-TABLE/role/option";

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
    may_affect_p5_ranking: true,
  };
}

async function main() {
  const { createInitialAgentState } = await import("../lib/poju/agent-state");
  const { createDefaultControlPlane } = await import(
    "../lib/poju/decision-context/control-plane"
  );
  const { ensureDecisionBlueprint } = await import(
    "../lib/poju/decision-intake/blueprint"
  );
  const { buildUnderstandingState, refreshDecisionUnderstanding } = await import(
    "../lib/poju/decision-intake/understanding-state"
  );
  const { handleUserMessage: handleUserMessageRaw } = await import("../lib/poju/agent");
  const { runAdaptiveQuestionTurn } = await import(
    "../lib/poju/decision-intake/adaptive-turn"
  );
  type POJUSessionState = import("../lib/poju/types").POJUSessionState;
  type DecisionContext = import("../lib/poju/decision-context/types").DecisionContext;
  type AdaptiveQuestionPlan = import("../lib/poju/decision-intake/types").AdaptiveQuestionPlan;
  type DecisionBlueprint = import("../lib/poju/decision-intake/types").DecisionBlueprint;

  const handleUserMessage: typeof handleUserMessageRaw = (input) =>
    handleUserMessageRaw(withDeterministicHandleHooks(input));

  const dc: DecisionContext = {
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
    constraints: [],
    hypotheses: [],
    dirs: [
      dir({ dir_id: "DIR-OPT-ON-TABLE", need: "Options on the table", roles: ["option"], state: "known" }),
      dir({ dir_id: "DIR-STATUS-QUO", need: "Status quo cost", roles: ["status_quo"], state: "n_a" }),
      dir({ dir_id: "DIR-OPT-CONSTRAINTS", need: "Hard constraints", roles: ["hard_constraint"], state: "unknown" }),
      dir({ dir_id: "DIR-RISK-TOLERANCE", need: "Risk tolerance", roles: ["risk_tolerance"], state: "conflict" }),
    ],
    conflicts: [
      {
        conflict_id: "c_risk",
        conflict_field: "risk_tolerance",
        fact_ids: ["f_risk_a", "f_risk_b"],
        state: "open",
        statements_snapshot: ["Can take a one-year pay cut", "Cannot take any pay cut"],
      },
    ],
    content_hash: null,
    created_at: NOW,
    updated_at: NOW,
  };

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
  const blueprint = withBp.session.decision_blueprint!;
  const understanding = buildUnderstandingState({
    session: withBp.session,
    blueprint,
    now: NOW,
    last_answer_event_id: "evt_prev",
  });
  console.log("blueprint_dirs", blueprint.dir_ids.join(","));
  console.log(
    "U",
    JSON.stringify(
      {
        understood: understanding.understood.items.map((i) => ({ id: i.dir_id, status: i.status })),
        answered: (understanding.answered_pending_confirmation?.items ?? []).map((i) => ({
          id: i.dir_id,
          statuses: i.answer_statuses,
        })),
        needs: understanding.need_to_understand.items
          .filter((i): i is Extract<typeof i, { kind: "dir_based" }> => i.kind === "dir_based")
          .map((i) => ({ id: i.dir_id, gap: i.gap_type })),
      },
      null,
      2,
    ),
  );

  const allowed = new Set([
    "DIR-OPT-ON-TABLE",
    "DIR-STATUS-QUO",
    "DIR-OPT-CONSTRAINTS",
    "DIR-RISK-TOLERANCE",
  ]);
  const readyDc: DecisionContext = {
    ...dc,
    reality_facts: [
      fact({
        fact_id: "f1",
        statement: "Stay or leave",
        status: "confirmed",
        dir_id: "DIR-OPT-ON-TABLE",
        role: "option",
        user_confirmed: true,
      }),
      fact({
        fact_id: "f2",
        statement: "Status quo is stagnant",
        status: "confirmed",
        dir_id: "DIR-STATUS-QUO",
        role: "status_quo",
        user_confirmed: true,
      }),
      fact({
        fact_id: "f3",
        statement: "Six months of savings",
        status: "confirmed",
        dir_id: "DIR-OPT-CONSTRAINTS",
        role: "hard_constraint",
        user_confirmed: true,
      }),
      fact({
        fact_id: "f4",
        statement: "Can accept one year of lower pay",
        status: "confirmed",
        dir_id: "DIR-RISK-TOLERANCE",
        role: "risk_tolerance",
        user_confirmed: true,
      }),
    ],
    dirs: withBp.session.decision_context!.dirs.map((d) =>
      allowed.has(d.dir_id)
        ? { ...d, current_state: "known" as const, partial_satisfaction: false }
        : { ...d, id_lifecycle: "deprecated" as const, current_state: "n_a" as const },
    ),
    conflicts: [],
  };
  const readyBp: DecisionBlueprint = {
    ...blueprint,
    dir_ids: [...allowed].filter((id) => blueprint.dir_ids.includes(id)),
    directions: blueprint.directions
      .map((d) => ({ ...d, dir_ids: d.dir_ids.filter((id) => allowed.has(id)) }))
      .filter((d) => d.dir_ids.length > 0),
  };
  const readyBase: POJUSessionState = {
    ...withBp.session,
    session_id: "sess_ai_ctx_ready",
    decision_context: readyDc,
    decision_blueprint: readyBp,
  };
  const plan: AdaptiveQuestionPlan = {
    plan_id: "qp_ai_ctx",
    candidate_id: "cand_ai_ctx",
    direction_id: readyBp.directions[0]!.direction_id,
    ddr_ids: readyBp.ddr_ids?.length ? [readyBp.ddr_ids[0]!] : ["DDR-TEST"],
    dir_ids: [readyBp.directions[0]!.dir_ids[0]!],
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
  };
  const u2 = buildUnderstandingState({ session: readyBase, blueprint: readyBp, now: NOW });
  const readySession: POJUSessionState = refreshDecisionUnderstanding(
    {
      ...readyBase,
      decision_understanding: {
        ...u2,
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
    },
    { now: NOW },
  );
  console.log("ready can_ask", readySession.decision_understanding?.readiness.can_ask);
  console.log("ready verdict", readySession.decision_understanding?.readiness.verdict);

  const turn = await runAdaptiveQuestionTurn({
    session: readySession,
    statement: "那就确认以上理解吧。",
    source_turn_id: "turn_ready_dbg",
    now: NOW,
    test_hooks: {
      interpretAnswerModel: async () => ({
        classification: "clear_answer",
        extracted_items: [],
        unresolved_aspects: [],
        explanation: "ready confirm",
      }),
    },
  });
  console.log("turn", {
    outcome: turn.outcome,
    authorized: turn.authorized_question,
    can_ask: turn.understanding?.readiness.can_ask,
    ask_error: turn.ask_error,
  });

  const out = await handleUserMessage({
    session: readySession,
    userMessage: "那就确认以上理解吧。",
    locale: "zh",
  });
  const asst = [...out.messages].reverse().find((m) => m.role === "assistant");
  console.log("handle", {
    content: asst?.content?.slice(0, 80),
    meta: asst?.meta,
    phase: out.agent_v2?.current_phase,
    can_ask: out.decision_understanding?.readiness.can_ask,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
