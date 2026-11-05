/**
 * Stage 3.2 acceptance round-4 — production N/A persist + topic authority + CI.
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
  applyDeclareDirNaToSession,
  checkExpiresAt,
  createExplicitNaClassificationFromUserDeclaration,
  NaDeclarationError,
  type UserNaDeclarationAction,
} from "@/lib/poju/decision-context/na-declaration";
import {
  INTAKE_ASK_SCORING_PATH,
  selectNextIntakeAskForSession,
} from "@/lib/poju/decision-context/production-intake-ask";
import {
  computeUnresolvedCount,
  plannerAggregatorRoleMismatches,
  type PlanningCandidate,
} from "@/lib/poju/decision-context/question-planning";
import {
  emptyNaValidation,
  resolveDirRoleEvidence,
} from "@/lib/poju/decision-context/role-resolver";
import type { AuthoritativeTopicEvalRecord } from "@/lib/poju/decision-context/topic-eval-authority";
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
/** Production SSOT pair for applyDeclareDirNaToSession success paths. */
const SSOT_DIR = "DIR-DEF-UNACCEPTABLE";
const VALID_NA_CODE = "explicit_no_hard_red_lines";
const NOW = "2026-11-05T00:00:00.000Z";
const TOPIC_CAT = "topic-cat-v1";
const TOPIC_EXPIRY = "2026-12-01T00:00:00.000Z";

function baseDir(overrides: Partial<DIR> = {}): DIR {
  return {
    // Default DIR-A is for generic role/fingerprint fixtures (not production catalog).
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

function baseSession(overrides: Partial<POJUSessionState> = {}): POJUSessionState {
  return {
    session_id: SESSION_ID,
    decision_context: baseDc(),
    messages: [],
    created_at: NOW,
    last_interaction_at: NOW,
    expires_at: TOPIC_EXPIRY,
    ...overrides,
  } as POJUSessionState;
}

/** Session/DC correlated to production SSOT DIR for declare write paths. */
function declareSession(
  overrides: Partial<POJUSessionState> = {},
): POJUSessionState {
  return baseSession({
    decision_context: baseDc({
      dirs: [baseDir({ dir_id: SSOT_DIR })],
      reality_facts: [
        fact({ fact_id: "f1", related_dir_ids: [SSOT_DIR] }),
      ],
    }),
    ...overrides,
  });
}

function authorityTopic(
  partial: Partial<AuthoritativeTopicEvalRecord> = {},
): AuthoritativeTopicEvalRecord {
  return {
    eval_id: "tev-1",
    rule_id: "rule-topic-1",
    topic_code: "topic.x",
    target_dir_id: "DIR-A",
    catalog_version: TOPIC_CAT,
    not_applicable: true,
    evaluated_at: NOW,
    expires_at: TOPIC_EXPIRY,
    record_status: "current",
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
      expires_at: TOPIC_EXPIRY,
      catalog_version: TOPIC_CAT,
      ...evalPartial,
    },
    ...rest,
  };
}

function provenNaValidation(
  overrides: Partial<NaValidationContext> = {},
): NaValidationContext {
  const session = declareSession();
  const applied = applyDeclareDirNaToSession(
    session,
    SESSION_ID,
    {
      operation_id: "op-fixture",
      declaration_action_id: "na-act-1",
      control_id: "na_declare",
      fact_id: "f1",
      dir_id: SSOT_DIR,
      na_condition_code: VALID_NA_CODE,
      declaration_turn_id: "t-na-1",
      // Forged extras ignored for write auth (production loader is authority).
      dir_na_conditions: [VALID_NA_CODE, "topic_na"],
    },
    NOW,
  );
  return emptyNaValidation({
    contextId: CTX,
    sessionId: SESSION_ID,
    nowIso: NOW,
    dirCatalog: [
      { dir_id: SSOT_DIR, na_conditions: [VALID_NA_CODE, "topic_na"] },
      { dir_id: "DIR-B", na_conditions: [VALID_NA_CODE, "topic_na"] },
    ],
    catalogConditionEvals: [
      {
        condition_eval_id: "ev1",
        target_dir_id: SSOT_DIR,
        na_condition_code: VALID_NA_CODE,
        condition_met: true,
      },
    ],
    topicRules: [topicRule({ target_dir_id: SSOT_DIR })],
    topicEvalAuthority: [authorityTopic({ target_dir_id: SSOT_DIR })],
    currentTopicCatalogVersion: TOPIC_CAT,
    realityFacts: [fact({ fact_id: "f1", related_dir_ids: [SSOT_DIR] })],
    confirmationEvents: [e1Fact("f1")],
    explicitNaClassifications:
      applied.session.decision_context?.explicit_na_classifications ?? [],
    naDeclarationActions: applied.session.na_declaration_actions ?? [],
    ...overrides,
  });
}

function userNaEvidence(): ExplicitNaEvidence {
  return {
    evidence_id: "na_ev_na-act-1",
    target: "dir",
    dir_id: SSOT_DIR,
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
    dir_id: SSOT_DIR,
    na_condition_code: VALID_NA_CODE,
    evidence_type: "system_na_marker",
    system_basis: {
      kind: "catalog_na_condition_met",
      target_dir_id: SSOT_DIR,
      condition_eval_id: "ev1",
    },
    written_by: "code",
    revoked: false,
  };
}

const dir = baseDir();

console.log("\n== R1–R3 regression: Fact / Constraint / user_confirmed ==");
{
  const r = resolveDirRoleEvidence({
    dir,
    roleCode: "situation",
    realityFacts: [fact({ fact_id: "f1", related_dir_ids: undefined })],
    constraints: [],
    explicitNaEvidence: [],
    conflicts: [],
    naValidation: emptyNaValidation({ contextId: CTX, sessionId: SESSION_ID }),
  });
  assert("MX-83 missing related_dir_ids → unresolved", r.state === "unresolved");
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
    naValidation: emptyNaValidation({ contextId: CTX, sessionId: SESSION_ID }),
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
    naValidation: emptyNaValidation({ contextId: CTX, sessionId: SESSION_ID }),
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
    naValidation: emptyNaValidation({ contextId: CTX, sessionId: SESSION_ID }),
  });
  assert("MX-90 hard_constraint confirmed", r.state === "confirmed");
}

