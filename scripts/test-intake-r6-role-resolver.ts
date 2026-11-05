/**
 * Stage 3.2 acceptance round-2 — N/A classification, topic DIR scope, production planner.
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
} from "@/lib/poju/decision-context/explicit-na-validate";
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
  ExplicitNaClassification,
  ExplicitNaEvidence,
  RealityFact,
} from "@/lib/poju/decision-context/types";
import type { ConfirmationEvent } from "@/lib/poju/decision-context/confirmation-event";

const failures: string[] = [];
const assert = (label: string, ok: boolean) => {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
};

const CTX = "dc-test-1";
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

function classification(
  partial: Partial<ExplicitNaClassification> = {},
): ExplicitNaClassification {
  return {
    classification_id: "cls-1",
    context_id: CTX,
    source_ref: { kind: "reality_fact", fact_id: "f1" },
    dir_id: "DIR-A",
    na_condition_code: VALID_NA_CODE,
    authority: "user_declared",
    written_by: "code",
    declaration_action_id: "na-decl-1",
    declaration_turn_id: "t-na-1",
    revoked: false,
    expires_at: null,
    created_at: NOW,
    ...partial,
  };
}

function userNaEvidence(
  overrides: Partial<ExplicitNaEvidence> = {},
): ExplicitNaEvidence {
  return {
    evidence_id: "na-user-1",
    target: "dir",
    dir_id: "DIR-A",
    na_condition_code: VALID_NA_CODE,
    evidence_type: "user_explicit_na",
    source_ref: { kind: "reality_fact", fact_id: "f1" },
    written_by: "code",
    revoked: false,
    ...overrides,
  } as ExplicitNaEvidence;
}

function validCatalogNa(
  overrides: Partial<ExplicitNaEvidence> & { evidence_id?: string } = {},
): ExplicitNaEvidence {
  return {
    evidence_id: overrides.evidence_id ?? "na1",
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
    ...overrides,
  } as ExplicitNaEvidence;
}

function provenNaValidation(
  overrides: Partial<NaValidationContext> = {},
): NaValidationContext {
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
    topicRules: [
      {
        rule_id: "rule-topic-1",
        topic_code: "topic.x",
        target_dir_id: "DIR-A",
        not_applicable_for_dir: true,
      },
    ],
    realityFacts: [fact({ fact_id: "f1" })],
    confirmationEvents: [e1Fact("f1")],
    explicitNaClassifications: [classification()],
    ...overrides,
  });
}

const dir = baseDir();

console.log("\n== MX association / Fact + P0-1 user_confirmed ==");
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
  assert("confirmed+user_asserted+user_confirmed=true → confirmed", r.state === "confirmed");
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
  assert(
    "confirmed+user_asserted+user_confirmed=false → NOT confirmed",
    r.state === "unresolved",
  );
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
    naValidation: emptyNaValidation({ contextId: CTX }),
  });
  assert("independently_verified+user_confirmed=false → confirmed", r.state === "confirmed");
}

console.log("\n== P0-1 ExplicitNaClassification (not E1 alone) ==");
{
  const evidence = userNaEvidence();
  const e1Only = provenNaValidation({ explicitNaClassifications: [] });
  const bad = validateExplicitNaEvidence(evidence, e1Only);
  assert(
    "E1 present but no ExplicitNaClassification → reject",
    !bad.ok && bad.reason_code === "explicit_na_classification_missing",
  );
}
{
  const evidence = userNaEvidence();
  const wrongFact = provenNaValidation({
    explicitNaClassifications: [
      classification({
        source_ref: { kind: "reality_fact", fact_id: "OTHER" },
      }),
    ],
  });
  const bad = validateExplicitNaEvidence(evidence, wrongFact);
  assert("classification for other Fact → reject", !bad.ok);
}
{
  const evidence = userNaEvidence();
  const wrongDir = provenNaValidation({
    explicitNaClassifications: [classification({ dir_id: "DIR-B" })],
  });
  const bad = validateExplicitNaEvidence(evidence, wrongDir);
  assert("classification for other DIR → reject", !bad.ok);
}
{
  const evidence = userNaEvidence();
  const revoked = provenNaValidation({
    explicitNaClassifications: [classification({ revoked: true })],
  });
  const bad = validateExplicitNaEvidence(evidence, revoked);
  assert("revoked classification → reject", !bad.ok);
}
{
  const evidence = userNaEvidence();
  const expired = provenNaValidation({
    nowIso: "2026-12-01T00:00:00.000Z",
    explicitNaClassifications: [
      classification({ expires_at: "2026-11-10T00:00:00.000Z" }),
    ],
  });
  const bad = validateExplicitNaEvidence(evidence, expired);
  assert("expired classification → reject", !bad.ok);
}
{
  const evidence = userNaEvidence();
  const ok = validateExplicitNaEvidence(evidence, provenNaValidation());
  assert("full legal user_explicit_na + classification → accept", ok.ok);
  const dirs = reaggregateDirsIntake(
    [dir],
    [fact({ fact_id: "f1" })],
    [],
    [],
    [evidence],
    provenNaValidation(),
  );
  assert("validated user_explicit_na → DIR n_a", dirs[0]!.current_state === "n_a");
}

console.log("\n== P0-2 TopicApplicabilityRule DIR scope ==");
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
  const ok = validateExplicitNaEvidence(topicNa, provenNaValidation());
  assert("topic rule with matching target_dir_id → accept", ok.ok);

  const otherDir = provenNaValidation({
    topicRules: [
      {
        rule_id: "rule-topic-1",
        topic_code: "topic.x",
        target_dir_id: "DIR-B",
        not_applicable_for_dir: true,
      },
    ],
  });
  const badDir = validateExplicitNaEvidence(topicNa, otherDir);
  assert("topic rule for other DIR → reject", !badDir.ok);

  const stale = provenNaValidation({
    topicRules: [
      {
        rule_id: "rule-topic-1",
        topic_code: "topic.x",
        target_dir_id: "DIR-A",
        not_applicable_for_dir: true,
        stale: true,
      },
    ],
  });
  const badStale = validateExplicitNaEvidence(topicNa, stale);
  assert("topic rule stale → reject", !badStale.ok);

  const applicable = provenNaValidation({
    topicRules: [
      {
        rule_id: "rule-topic-1",
        topic_code: "topic.x",
        target_dir_id: "DIR-A",
        not_applicable_for_dir: false,
      },
    ],
  });
  const badApp = validateExplicitNaEvidence(topicNa, applicable);
  assert("topic re-eval applicable → reject", !badApp.ok);
}

console.log("\n== System N/A + association smoke ==");
{
  const na = validCatalogNa();
  const dirs = reaggregateDirsIntake([dir], [], [], [], [na], provenNaValidation());
  assert("MX-119 validated catalog N/A → n_a", dirs[0]!.current_state === "n_a");
}
{
  const na = validCatalogNa();
  const dirs = reaggregateDirsIntake(
    [dir],
    [],
    [],
    [],
    [na],
    emptyNaValidation({ contextId: CTX }),
  );
  assert("unproven system N/A → NOT n_a", dirs[0]!.current_state !== "n_a");
}
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
    roleCode: "hard_constraint",
    realityFacts: [],
    constraints: [constraint({ constraint_id: "k1" })],
    explicitNaEvidence: [],
    conflicts: [],
    naValidation: emptyNaValidation({ contextId: CTX }),
  });
  assert("MX-90 hard_constraint confirmed", r.state === "confirmed");
}

console.log("\n== P1-1 Production planner path (planNextAskFromCandidates) ==");
{
  const snap = {
    dirs: [dir],
    reality_facts: [fact({ fact_id: "f1" })],
    constraints: [] as Constraint[],
    conflicts: [],
    explicit_na_evidence: [] as ExplicitNaEvidence[],
  };
  const dirBased = {
    candidate_id: "cq_dir",
    kind: "dir_based" as const,
    dir_ids: ["DIR-A"],
    ddr_ids: ["DDR-01"],
    fact_role_codes: [
      "v1/dir/DIR-A/role/situation",
      "v1/dir/DIR-A/role/hard_constraint",
    ],
    impact: {
      decision_critical: false,
      may_affect_p5_ranking: false,
      gate_class: "P1" as const,
    },
    depth: 1,
    repetition_count: 0,
    budget_cost: 1,
  };
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

  const result = planNextAskFromCandidates({
    candidates: [dirBased, sourceOnly],
    snap,
    remaining_hard_budget: 15,
    p0SourceNotOk: true,
  });

  assert(
    "production scoring_path is shared resolver chain",
    result.scoring_path === "scorePlanningCandidate→resolveDirRoleEvidence",
  );
  assert("production ranks ≥2 candidates", result.ranked.length === 2);

  const dirScore = result.ranked.find((r) => r.candidate.candidate_id === "cq_dir")!;
  const srcScore = result.ranked.find((r) => r.candidate.candidate_id === "cq_src")!;
  assert(
    "dir_based unresolved via shared resolver (hard_constraint missing) → 1",
    dirScore.score.unresolved_count === 1,
  );
  assert(
    "source_only unresolved_count remains 0",
    srcScore.score.unresolved_count === 0,
  );
  assert("source_only gap_type source_pending", srcScore.score.gap_type === "source_pending");
  // P0 source_only should sort ahead of P1 dir_based
  assert(
    "production select prefers P0 source_only",
    result.selected?.candidate.candidate_id === "cq_src",
  );

  // Prove shared AND semantics: role tag without related_dir_ids does not resolve
  const andSnap = {
    ...snap,
    reality_facts: [fact({ fact_id: "f1", related_dir_ids: undefined })],
  };
  const andResult = planNextAskFromCandidates({
    candidates: [dirBased],
    snap: andSnap,
    remaining_hard_budget: 15,
  });
  assert(
    "production path uses AND association (no related_dir_ids → both roles unresolved)",
    andResult.ranked[0]!.score.unresolved_count === 2,
  );
}

console.log("\n== P1-2 Planner/Aggregator consistency ==");
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
    candidate_id: "c-consistent",
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
  const { role_states: plannerRoles } = computeUnresolvedCount(candidate, snap);
  const agg = aggregateDirStateIntake(
    dir,
    facts,
    [],
    constraints,
    [],
    emptyNaValidation({ contextId: CTX, realityFacts: facts, constraints }),
  );
  const mismatches = plannerAggregatorRoleMismatches({
    dir,
    plannerRoleStates: plannerRoles,
    aggregatorRoleStates: agg.role_states,
  });
  assert("Planner/Aggregator identical role states", mismatches.length === 0);
}

console.log("\n== C5 hash ==");
{
  const emptyDef = {
    concrete_event: null,
    stakes: null,
    desired_outcome: null,
    decision_question: null,
    goal_priorities: [] as string[],
    unacceptable_outcomes: [] as string[],
  };
  const baseDc: DecisionContext = {
    context_id: CTX,
    version: 1,
    status: "draft",
    definition: emptyDef,
    reality_facts: [],
    constraints: [constraint({ constraint_id: "k1" })],
    hypotheses: [],
    dirs: [dir],
    conflicts: [],
    content_hash: null,
    created_at: "t",
    updated_at: "t",
  };
  const h1 = computeContentHash(baseDc);
  const h2 = computeContentHash({
    ...baseDc,
    explicit_na_evidence: [validCatalogNa()],
  });
  const h3 = computeContentHash({
    ...baseDc,
    constraints: [
      constraint({ constraint_id: "k1", related_dir_ids: ["DIR-A", "DIR-B"] }),
    ],
  });
  const h4 = computeContentHash({
    ...baseDc,
    explicit_na_classifications: [classification()],
  });
  assert("MX-121 ExplicitNaEvidence changes hash", h1 !== h2);
  assert("MX-123 related_dir_ids change changes hash", h1 !== h3);
  assert("ExplicitNaClassification changes hash", h1 !== h4);
}

console.log("\n== DDR-03 / E1 smoke ==");
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
      cfpSourceState: "source_calc_failed",
    }),
  );
  assert("MX-112 calc_failed → reject", !bad.ok && bad.reason_code.includes("calc"));
}

console.log("");
if (failures.length) {
  console.error(`FAILED ${failures.length}:`, failures);
  process.exit(1);
}
console.log("All Intake R6 Stage 3.2 round-2 acceptance checks passed.");
