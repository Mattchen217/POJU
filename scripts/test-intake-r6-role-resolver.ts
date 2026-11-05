/**
 * Stage 3.2 acceptance round-3 — N/A declaration create path, topic eval, production ask wire.
 *   pnpm exec tsx scripts/test-intake-r6-role-resolver.ts
 *   pnpm test:intake-r6-resolver
 */
import { computeContentHash } from "@/lib/poju/decision-context/content-hash";
import {
  aggregateDirStateIntake,
  reaggregateDirsIntake,
} from "@/lib/poju/decision-context/dir-aggregator-intake";
import {
  validateExplicitNaEvidence,
  type NaValidationContext,
  type TopicApplicabilityRule,
} from "@/lib/poju/decision-context/explicit-na-validate";
import {
  appendNaClassificationToDc,
  appendNaDeclarationAction,
  checkExpiresAt,
  createExplicitNaClassificationFromUserDeclaration,
  type UserNaDeclarationAction,
} from "@/lib/poju/decision-context/na-declaration";
import {
  INTAKE_ASK_SCORING_PATH,
  selectNextIntakeAskForSession,
} from "@/lib/poju/decision-context/production-intake-ask";
import { planNextAskFromCandidates } from "@/lib/poju/decision-context/question-plan-cycle";
import {
  computeUnresolvedCount,
  plannerAggregatorRoleMismatches,
  type PlanningCandidate,
} from "@/lib/poju/decision-context/question-planning";
import {
  emptyNaValidation,
  resolveDirRoleEvidence,
} from "@/lib/poju/decision-context/role-resolver";
import type {
  Constraint,
  DecisionContext,
  DIR,
  ExplicitNaEvidence,
  RealityFact,
} from "@/lib/poju/decision-context/types";
import type { ConfirmationEvent } from "@/lib/poju/decision-context/confirmation-event";
import type { POJUSessionState } from "@/lib/poju/types";

const failures: string[] = [];
const assert = (label: string, ok: boolean) => {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
};

const CTX = "dc-test-1";
const SESSION_ID = "sess-1";
const VALID_NA_CODE = "explicit_not_applicable";
const NOW = "2026-11-05T00:00:00.000Z";

function baseDir(overrides: Partial<DIR> = {}): DIR {
  return {
    dir_id: "DIR-A",
    need: "need",
    why: "why",
    required_fact_roles: ["situation", "hard_constraint"],
    current_state: "unknown",
    partial_satisfaction: false,
    agenda_item_ids: [],
    id_lifecycle: "active",
    ...overrides,
  };
}

function fact(partial: Partial<RealityFact> & Pick<RealityFact, "fact_id">): RealityFact {
  return {
    statement: "s",
    status: "confirmed",
    verification_level: "user_asserted",
    source_stage: "user_supplement",
    source_turn_id: "t1",
    user_confirmed: true,
    fact_roles: ["situation"],
    related_dir_ids: ["DIR-A"],
    ...partial,
  };
}

function constraint(
  partial: Partial<Constraint> & Pick<Constraint, "constraint_id">,
): Constraint {
  return {
    statement: "c",
    category: "time",
    status: "confirmed",
    verification_level: "user_asserted",
    source_stage: "user_supplement",
    source_turn_id: "t1",
    rigidity: "hard",
    user_confirmed: true,
    related_dir_ids: ["DIR-A"],
    ...partial,
  };
}

function e1Fact(factId: string): ConfirmationEvent {
  return {
    event_id: `e1-${factId}`,
    target_type: "fact",
    fact_id: factId,
    source_turn_id: "t1",
    confirmation_turn_id: "t2",
    confirmation_action_id: `ca-${factId}`,
    event_type: "confirm_fact",
    actor: "user",
    confirmed_at: NOW,
    event_version: 1,
  };
}