console.log("\n== P0-1 Production applyDeclareDirNaToSession persist path ==");
{
  const applied = applyDeclareDirNaToSession(
    declareSession(),
    SESSION_ID,
    {
      operation_id: "op1",
      declaration_action_id: "na-act-prod",
      control_id: "na_declare",
      fact_id: "f1",
      dir_id: SSOT_DIR,
      na_condition_code: VALID_NA_CODE,
      declaration_turn_id: "t-na-prod",
      dir_na_conditions: [VALID_NA_CODE],
    },
    NOW,
  );
  assert("production apply outcome appended", applied.outcome === "appended");
  assert(
    "action written to session.na_declaration_actions",
    (applied.session.na_declaration_actions ?? []).some(
      (a) => a.declaration_action_id === "na-act-prod",
    ),
  );
  assert(
    "server set action.session_id from session",
    applied.action.session_id === SESSION_ID,
  );
  assert(
    "server set action.context_id from DC",
    applied.action.context_id === CTX,
  );
  assert("server set actor=user", applied.action.actor === "user");
  assert(
    "classification written to DC",
    (applied.session.decision_context?.explicit_na_classifications ?? []).length ===
      1,
  );
  assert(
    "evidence written to DC",
    (applied.session.decision_context?.explicit_na_evidence ?? []).some(
      (e) => e.evidence_type === "user_explicit_na",
    ),
  );

  const ctx = emptyNaValidation({
    contextId: CTX,
    sessionId: SESSION_ID,
    nowIso: NOW,
    dirCatalog: [{ dir_id: SSOT_DIR, na_conditions: [VALID_NA_CODE] }],
    realityFacts: [fact({ fact_id: "f1", related_dir_ids: [SSOT_DIR] })],
    confirmationEvents: [e1Fact("f1")],
    explicitNaClassifications:
      applied.session.decision_context?.explicit_na_classifications ?? [],
    naDeclarationActions: applied.session.na_declaration_actions ?? [],
  });
  const ev: ExplicitNaEvidence = applied.evidence;
  assert(
    "validate accepts production-persisted declaration",
    validateExplicitNaEvidence(ev, ctx).ok,
  );
}
{
  let rejected = false;
  try {
    applyDeclareDirNaToSession(
    declareSession(),
      SESSION_ID,
      {
        operation_id: "op-bad",
        declaration_action_id: "x",
        control_id: "model_keyword_hit",
        fact_id: "f1",
        dir_id: SSOT_DIR,
        na_condition_code: VALID_NA_CODE,
        declaration_turn_id: "t",
        dir_na_conditions: [VALID_NA_CODE],
      },
      NOW,
    );
  } catch {
    rejected = true;
  }
  assert("non-allowlisted control_id rejected at production apply", rejected);
}
{
  const applied = applyDeclareDirNaToSession(
    declareSession(),
    SESSION_ID,
    {
      operation_id: "op2",
      declaration_action_id: "na-act-sess",
      control_id: "na_declare",
      fact_id: "f1",
      dir_id: SSOT_DIR,
      na_condition_code: VALID_NA_CODE,
      declaration_turn_id: "t-na",
      dir_na_conditions: [VALID_NA_CODE],
    },
    NOW,
  );
  const wrongSession = provenNaValidation({
    sessionId: "OTHER_SESSION",
    explicitNaClassifications:
      applied.session.decision_context?.explicit_na_classifications,
    naDeclarationActions: applied.session.na_declaration_actions,
  });
  assert(
    "action.session_id mismatch → reject at validate",
    !validateExplicitNaEvidence(applied.evidence, wrongSession).ok,
  );
}
{
  // E1 alone still insufficient
  const bad = validateExplicitNaEvidence(userNaEvidence(), provenNaValidation({
    explicitNaClassifications: [],
    naDeclarationActions: [],
  }));
  assert("E1 without declaration persist → reject", !bad.ok);
}
{
  // control_id allowlist re-checked at validate: forge action with bad control after create
  const applied = applyDeclareDirNaToSession(
    declareSession(),
    SESSION_ID,
    {
      operation_id: "op3",
      declaration_action_id: "na-act-ctrl",
      control_id: "na_declare",
      fact_id: "f1",
      dir_id: SSOT_DIR,
      na_condition_code: VALID_NA_CODE,
      declaration_turn_id: "t",
      dir_na_conditions: [VALID_NA_CODE],
    },
    NOW,
  );
  const forgedActions: UserNaDeclarationAction[] = (
    applied.session.na_declaration_actions ?? []
  ).map((a) => ({ ...a, control_id: "hacked_control" }));
  const ctx = emptyNaValidation({
    contextId: CTX,
    sessionId: SESSION_ID,
    nowIso: NOW,
    dirCatalog: [{ dir_id: SSOT_DIR, na_conditions: [VALID_NA_CODE] }],
    realityFacts: [fact({ fact_id: "f1", related_dir_ids: [SSOT_DIR] })],
    confirmationEvents: [e1Fact("f1")],
    explicitNaClassifications:
      applied.session.decision_context?.explicit_na_classifications ?? [],
    naDeclarationActions: forgedActions,
  });
  assert(
    "validate re-checks control_id allowlist → reject forged control",
    !validateExplicitNaEvidence(applied.evidence, ctx).ok,
  );
}

