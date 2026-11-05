/**
 * Stage 3.2 vertical slice — R6 Final Binding role resolver + Intake aggregator.
 *   pnpm exec tsx scripts/test-intake-r6-role-resolver.ts
 *
 * Covers core MX-83…127 semantics (AND association, Scheme A Constraint,
 * DIR-level N/A, hash inclusion). Not a full matrix runner.
 */
import { computeContentHash } from "@/lib/poju/decision-context/content-hash";
import { reaggregateDirsIntake } from "@/lib/poju/decision-context/dir-aggregator-intake";
import { validateExplicitNaEvidence } from "@/lib/poju/decision-context/explicit-na-validate";
import {
  resolveDirRoleEvidence,
  unresolvedRoleCountForCandidate,
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
  });
  assert("MX-84 DIR link without role tag → unresolved", r.state === "unresolved");
}
{
  const r = resolveDirRoleEvidence({
    dir,
    roleCode: "situation",
    realityFacts: [fact({ fact_id: "f1" })],
    constraints: [],
    explicitNaEvidence: [],
    conflicts: [],
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
  });
  assert("partial unverified+user_asserted → partial", r.state === "partial");
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
  });
  assert("MX-90 hard_constraint confirmed", r.state === "confirmed");
}
{
  const r = resolveDirRoleEvidence({
    dir,
    roleCode: "soft_constraint",
    realityFacts: [],
    constraints: [
      constraint({ constraint_id: "k1", rigidity: "soft" }),
    ],
    explicitNaEvidence: [],
    conflicts: [],
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
  });
  assert("MX-92 rigidity mismatch → unresolved", r.state === "unresolved");
}
{
  const r = resolveDirRoleEvidence({
    dir,
    roleCode: "hard_constraint",
    realityFacts: [],
    constraints: [
      constraint({ constraint_id: "k1", related_dir_ids: undefined }),
    ],
    explicitNaEvidence: [],
    conflicts: [],
  });
  assert("MX-93 missing related_dir_ids → unresolved", r.state === "unresolved");
}

console.log("\n== MX DIR-level N/A ==");
const na: ExplicitNaEvidence = {
  evidence_id: "na1",
  target: "dir",
  dir_id: "DIR-A",
  na_condition_code: "explicit_not_applicable",
  evidence_type: "system_na_marker",
  system_basis: {
    kind: "catalog_na_condition_met",
    target_dir_id: "DIR-A",
    condition_eval_id: "ev1",
  },
  written_by: "code",
  revoked: false,
};
{
  const r = resolveDirRoleEvidence({
    dir,
    roleCode: "situation",
    realityFacts: [],
    constraints: [],
    explicitNaEvidence: [na],
    conflicts: [],
  });
  assert("DIR-level N/A derives role n_a", r.state === "n_a");
}
{
  const dirs = reaggregateDirsIntake(
    [dir],
    [],
    [],
    [],
    [na],
  );
  assert("MX-119 DIR aggregate → n_a", dirs[0]!.current_state === "n_a");
}
{
  const dirs = reaggregateDirsIntake(
    [dir],
    [fact({ fact_id: "f1" })],
    [],
    [],
    [],
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
  );
  assert("all roles confirmed → known", dirs[0]!.current_state === "known");
}

console.log("\n== Planner unresolved_count ==");
{
  const n = unresolvedRoleCountForCandidate({
    factRoleCodes: [
      "v1/dir/DIR-A/role/situation",
      "v1/dir/DIR-A/role/situation",
      "v1/dir/DIR-A/role/hard_constraint",
    ],
    dirsById: new Map([["DIR-A", dir]]),
    realityFacts: [fact({ fact_id: "f1" })],
    constraints: [],
    explicitNaEvidence: [],
    conflicts: [],
  });
  assert("MX-99 dedupe + one unresolved hard_constraint → 1", n === 1);
}

console.log("\n== N/A validator E1 / DDR-03 ==");
{
  const bad = validateExplicitNaEvidence(
    {
      evidence_id: "na2",
      target: "dir",
      dir_id: "DIR-A",
      na_condition_code: "x",
      evidence_type: "user_explicit_na",
      source_ref: { kind: "reality_fact", fact_id: "f1" },
      written_by: "code",
      revoked: false,
    },
    {
      realityFacts: [
        fact({
          fact_id: "f1",
          verification_level: "independently_verified",
          user_confirmed: false,
        }),
      ],
      constraints: [],
      confirmationEvents: [],
    },
  );
  assert("MX-102 independently_verified → reject", !bad.ok);
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
  assert("MX-121 adding ExplicitNaEvidence changes hash", h1 !== h2);
  assert("MX-123 related_dir_ids change changes hash", h1 !== h3);
}

console.log("");
if (failures.length) {
  console.error(`FAILED ${failures.length}:`, failures);
  process.exit(1);
}
console.log("All Intake R6 vertical-slice checks passed.");