function baseDc(overrides: Partial<DecisionContext> = {}): DecisionContext {
  return {
    context_id: CTX,
    version: 1,
    status: "draft",
    definition: {
      concrete_event: null,
      stakes: null,
      desired_outcome: null,
      decision_question: null,
      goal_priorities: [],
      unacceptable_outcomes: [],
    },
    reality_facts: [fact({ fact_id: "f1" })],
    constraints: [],
    hypotheses: [],
    dirs: [baseDir()],
    conflicts: [],
    content_hash: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function declarationAction(
  partial: Partial<UserNaDeclarationAction> = {},
): UserNaDeclarationAction {
  return {
    declaration_action_id: "na-act-1",
    session_id: SESSION_ID,
    context_id: CTX,
    actor: "user",
    control_id: "na_declare",
    source_ref: { kind: "reality_fact", fact_id: "f1" },
    dir_id: "DIR-A",
    na_condition_code: VALID_NA_CODE,
    declaration_turn_id: "t-na-1",
    occurred_at: NOW,
    revoked: false,
    expires_at: null,
    ...partial,
  };
}

function topicRule(
  partial: Partial<TopicApplicabilityRule> & {
    evaluation?: Partial<TopicApplicabilityRule["evaluation"]>;
  } = {},
): TopicApplicabilityRule {
  const { evaluation: evalPartial, ...rest } = partial;
  return {
    rule_id: "rule-topic-1",
    topic_code: "topic.x",
    target_dir_id: "DIR-A",
    evaluation: {
      eval_id: "tev-1",
      evaluated_at: NOW,
      status: "current",
      not_applicable: true,
      expires_at: null,
      catalog_version: "topic-cat-v1",
      ...evalPartial,
    },
    ...rest,
  };
}

function provenNaValidation(
  overrides: Partial<NaValidationContext> = {},
): NaValidationContext {
  const action = declarationAction();
  const created = createExplicitNaClassificationFromUserDeclaration({
    action,
    dc: baseDc(),
    nowIso: NOW,
    dirNaConditions: [VALID_NA_CODE, "topic_na"],
  });
  if (!created.ok) throw new Error(`fixture create failed: ${created.reason_code}`);
  return emptyNaValidation({
    contextId: CTX,
    nowIso: NOW,
    dirCatalog: [
      { dir_id: "DIR-A", na_conditions: [VALID_NA_CODE, "topic_na"] },
      { dir_id: "DIR-B", na_conditions: [VALID_NA_CODE, "topic_na"] },
    ],
    catalogConditionEvals: [
      {
        condition_eval_id: "ev1",
        target_dir_id: "DIR-A",
        na_condition_code: VALID_NA_CODE,
        condition_met: true,
      },
    ],
    topicRules: [topicRule()],
    realityFacts: [fact({ fact_id: "f1" })],
    confirmationEvents: [e1Fact("f1")],
    explicitNaClassifications: [created.classification],
    naDeclarationActions: [action],
    ...overrides,
  });
}

function userNaEvidence(): ExplicitNaEvidence {
  return {
    evidence_id: "na-user-1",
    target: "dir",
    dir_id: "DIR-A",
    na_condition_code: VALID_NA_CODE,
    evidence_type: "user_explicit_na",
    source_ref: { kind: "reality_fact", fact_id: "f1" },
    written_by: "code",
    revoked: false,
  };
}

function validCatalogNa(): ExplicitNaEvidence {
  return {
    evidence_id: "na1",
    target: "dir",
    dir_id: "DIR-A",
    na_condition_code: VALID_NA_CODE,
    evidence_type: "system_na_marker",
    system_basis: {
      kind: "catalog_na_condition_met",
      target_dir_id: "DIR-A",
      condition_eval_id: "ev1",
    },
    written_by: "code",
    revoked: false,
  };
}

const dir = baseDir();

console.log("\n== R1/R2 regression: Fact AND / user_confirmed / Constraint ==");
{
  const r = resolveDirRoleEvidence({
    dir,
    roleCode: "situation",
    realityFacts: [fact({ fact_id: "f1", related_dir_ids: undefined })],
    constraints: [],
    explicitNaEvidence: [],
    conflicts: [],
    naValidation: emptyNaValidation({ contextId: CTX }),
  });
  assert("MX-83 missing related_dir_ids → unresolved", r.state === "unresolved");
}
{
  const r = resolveDirRoleEvidence({
    dir,
    roleCode: "situation",
    realityFacts: [fact({ fact_id: "f1", fact_roles: undefined })],
    constraints: [],
    explicitNaEvidence: [],
    conflicts: [],
    naValidation: emptyNaValidation({ contextId: CTX }),
  });
  assert("MX-84 missing role tag → unresolved", r.state === "unresolved");
}
{
  const r = resolveDirRoleEvidence({
    dir,
    roleCode: "situation",
    realityFacts: [fact({ fact_id: "f1", user_confirmed: true })],
    constraints: [],
    explicitNaEvidence: [],
    conflicts: [],
    naValidation: emptyNaValidation({ contextId: CTX }),
  });
  assert("MX-85 exact pair confirmed", r.state === "confirmed");
}
{
  const r = resolveDirRoleEvidence({
    dir,
    roleCode: "situation",
    realityFacts: [
      fact({
        fact_id: "f1",
        status: "confirmed",
        verification_level: "user_asserted",
        user_confirmed: false,
      }),
    ],
    constraints: [],
    explicitNaEvidence: [],
    conflicts: [],
    naValidation: emptyNaValidation({ contextId: CTX }),
  });
  assert("user_confirmed=false → NOT confirmed", r.state === "unresolved");
}
{
  const r = resolveDirRoleEvidence({
    dir,
    roleCode: "situation",
    realityFacts: [
      fact({
        fact_id: "f1",
        verification_level: "independently_verified",
        user_confirmed: false,
      }),
    ],
    constraints: [],
    explicitNaEvidence: [],
    conflicts: [],
    naValidation: emptyNaValidation(),
  });
  assert("independently_verified → confirmed", r.state === "confirmed");
}
{
  const r = resolveDirRoleEvidence({
    dir,
    roleCode: "hard_constraint",
    realityFacts: [],
    constraints: [constraint({ constraint_id: "k1" })],
    explicitNaEvidence: [],
    conflicts: [],
    naValidation: emptyNaValidation({ contextId: CTX }),
  });
  assert("MX-90 hard_constraint confirmed", r.state === "confirmed");
}
{
  const r = resolveDirRoleEvidence({
    dir,
    roleCode: "hard_constraint",
    realityFacts: [],
    constraints: [constraint({ constraint_id: "k1", rigidity: "soft" })],
    explicitNaEvidence: [],
    conflicts: [],
    naValidation: emptyNaValidation({ contextId: CTX }),
  });
  assert("MX-92 rigidity mismatch → unresolved", r.state === "unresolved");
}

console.log("\n== P0-1 Production createExplicitNaClassificationFromUserDeclaration ==");
{
  const action = declarationAction();
  const created = createExplicitNaClassificationFromUserDeclaration({
    action,
    dc: baseDc(),
    nowIso: NOW,
    dirNaConditions: [VALID_NA_CODE],
  });
  assert("production create from user declaration → ok", created.ok);
  if (created.ok) {
    assert(
      "created classification bound to declaration_action_id",
      created.classification.declaration_action_id === action.declaration_action_id,
    );
    assert(
      "authority user_declared written_by code",
      created.classification.authority === "user_declared" &&
        created.classification.written_by === "code",
    );
  }
}
{
  const bad = createExplicitNaClassificationFromUserDeclaration({
    action: declarationAction({ control_id: "model_inferred_control" }),
    dc: baseDc(),
    nowIso: NOW,
    dirNaConditions: [VALID_NA_CODE],
  });
  assert("model/non-allowlisted control → reject create", !bad.ok);
}
{
  const bad = createExplicitNaClassificationFromUserDeclaration({
    action: declarationAction({ actor: "user", revoked: true }),
    dc: baseDc(),
    nowIso: NOW,
    dirNaConditions: [VALID_NA_CODE],
  });
  assert("revoked action → reject create", !bad.ok);
}
{
  // E1 alone cannot create classification — create path requires declaration action
  const evidence = userNaEvidence();
  const e1Only = provenNaValidation({
    explicitNaClassifications: [],
    naDeclarationActions: [],
  });
  const bad = validateExplicitNaEvidence(evidence, e1Only);
  assert(
    "E1 without classification+declaration → reject",
    !bad.ok && bad.reason_code === "explicit_na_classification_missing",
  );
}
{
  // Hand-crafted classification with fake action_id (not in action store) → reject
  const action = declarationAction();
  const created = createExplicitNaClassificationFromUserDeclaration({
    action,
    dc: baseDc(),
    nowIso: NOW,
    dirNaConditions: [VALID_NA_CODE],
  });
  if (!created.ok) throw new Error("setup");
  const forged = provenNaValidation({
    explicitNaClassifications: [created.classification],
    naDeclarationActions: [], // action missing from store
  });
  const bad = validateExplicitNaEvidence(userNaEvidence(), forged);
  assert("classification without persisted declaration action → reject", !bad.ok);
}
{
  const action = declarationAction();
  const created = createExplicitNaClassificationFromUserDeclaration({
    action,
    dc: baseDc(),
    nowIso: NOW,
    dirNaConditions: [VALID_NA_CODE],
  });
  if (!created.ok) throw new Error("setup");
  const wrongFact = provenNaValidation({
    explicitNaClassifications: [
      {
        ...created.classification,
        source_ref: { kind: "reality_fact", fact_id: "OTHER" },
      },
    ],
    naDeclarationActions: [action],
  });
  assert(
    "classification source mismatch vs evidence → reject",
    !validateExplicitNaEvidence(userNaEvidence(), wrongFact).ok,
  );
}
{
  const action = declarationAction({ dir_id: "DIR-B" });
  // create will fail because DIR-B not on dc / source not linked — use forged cls on DIR-B action
  const okAction = declarationAction();
  const created = createExplicitNaClassificationFromUserDeclaration({
    action: okAction,
    dc: baseDc(),
    nowIso: NOW,
    dirNaConditions: [VALID_NA_CODE],
  });
  if (!created.ok) throw new Error("setup");
  const otherDirCtx = provenNaValidation({
    explicitNaClassifications: [
      { ...created.classification, dir_id: "DIR-B" },
    ],
    naDeclarationActions: [action],
  });
  assert(
    "classification/action for other DIR → reject",
    !validateExplicitNaEvidence(userNaEvidence(), otherDirCtx).ok,
  );
}
{
  const action = declarationAction({ revoked: true });
  const okAction = declarationAction();
  const created = createExplicitNaClassificationFromUserDeclaration({
    action: okAction,
    dc: baseDc(),
    nowIso: NOW,
    dirNaConditions: [VALID_NA_CODE],
  });
  if (!created.ok) throw new Error("setup");
  const revokedCtx = provenNaValidation({
    explicitNaClassifications: [created.classification],
    naDeclarationActions: [action],
  });
  assert(
    "revoked declaration action → reject",
    !validateExplicitNaEvidence(userNaEvidence(), revokedCtx).ok,
  );
}
{
  const action = declarationAction({ expires_at: "2026-11-01T00:00:00.000Z" });
  const created = createExplicitNaClassificationFromUserDeclaration({
    action: declarationAction(),
    dc: baseDc(),
    nowIso: NOW,
    dirNaConditions: [VALID_NA_CODE],
  });
  if (!created.ok) throw new Error("setup");
  const expiredCtx = provenNaValidation({
    nowIso: NOW,
    explicitNaClassifications: [
      { ...created.classification, expires_at: "2026-11-01T00:00:00.000Z" },
    ],
    naDeclarationActions: [action],
  });
  assert(
    "expired classification/action → reject",
    !validateExplicitNaEvidence(userNaEvidence(), expiredCtx).ok,
  );
}
{
  const action = declarationAction();
  const created = createExplicitNaClassificationFromUserDeclaration({
    action,
    dc: baseDc(),
    nowIso: NOW,
    dirNaConditions: [VALID_NA_CODE],
  });
  if (!created.ok) throw new Error("setup");
  let dc = appendNaClassificationToDc(baseDc(), created.classification, NOW);
  const actions = appendNaDeclarationAction([], action);
  const ctx = provenNaValidation({
    explicitNaClassifications: dc.explicit_na_classifications,
    naDeclarationActions: actions,
  });
  const ok = validateExplicitNaEvidence(userNaEvidence(), ctx);
  assert("full production create → validate accept", ok.ok);
  const dirs = reaggregateDirsIntake(
    [dir],
    [fact({ fact_id: "f1" })],
    [],
    [],
    [userNaEvidence()],
    ctx,
  );
  assert("validated user_explicit_na → DIR n_a", dirs[0]!.current_state === "n_a");
}

console.log("\n== P1-2 Illegal expires_at / nowIso fail-closed ==");
{
  assert(
    "illegal expires_at → invalid",
    checkExpiresAt("not-a-date", NOW) === "invalid",
  );
  assert(
    "illegal nowIso → invalid",
    checkExpiresAt("2026-12-01T00:00:00.000Z", "nope") === "invalid",
  );
  const action = declarationAction({ expires_at: "garbage-date" });
  // validateUserNaDeclarationAction throws; create catches
  const bad = createExplicitNaClassificationFromUserDeclaration({
    action,
    dc: baseDc(),
    nowIso: NOW,
    dirNaConditions: [VALID_NA_CODE],
  });
  assert("illegal expires_at on create → reject", !bad.ok);

  const okAction = declarationAction();
  const created = createExplicitNaClassificationFromUserDeclaration({
    action: okAction,
    dc: baseDc(),
    nowIso: NOW,
    dirNaConditions: [VALID_NA_CODE],
  });
  if (!created.ok) throw new Error("setup");
  const badNow = provenNaValidation({
    nowIso: "not-iso",
    explicitNaClassifications: [created.classification],
    naDeclarationActions: [okAction],
  });
  assert(
    "illegal nowIso at validate → reject classification match",
    !validateExplicitNaEvidence(userNaEvidence(), badNow).ok,
  );
}

console.log("\n== P0-2 Topic evaluation must be explicitly current ==");
{
  const topicNa: ExplicitNaEvidence = {
    evidence_id: "na-topic",
    target: "dir",
    dir_id: "DIR-A",
    na_condition_code: "topic_na",
    evidence_type: "system_na_marker",
    system_basis: {
      kind: "topic_not_applicable",
      topic_code: "topic.x",
      rule_id: "rule-topic-1",
    },
    written_by: "code",
    revoked: false,
  };
  assert(
    "topic current eval → accept",
    validateExplicitNaEvidence(topicNa, provenNaValidation()).ok,
  );
  assert(
    "topic other DIR → reject",
    !validateExplicitNaEvidence(
      topicNa,
      provenNaValidation({ topicRules: [topicRule({ target_dir_id: "DIR-B" })] }),
    ).ok,
  );
  assert(
    "topic stale status → reject",
    !validateExplicitNaEvidence(
      topicNa,
      provenNaValidation({
        topicRules: [topicRule({ evaluation: { status: "stale" } })],
      }),
    ).ok,
  );
  assert(
    "topic superseded → reject",
    !validateExplicitNaEvidence(
      topicNa,
      provenNaValidation({
        topicRules: [topicRule({ evaluation: { status: "superseded" } })],
      }),
    ).ok,
  );
  assert(
    "topic revoked eval → reject",
    !validateExplicitNaEvidence(
      topicNa,
      provenNaValidation({
        topicRules: [topicRule({ evaluation: { status: "revoked" } })],
      }),
    ).ok,
  );
  assert(
    "topic still applicable → reject",
    !validateExplicitNaEvidence(
      topicNa,
      provenNaValidation({
        topicRules: [topicRule({ evaluation: { not_applicable: false } })],
      }),
    ).ok,
  );
  assert(
    "topic expired eval → reject",
    !validateExplicitNaEvidence(
      topicNa,
      provenNaValidation({
        nowIso: NOW,
        topicRules: [
          topicRule({
            evaluation: { expires_at: "2026-11-01T00:00:00.000Z" },
          }),
        ],
      }),
    ).ok,
  );
  assert(
    "topic missing evaluation → reject",
    !validateExplicitNaEvidence(
      topicNa,
      provenNaValidation({
        topicRules: [
          {
            rule_id: "rule-topic-1",
            topic_code: "topic.x",
            target_dir_id: "DIR-A",
            evaluation: undefined as unknown as TopicApplicabilityRule["evaluation"],
          },
        ],
      }),
    ).ok,
  );
}

console.log("\n== System N/A / DDR-03 / DIR aggregation ==");
{
  const dirs = reaggregateDirsIntake(
    [dir],
    [],
    [],
    [],
    [validCatalogNa()],
    provenNaValidation(),
  );
  assert("MX-119 catalog N/A → n_a", dirs[0]!.current_state === "n_a");
}
{
  const dirs = reaggregateDirsIntake(
    [dir],
    [fact({ fact_id: "f1" })],
    [],
    [],
    [],
    emptyNaValidation({ contextId: CTX }),
  );
  assert("MX-118 without N/A → unknown", dirs[0]!.current_state === "unknown");
}
{
  const bad = validateExplicitNaEvidence(
    {
      evidence_id: "na3",
      target: "ddr",
      ddr_id: "DDR-03-CHART-APPENDIX",
      na_condition_code: "chart_not_supplied",
      evidence_type: "system_na_marker",
      system_basis: {
        kind: "empty_dir_source_absence",
        ddr_id: "DDR-03-CHART-APPENDIX",
        source_code: "cfp.birth",
        source_state: "source_absent_not_supplied",
        eval_id: "e1",
      },
      written_by: "code",
      revoked: false,
    },
    emptyNaValidation({ contextId: CTX, cfpSourceState: "source_calc_failed" }),
  );
  assert("MX-112 calc_failed → reject", !bad.ok);
}

console.log("\n== P1-1 Production selectNextIntakeAskForSession ==");
{
  const session = {
    session_id: SESSION_ID,
    decision_context: baseDc({
      dirs: [
        baseDir({
          required_fact_roles: ["situation", "hard_constraint"],
          current_state: "unknown",
        }),
      ],
      reality_facts: [fact({ fact_id: "f1" })],
      constraints: [],
    }),
  } as POJUSessionState;

  const result = selectNextIntakeAskForSession({ session, nowIso: NOW });
  assert(
    "production call chain literal",
    result.production_call_chain === INTAKE_ASK_SCORING_PATH,
  );
  assert("production writes intake_ask_plan", !!result.session.intake_ask_plan);
  assert(
    "intake_ask_plan.scoring_path matches production chain",
    result.session.intake_ask_plan?.scoring_path === INTAKE_ASK_SCORING_PATH,
  );
  assert("production selected a dir gap candidate", result.selected != null);
  assert(
    "production unresolved uses shared resolver (hard_constraint open → 1)",
    result.selected?.score.unresolved_count === 1,
  );

  const sourceOnly = {
    candidate_id: "cq_src",
    kind: "source_only" as const,
    dir_ids: [] as string[],
    ddr_ids: ["DDR-03-CHART-APPENDIX"],
    fact_role_codes: ["v1/source/cfp.birth"],
    source_code: "cfp.birth",
    impact: {
      decision_critical: true,
      may_affect_p5_ranking: false,
      gate_class: "P0" as const,
    },
    depth: 0,
    repetition_count: 0,
    budget_cost: 1,
  };
  const withSrc = selectNextIntakeAskForSession({
    session,
    nowIso: NOW,
    extraCandidates: [sourceOnly],
    p0SourceNotOk: true,
  });
  assert(
    "source_only unresolved_count=0",
    withSrc.plan.ranked.find((r) => r.candidate.candidate_id === "cq_src")
      ?.score.unresolved_count === 0,
  );
  assert(
    "source_only gap_type=source_pending",
    withSrc.plan.ranked.find((r) => r.candidate.candidate_id === "cq_src")
      ?.score.gap_type === "source_pending",
  );
  assert(
    "P0 source_only selected over P1 dir",
    withSrc.selected?.candidate.candidate_id === "cq_src",
  );
}

console.log("\n== Planner/Aggregator consistency + planNextAsk ==");
{
  const facts = [fact({ fact_id: "f1" })];
  const constraints = [constraint({ constraint_id: "k1" })];
  const snap = {
    dirs: [dir],
    reality_facts: facts,
    constraints,
    conflicts: [],
    explicit_na_evidence: [] as ExplicitNaEvidence[],
  };
  const candidate: PlanningCandidate = {
    candidate_id: "c1",
    kind: "dir_based",
    dir_ids: ["DIR-A"],
    ddr_ids: ["DDR-01"],
    fact_role_codes: [
      "v1/dir/DIR-A/role/situation",
      "v1/dir/DIR-A/role/hard_constraint",
    ],
    impact: {
      decision_critical: false,
      may_affect_p5_ranking: false,
      gate_class: "P1",
    },
  };
  const { role_states } = computeUnresolvedCount(candidate, snap);
  const agg = aggregateDirStateIntake(
    dir,
    facts,
    [],
    constraints,
    [],
    emptyNaValidation({ contextId: CTX }),
  );
  assert(
    "Planner/Aggregator role states match",
    plannerAggregatorRoleMismatches({
      dir,
      plannerRoleStates: role_states,
      aggregatorRoleStates: agg.role_states,
    }).length === 0,
  );
  const ranked = planNextAskFromCandidates({
    candidates: [
      {
        ...candidate,
        depth: 1,
        repetition_count: 0,
        budget_cost: 1,
      },
    ],
    snap,
    remaining_hard_budget: 15,
  });
  assert(
    "planNextAsk scoring_path shared resolver",
    ranked.scoring_path === "scorePlanningCandidate→resolveDirRoleEvidence",
  );
}

console.log("\n== C5 hash ==");
{
  const dc = baseDc({ reality_facts: [], constraints: [constraint({ constraint_id: "k1" })] });
  const h1 = computeContentHash(dc);
  const h2 = computeContentHash({ ...dc, explicit_na_evidence: [validCatalogNa()] });
  const h3 = computeContentHash({
    ...dc,
    constraints: [
      constraint({ constraint_id: "k1", related_dir_ids: ["DIR-A", "DIR-B"] }),
    ],
  });
  const created = createExplicitNaClassificationFromUserDeclaration({
    action: declarationAction(),
    dc: baseDc(),
    nowIso: NOW,
    dirNaConditions: [VALID_NA_CODE],
  });
  assert("create for hash fixture ok", created.ok);
  const h4 = computeContentHash({
    ...dc,
    explicit_na_classifications: created.ok ? [created.classification] : [],
  });
  assert("MX-121 N/A evidence changes hash", h1 !== h2);
  assert("MX-123 related_dir_ids changes hash", h1 !== h3);
  assert("classification changes hash", h1 !== h4);
}

console.log("");
if (failures.length) {
  console.error(`FAILED ${failures.length}:`, failures);
  process.exit(1);
}
console.log("All Intake R6 Stage 3.2 round-3 acceptance checks passed.");
