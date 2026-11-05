/**
 * Stage 3.2 acceptance — R6 Final Binding role resolver + Intake aggregator + Planner.
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
import {
  computeUnresolvedCount,
  plannerAggregatorRoleMismatches,
  scorePlanningCandidate,
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

const failures: string[] = [];
const assert = (label: string, ok: boolean) => {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
};

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

const VALID_NA_CODE = "explicit_not_applicable";

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
    dirCatalog: [
      { dir_id: "DIR-A", na_conditions: [VALID_NA_CODE, "topic_na"] },
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
        not_applicable_for_dir: true,
      },
    ],
    ...overrides,
  });
}

const dir = baseDir();

console.log("\n== MX association / Fact ==");
{
  const r = resolveDirRoleEvidence({
    dir,
    roleCode: "situation",
    realityFacts: [fact({ fact_id: "f1", related_dir_ids: undefined })],
    constraints: [],
    explicitNaEvidence: [],
    conflicts: [],
    naValidation: emptyNaValidation(),
  });
  assert("MX-83 role tag without related_dir_ids → unresolved", r.state === "unresolved");
}
{
  const r = resolveDirRoleEvidence({
    dir,
    roleCode: "situation",
    realityFacts: [
      fact({ fact_id: "f1", fact_roles: undefined, related_dir_ids: ["DIR-A"] }),
    ],
    constraints: [],
    explicitNaEvidence: [],
    conflicts: [],
    naValidation: emptyNaValidation(),
  });
  assert("MX-84 DIR link without role tag → unresolved", r.state === "unresolved");
}
{
  const r = resolveDirRoleEvidence({
    dir,
    roleCode: "situation",
    realityFacts: [fact({ fact_id: "f1", user_confirmed: true })],
    constraints: [],
    explicitNaEvidence: [],
    conflicts: [],
    naValidation: emptyNaValidation(),
  });
  assert("MX-85 exact pair → confirmed", r.state === "confirmed");
}
{
  const r = resolveDirRoleEvidence({
    dir: baseDir({ dir_id: "DIR-B", required_fact_roles: ["situation"] }),
    roleCode: "situation",
    realityFacts: [fact({ fact_id: "f1", related_dir_ids: ["DIR-A"] })],
    constraints: [],
    explicitNaEvidence: [],
    conflicts: [],
    naValidation: emptyNaValidation(),
  });
  assert("MX-86 wrong DIR → unresolved", r.state === "unresolved");
}
{
  const r = resolveDirRoleEvidence({
    dir,
    roleCode: "situation",
    realityFacts: [
      fact({
        fact_id: "f1",
        status: "unverified",
        verification_level: "user_asserted",
        user_confirmed: true,
      }),
    ],
    constraints: [],
    explicitNaEvidence: [],
    conflicts: [],
    naValidation: emptyNaValidation(),
  });
  assert("partial unverified+user_asserted → partial", r.state === "partial");
}

console.log("\n== P0-1 user_confirmed / independently_verified ==");
{
  const r = resolveDirRoleEvidence({
    dir,
    roleCode: "situation",
    realityFacts: [
      fact({
        fact_id: "f1",
        status: "confirmed",
        verification_level: "user_asserted",
        user_confirmed: true,
      }),
    ],
    constraints: [],
    explicitNaEvidence: [],
    conflicts: [],
    naValidation: emptyNaValidation(),
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
    naValidation: emptyNaValidation(),
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
        status: "confirmed",
        verification_level: "independently_verified",
        user_confirmed: false,
      }),
    ],
    constraints: [],
    explicitNaEvidence: [],
    conflicts: [],
    naValidation: emptyNaValidation(),
  });
  assert(
    "confirmed+independently_verified+user_confirmed=false → confirmed",
    r.state === "confirmed",
  );
}
{
  const r = resolveDirRoleEvidence({
    dir,
    roleCode: "situation",
    realityFacts: [
      fact({
        fact_id: "f1",
        status: "confirmed",
        verification_level: "independently_verified",
        user_confirmed: true,
      }),
    ],
    constraints: [],
    explicitNaEvidence: [],
    conflicts: [],
    naValidation: emptyNaValidation(),
  });
  assert(
    "independently_verified must keep user_confirmed=false (corrupt → reject)",
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
        status: "confirmed",
        verification_level: "user_estimate" as RealityFact["verification_level"],
        user_confirmed: true,
      }),
    ],
    constraints: [],
    explicitNaEvidence: [],
    conflicts: [],
    naValidation: emptyNaValidation(),
  });
  assert("illegal confirmed+user_estimate → unresolved", r.state === "unresolved");
}

console.log("\n== MX Constraint Scheme A ==");
{
  const r = resolveDirRoleEvidence({
    dir,
    roleCode: "hard_constraint",
    realityFacts: [],
    constraints: [constraint({ constraint_id: "k1", rigidity: "hard" })],
    explicitNaEvidence: [],
    conflicts: [],
    naValidation: emptyNaValidation(),
  });
  assert("MX-90 hard_constraint confirmed", r.state === "confirmed");
}
{
  const r = resolveDirRoleEvidence({
    dir,
    roleCode: "soft_constraint",
    realityFacts: [],
    constraints: [constraint({ constraint_id: "k1", rigidity: "soft" })],
    explicitNaEvidence: [],
    conflicts: [],
    naValidation: emptyNaValidation(),
  });
  assert("MX-91 soft_constraint confirmed", r.state === "confirmed");
}
{
  const r = resolveDirRoleEvidence({
    dir,
    roleCode: "hard_constraint",
    realityFacts: [],
    constraints: [constraint({ constraint_id: "k1", rigidity: "soft" })],
    explicitNaEvidence: [],
    conflicts: [],
    naValidation: emptyNaValidation(),
  });
  assert("MX-92 rigidity mismatch → unresolved", r.state === "unresolved");
}
{
  const r = resolveDirRoleEvidence({
    dir,
    roleCode: "hard_constraint",
    realityFacts: [],
    constraints: [constraint({ constraint_id: "k1", related_dir_ids: undefined })],
    explicitNaEvidence: [],
    conflicts: [],
    naValidation: emptyNaValidation(),
  });
  assert("MX-93 missing related_dir_ids → unresolved", r.state === "unresolved");
}

console.log("\n== P0-2 DIR-level N/A full validation ==");
const na = validCatalogNa();
const proven = provenNaValidation();
{
  const r = resolveDirRoleEvidence({
    dir,
    roleCode: "situation",
    realityFacts: [],
    constraints: [],
    explicitNaEvidence: [na],
    conflicts: [],
    naValidation: proven,
  });
  assert("validated DIR-level N/A derives role n_a", r.state === "n_a");
}
{
  const dirs = reaggregateDirsIntake([dir], [], [], [], [na], proven);
  assert("MX-119 validated DIR aggregate → n_a", dirs[0]!.current_state === "n_a");
}
{
  // Surface-only system marker without catalog proof must NOT flip DIR to n_a
  const dirs = reaggregateDirsIntake(
    [dir],
    [],
    [],
    [],
    [na],
    emptyNaValidation(), // no catalog proofs
  );
  assert(
    "unproven system N/A (written_by=code only) → NOT n_a",
    dirs[0]!.current_state !== "n_a",
  );
}
{
  const revoked = validCatalogNa({ revoked: true, evidence_id: "na-rev" });
  const dirs = reaggregateDirsIntake([dir], [], [], [], [revoked], proven);
  assert("revoked N/A → NOT n_a", dirs[0]!.current_state !== "n_a");
}
{
  const mismatched: ExplicitNaEvidence = {
    evidence_id: "na-wrong",
    target: "dir",
    dir_id: "DIR-B",
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
  const v = validateExplicitNaEvidence(
    mismatched,
    provenNaValidation({
      dirCatalog: [
        { dir_id: "DIR-A", na_conditions: [VALID_NA_CODE] },
        { dir_id: "DIR-B", na_conditions: [VALID_NA_CODE] },
      ],
    }),
  );
  assert("mismatched target_dir_id vs evidence.dir_id → reject", !v.ok);
}
{
  const staleCtx = provenNaValidation({
    catalogConditionEvals: [
      {
        condition_eval_id: "ev1",
        target_dir_id: "DIR-A",
        na_condition_code: VALID_NA_CODE,
        condition_met: true,
        stale: true,
      },
    ],
  });
  const dirs = reaggregateDirsIntake([dir], [], [], [], [na], staleCtx);
  assert("stale catalog eval → NOT n_a", dirs[0]!.current_state !== "n_a");
}
{
  const unmet = provenNaValidation({
    catalogConditionEvals: [
      {
        condition_eval_id: "ev1",
        target_dir_id: "DIR-A",
        na_condition_code: VALID_NA_CODE,
        condition_met: false,
      },
    ],
  });
  const dirs = reaggregateDirsIntake([dir], [], [], [], [na], unmet);
  assert("catalog condition_met=false → NOT n_a", dirs[0]!.current_state !== "n_a");
}
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
  const ok = validateExplicitNaEvidence(topicNa, proven);
  assert("topic_not_applicable with live rule → accept", ok.ok);
  const stillApplicable = provenNaValidation({
    topicRules: [
      {
        rule_id: "rule-topic-1",
        topic_code: "topic.x",
        not_applicable_for_dir: false,
      },
    ],
  });
  const bad = validateExplicitNaEvidence(topicNa, stillApplicable);
  assert("topic still applicable → reject", !bad.ok);
}
{
  const dirs = reaggregateDirsIntake(
    [dir],
    [fact({ fact_id: "f1" })],
    [],
    [],
    [],
    emptyNaValidation(),
  );
  assert(
    "MX-118 without DIR-level N/A → not n_a (roles incomplete)",
    dirs[0]!.current_state === "unknown",
  );
}
{
  const dirs = reaggregateDirsIntake(
    [baseDir({ required_fact_roles: ["situation"] })],
    [fact({ fact_id: "f1" })],
    [],
    [],
    [],
    emptyNaValidation(),
  );
  assert("all roles confirmed → known", dirs[0]!.current_state === "known");
}

console.log("\n== P1-1 Planner actual path (scorePlanningCandidate) ==");
{
  const candidate: PlanningCandidate = {
    candidate_id: "c-mx99",
    kind: "dir_based",
    dir_ids: ["DIR-A"],
    ddr_ids: ["DDR-01"],
    fact_role_codes: [
      "v1/dir/DIR-A/role/situation",
      "v1/dir/DIR-A/role/situation",
      "v1/dir/DIR-A/role/hard_constraint",
    ],
    impact: {
      decision_critical: false,
      may_affect_p5_ranking: false,
      gate_class: "P1",
    },
  };
  const score = scorePlanningCandidate(candidate, {
    dirs: [dir],
    reality_facts: [fact({ fact_id: "f1" })],
    constraints: [],
    conflicts: [],
    explicit_na_evidence: [],
  });
  assert("MX-99 Planner unresolved_count dedupe → 1", score.unresolved_count === 1);
  assert("Planner gap_type partial (1 resolved + 1 unresolved)", score.gap_type === "partial");
  // gain = 3*unresolved_count + 2(partial) = 5
  assert(
    "Planner gain path = 3*unresolved + partial bonus",
    score.information_gain_est === 5,
  );
}

console.log("\n== P1-2 Planner / Aggregator consistency ==");
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
    emptyNaValidation({ realityFacts: facts, constraints }),
  );
  const mismatches = plannerAggregatorRoleMismatches({
    dir,
    plannerRoleStates: plannerRoles,
    aggregatorRoleStates: agg.role_states,
  });
  assert(
    "Planner/Aggregator identical role states on same DC snapshot",
    mismatches.length === 0,
  );
  assert("Aggregator known when all roles confirmed", agg.current_state === "known");
}

console.log("\n== N/A validator E1 / DDR-03 ==");
{
  const bad = validateExplicitNaEvidence(
    {
      evidence_id: "na2",
      target: "dir",
      dir_id: "DIR-A",
      na_condition_code: VALID_NA_CODE,
      evidence_type: "user_explicit_na",
      source_ref: { kind: "reality_fact", fact_id: "f1" },
      written_by: "code",
      revoked: false,
    },
    provenNaValidation({
      realityFacts: [
        fact({
          fact_id: "f1",
          verification_level: "independently_verified",
          user_confirmed: false,
        }),
      ],
      confirmationEvents: [],
    }),
  );
  assert("MX-102 independently_verified → reject user_explicit_na", !bad.ok);
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
    {
      realityFacts: [],
      constraints: [],
      confirmationEvents: [],
      cfpSourceState: "source_calc_failed",
    },
  );
  assert("MX-112 calc_failed → reject", !bad.ok && bad.reason_code.includes("calc"));
}

console.log("\n== C5 hash includes N/A + Constraint.related_dir_ids ==");
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
    context_id: "c1",
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
    explicit_na_evidence: [na],
  });
  const h3 = computeContentHash({
    ...baseDc,
    constraints: [
      constraint({ constraint_id: "k1", related_dir_ids: ["DIR-A", "DIR-B"] }),
    ],
  });
  const h4 = computeContentHash({
    ...baseDc,
    explicit_na_evidence: [validCatalogNa({ evidence_id: "na-other" })],
  });
  assert("MX-121 adding ExplicitNaEvidence changes hash", h1 !== h2);
  assert("MX-123 related_dir_ids change changes hash", h1 !== h3);
  assert("N/A evidence_id change changes hash", h2 !== h4);
}

console.log("");
if (failures.length) {
  console.error(`FAILED ${failures.length}:`, failures);
  process.exit(1);
}
console.log("All Intake R6 Stage 3.2 acceptance checks passed.");