console.log("\n== P0-1 Idempotent replay binding ==");
{
  const first = applyDeclareDirNaToSession(
    declareSession(),
    SESSION_ID,
    {
      operation_id: "op-idemp",
      declaration_action_id: "na-act-idemp",
      control_id: "na_declare",
      fact_id: "f1",
      dir_id: SSOT_DIR,
      na_condition_code: VALID_NA_CODE,
      declaration_turn_id: "t-idemp",
      dir_na_conditions: [VALID_NA_CODE],
    },
    NOW,
  );
  const replay = applyDeclareDirNaToSession(
    first.session,
    SESSION_ID,
    {
      operation_id: "op-idemp-2",
      declaration_action_id: "na-act-idemp",
      control_id: "na_declare",
      fact_id: "f1",
      dir_id: SSOT_DIR,
      na_condition_code: VALID_NA_CODE,
      declaration_turn_id: "t-idemp",
      dir_na_conditions: [VALID_NA_CODE],
    },
    NOW,
  );
  assert("same payload replay → idempotent_skip", replay.outcome === "idempotent_skip");
  assert(
    "replay evidence id exact na_ev_${action}",
    replay.evidence.evidence_id === "na_ev_na-act-idemp",
  );

  let badFact = false;
  try {
    applyDeclareDirNaToSession(
      first.session,
      SESSION_ID,
      {
        operation_id: "op-bad-fact",
        declaration_action_id: "na-act-idemp",
        control_id: "na_declare",
        fact_id: "OTHER",
        dir_id: SSOT_DIR,
        na_condition_code: VALID_NA_CODE,
        declaration_turn_id: "t-idemp",
        dir_na_conditions: [VALID_NA_CODE],
      },
      NOW,
    );
  } catch (e) {
    badFact =
      e instanceof NaDeclarationError &&
      String(e.message).includes("idempotent_source_mismatch");
  }
  assert("same action_id different fact_id → reject", badFact);

  // second action with constraint on same DIR/condition
  const withCst = applyDeclareDirNaToSession(
    {
      ...first.session,
      decision_context: {
        ...first.session.decision_context!,
        constraints: [
          constraint({
            constraint_id: "k1",
            related_dir_ids: [SSOT_DIR],
          }),
        ],
      },
    },
    SESSION_ID,
    {
      operation_id: "op-cst",
      declaration_action_id: "na-act-cst",
      control_id: "na_declare",
      constraint_id: "k1",
      dir_id: SSOT_DIR,
      na_condition_code: VALID_NA_CODE,
      declaration_turn_id: "t-cst",
      dir_na_conditions: [VALID_NA_CODE],
    },
    NOW,
  );
  assert(
    "two actions same DIR/condition keep distinct evidence ids",
    withCst.evidence.evidence_id === "na_ev_na-act-cst" &&
      (withCst.session.decision_context?.explicit_na_evidence ?? []).some(
        (e) => e.evidence_id === "na_ev_na-act-idemp",
      ),
  );

  let badCst = false;
  try {
    applyDeclareDirNaToSession(
      withCst.session,
      SESSION_ID,
      {
        operation_id: "op-bad-cst",
        declaration_action_id: "na-act-cst",
        control_id: "na_declare",
        fact_id: "f1",
        dir_id: SSOT_DIR,
        na_condition_code: VALID_NA_CODE,
        declaration_turn_id: "t-cst",
        dir_na_conditions: [VALID_NA_CODE],
      },
      NOW,
    );
  } catch (e) {
    badCst = e instanceof NaDeclarationError;
  }
  assert("same action_id constraint→fact swap → reject", badCst);

  const missingEvSess = {
    ...first.session,
    decision_context: {
      ...first.session.decision_context!,
      explicit_na_evidence: [],
    },
  };
  let missingEv = false;
  try {
    applyDeclareDirNaToSession(
      missingEvSess,
      SESSION_ID,
      {
        operation_id: "op-miss",
        declaration_action_id: "na-act-idemp",
        control_id: "na_declare",
        fact_id: "f1",
        dir_id: SSOT_DIR,
        na_condition_code: VALID_NA_CODE,
        declaration_turn_id: "t-idemp",
        dir_na_conditions: [VALID_NA_CODE],
      },
      NOW,
    );
  } catch (e) {
    missingEv =
      e instanceof NaDeclarationError &&
      String(e.message).includes("idempotent_action_missing_evidence");
  }
  assert("missing evidence → fail-closed", missingEv);

  const revokedSess = {
    ...first.session,
    na_declaration_actions: (first.session.na_declaration_actions ?? []).map(
      (a) =>
        a.declaration_action_id === "na-act-idemp" ? { ...a, revoked: true } : a,
    ),
  };
  let revokedReplay = false;
  try {
    applyDeclareDirNaToSession(
      revokedSess,
      SESSION_ID,
      {
        operation_id: "op-rev",
        declaration_action_id: "na-act-idemp",
        control_id: "na_declare",
        fact_id: "f1",
        dir_id: SSOT_DIR,
        na_condition_code: VALID_NA_CODE,
        declaration_turn_id: "t-idemp",
        dir_na_conditions: [VALID_NA_CODE],
      },
      NOW,
    );
  } catch (e) {
    revokedReplay =
      e instanceof NaDeclarationError &&
      String(e.message).includes("action_revoked_replay");
  }
  assert("revoked action replay → reject (no reactivate)", revokedReplay);

  // Round-6: Session / DC ownership + turn / expires binding on idempotent replay.
  const idempInput = {
    operation_id: "op-idemp-r6",
    declaration_action_id: "na-act-idemp",
    control_id: "na_declare",
    fact_id: "f1",
    dir_id: SSOT_DIR,
    na_condition_code: VALID_NA_CODE,
    declaration_turn_id: "t-idemp",
    dir_na_conditions: [VALID_NA_CODE],
  } as const;

  const badSessionSess = {
    ...first.session,
    na_declaration_actions: (first.session.na_declaration_actions ?? []).map(
      (a) =>
        a.declaration_action_id === "na-act-idemp"
          ? { ...a, session_id: "OTHER_SESSION" }
          : a,
    ),
  };
  let badSession = false;
  try {
    applyDeclareDirNaToSession(badSessionSess, SESSION_ID, idempInput, NOW);
  } catch (e) {
    badSession =
      e instanceof NaDeclarationError &&
      String(e.message).includes("idempotent_session_mismatch");
  }
  assert("prior.session_id ≠ current Session → reject", badSession);

  const badCtxSess = {
    ...first.session,
    na_declaration_actions: (first.session.na_declaration_actions ?? []).map(
      (a) =>
        a.declaration_action_id === "na-act-idemp"
          ? { ...a, context_id: "OTHER_DC" }
          : a,
    ),
  };
  let badCtx = false;
  try {
    applyDeclareDirNaToSession(badCtxSess, SESSION_ID, idempInput, NOW);
  } catch (e) {
    badCtx =
      e instanceof NaDeclarationError &&
      String(e.message).includes("idempotent_context_mismatch");
  }
  assert("prior.context_id ≠ current DC → reject", badCtx);

  const badClsCtxSess = {
    ...first.session,
    decision_context: {
      ...first.session.decision_context!,
      explicit_na_classifications: (
        first.session.decision_context?.explicit_na_classifications ?? []
      ).map((c) =>
        c.declaration_action_id === "na-act-idemp"
          ? { ...c, context_id: "OTHER_DC" }
          : c,
      ),
    },
  };
  let badClsCtx = false;
  try {
    applyDeclareDirNaToSession(badClsCtxSess, SESSION_ID, idempInput, NOW);
  } catch (e) {
    badClsCtx =
      e instanceof NaDeclarationError &&
      String(e.message).includes("idempotent_classification_context_mismatch");
  }
  assert("classification.context_id ≠ current DC → reject", badClsCtx);

  let badTurn = false;
  try {
    applyDeclareDirNaToSession(
      first.session,
      SESSION_ID,
      { ...idempInput, declaration_turn_id: "t-OTHER" },
      NOW,
    );
  } catch (e) {
    badTurn =
      e instanceof NaDeclarationError &&
      String(e.message).includes("idempotent_turn_mismatch");
  }
  assert("declaration_turn_id mismatch → reject", badTurn);

  let badExpires = false;
  try {
    applyDeclareDirNaToSession(
      first.session,
      SESSION_ID,
      { ...idempInput, expires_at: "2026-12-31T00:00:00.000Z" },
      NOW,
    );
  } catch (e) {
    badExpires =
      e instanceof NaDeclarationError &&
      String(e.message).includes("idempotent_expires_mismatch");
  }
  assert("expires_at mismatch → reject", badExpires);

  const sameAgain = applyDeclareDirNaToSession(
    first.session,
    SESSION_ID,
    idempInput,
    NOW,
  );
  assert(
    "identical payload replay still → idempotent_skip",
    sameAgain.outcome === "idempotent_skip",
  );
}

console.log("\n== P0-2 Topic authority (eval_id + catalog version) ==");
{
  const topicNa: ExplicitNaEvidence = {
    evidence_id: "na-topic",
    target: "dir",
    dir_id: SSOT_DIR,
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
    "topic with live authority → accept",
    validateExplicitNaEvidence(topicNa, provenNaValidation()).ok,
  );
  assert(
    "forged eval_id → reject",
    !validateExplicitNaEvidence(
      topicNa,
      provenNaValidation({
        topicRules: [topicRule({ evaluation: { eval_id: "forged-id" } })],
      }),
    ).ok,
  );
  assert(
    "catalog version mismatch → reject",
    !validateExplicitNaEvidence(
      topicNa,
      provenNaValidation({
        currentTopicCatalogVersion: "topic-cat-v2",
      }),
    ).ok,
  );
  assert(
    "authority stale → reject",
    !validateExplicitNaEvidence(
      topicNa,
      provenNaValidation({
        topicEvalAuthority: [authorityTopic({ record_status: "stale" })],
      }),
    ).ok,
  );
  assert(
    "authority superseded → reject",
    !validateExplicitNaEvidence(
      topicNa,
      provenNaValidation({
        topicEvalAuthority: [authorityTopic({ record_status: "superseded" })],
      }),
    ).ok,
  );
  assert(
    "authority revoked → reject",
    !validateExplicitNaEvidence(
      topicNa,
      provenNaValidation({
        topicEvalAuthority: [authorityTopic({ record_status: "revoked" })],
      }),
    ).ok,
  );
  assert(
    "authority other DIR → reject",
    !validateExplicitNaEvidence(
      topicNa,
      provenNaValidation({
        topicEvalAuthority: [authorityTopic({ target_dir_id: "DIR-B" })],
      }),
    ).ok,
  );
  assert(
    "authority still applicable → reject",
    !validateExplicitNaEvidence(
      topicNa,
      provenNaValidation({
        topicEvalAuthority: [authorityTopic({ not_applicable: false })],
      }),
    ).ok,
  );
  assert(
    "authority expired → reject",
    !validateExplicitNaEvidence(
      topicNa,
      provenNaValidation({
        nowIso: "2027-01-01T00:00:00.000Z",
        topicEvalAuthority: [authorityTopic({ expires_at: TOPIC_EXPIRY })],
      }),
    ).ok,
  );
  assert(
    "missing authority store → reject",
    !validateExplicitNaEvidence(
      topicNa,
      provenNaValidation({ topicEvalAuthority: undefined }),
    ).ok,
  );
  assert(
    "embedded status current but no authority → reject",
    !validateExplicitNaEvidence(
      topicNa,
      provenNaValidation({
        topicRules: [topicRule()],
        topicEvalAuthority: [],
      }),
    ).ok,
  );
}

console.log("\n== System N/A / DDR-03 / DIR / Planner / C5 ==");
{
  // Correlate DIR under test with provenNaValidation / validCatalogNa SSOT pair.
  const dirs = reaggregateDirsIntake(
    [baseDir({ dir_id: SSOT_DIR })],
    [],
    [],
    [],
    [validCatalogNa()],
    provenNaValidation(),
  );
  assert("MX-119 catalog N/A → n_a", dirs[0]!.current_state === "n_a");
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
    emptyNaValidation({
      contextId: CTX,
      sessionId: SESSION_ID,
      cfpSourceState: "source_calc_failed",
    }),
  );
  assert("MX-112 calc_failed → reject", !bad.ok);
}
{
  const session = baseSession({
    decision_context: baseDc({
      dirs: [baseDir({ current_state: "unknown" })],
      reality_facts: [fact({ fact_id: "f1" })],
      constraints: [],
    }),
  });
  const planned = selectNextIntakeAskForSession({ session, nowIso: NOW });
  assert(
    "production planner chain",
    planned.production_call_chain === INTAKE_ASK_SCORING_PATH,
  );
  assert(
    "source_only unresolved=0",
    selectNextIntakeAskForSession({
      session,
      nowIso: NOW,
      extraCandidates: [
        {
          candidate_id: "cq_src",
          kind: "source_only",
          dir_ids: [],
          ddr_ids: ["DDR-03"],
          fact_role_codes: ["v1/source/cfp.birth"],
          source_code: "cfp.birth",
          impact: {
            decision_critical: true,
            may_affect_p5_ranking: false,
            gate_class: "P0",
          },
          depth: 0,
          repetition_count: 0,
          budget_cost: 1,
        },
      ],
      p0SourceNotOk: true,
    }).selected?.score.unresolved_count === 0,
  );
}
{
  const facts = [fact({ fact_id: "f1" })];
  const constraints = [constraint({ constraint_id: "k1" })];
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
  const { role_states } = computeUnresolvedCount(candidate, {
    dirs: [dir],
    reality_facts: facts,
    constraints,
    conflicts: [],
  });
  const agg = aggregateDirStateIntake(
    dir,
    facts,
    [],
    constraints,
    [],
    emptyNaValidation({ contextId: CTX, sessionId: SESSION_ID }),
  );
  assert(
    "Planner/Aggregator match",
    plannerAggregatorRoleMismatches({
      dir,
      plannerRoleStates: role_states,
      aggregatorRoleStates: agg.role_states,
    }).length === 0,
  );
}
{
  assert("illegal expires_at → invalid", checkExpiresAt("bad", NOW) === "invalid");
  const dc = baseDc({ reality_facts: [], constraints: [constraint({ constraint_id: "k1" })] });
  const h1 = computeContentHash(dc);
  const h2 = computeContentHash({ ...dc, explicit_na_evidence: [validCatalogNa()] });
  assert("MX-121 N/A changes hash", h1 !== h2);
  // Direct create unit test: injected dirNaConditions ≠ production Catalog authority.
  const created = createExplicitNaClassificationFromUserDeclaration({
    action: {
      declaration_action_id: "h",
      session_id: SESSION_ID,
      context_id: CTX,
      actor: "user",
      control_id: "na_declare",
      source_ref: { kind: "reality_fact", fact_id: "f1" },
      dir_id: "DIR-A",
      na_condition_code: VALID_NA_CODE,
      declaration_turn_id: "t",
      occurred_at: NOW,
      revoked: false,
      expires_at: null,
    },
    dc: baseDc(),
    nowIso: NOW,
    dirNaConditions: [VALID_NA_CODE],
  });
  assert("classification hash fixture", created.ok);
  if (created.ok) {
    assert(
      "classification changes hash",
      h1 !==
        computeContentHash({
          ...dc,
          explicit_na_classifications: [created.classification],
        }),
    );
  }
}

console.log("");
if (failures.length) {
  console.error(`FAILED ${failures.length}:`, failures);
  process.exit(1);
}
console.log("All Intake R6 Stage 3.2 round-6 acceptance checks passed.");
