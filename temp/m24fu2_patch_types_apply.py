from pathlib import Path

ROOT = Path(r"D:\POJU\pojulife")

# ---- types.ts ----
types_path = ROOT / "lib/poju/decision-intake/types.ts"
types = types_path.read_text(encoding="utf-8")
old_plan = """export type AdaptiveQuestionPlan = {
  plan_id: string;
  candidate_id: string;
  direction_id: string;
  ddr_ids: string[];
  dir_ids: string[];
  fact_role_codes: string[];
  missing_info: string;
  decision_value: string;
  ask_now_reason: string;
  expected_info: string;
  depth: number;
  budget_cost: number;
  remaining_hard_budget: number;
  gate_class: "P0" | "P1" | "P2";
  scope_boundary: string;
  rationale: string;
  question_text: string;
  built_at: string;
  scoring_path: string;
};"""
new_plan = """export type ConflictClarificationTarget = {
  conflict_id: string;
  fact_ids: string[];
};

export type AdaptiveQuestionPlan = {
  plan_id: string;
  candidate_id: string;
  direction_id: string;
  ddr_ids: string[];
  dir_ids: string[];
  fact_role_codes: string[];
  missing_info: string;
  decision_value: string;
  ask_now_reason: string;
  expected_info: string;
  depth: number;
  budget_cost: number;
  remaining_hard_budget: number;
  gate_class: "P0" | "P1" | "P2";
  scope_boundary: string;
  rationale: string;
  question_text: string;
  built_at: string;
  scoring_path: string;
  /** Exact Conflict addressed by this plan, if any. Scheduling metadata only. */
  conflict_clarification?: ConflictClarificationTarget | null;
};"""
if old_plan not in types:
    raise SystemExit("AdaptiveQuestionPlan block not found")
if "export type ConflictClarificationTarget" not in types:
    types = types.replace(old_plan, new_plan, 1)

old_last = """  last_sent_question: {
    question_text: string;
    plan_id: string;
    direction_id: string;
    dir_ids: string[];
    ddr_ids: string[];
    /** Roles authorized by the actually-sent Plan; optional on historical sessions. */
    fact_role_codes?: string[];
    turn_id: string;
  } | null;"""
new_last = """  last_sent_question: {
    question_text: string;
    plan_id: string;
    direction_id: string;
    dir_ids: string[];
    ddr_ids: string[];
    /** Roles authorized by the actually-sent Plan; optional on historical sessions. */
    fact_role_codes?: string[];
    turn_id: string;
    /** Exact Conflict addressed by this actually-sent question. */
    conflict_clarification?: ConflictClarificationTarget | null;
  } | null;"""
if old_last not in types:
    raise SystemExit("last_sent_question block not found")
if "conflict_clarification?: ConflictClarificationTarget" not in types[types.find("last_sent_question"):types.find("last_sent_question")+800]:
    types = types.replace(old_last, new_last, 1)
types_path.write_text(types, encoding="utf-8", newline="\n")
print("patched types.ts")

# ---- apply-answer-to-dc.ts ----
apply_path = ROOT / "lib/poju/decision-intake/apply-answer-to-dc.ts"
apply = apply_path.read_text(encoding="utf-8")
old_find = """function findRelatedOldFacts(
  reality_facts: RealityFact[],
  relatedDirIds: string[],
  factRoles: string[],
): RealityFact[] {
  return reality_facts.filter((f) => {
    const dirs = f.related_dir_ids ?? [];
    const dirHit = relatedDirIds.some((d) => dirs.includes(d));
    if (!dirHit) return false;
    return rolesOverlap(f.fact_roles, factRoles);
  });
}"""
new_find = """function findRelatedOldFacts(
  realityFacts: RealityFact[],
  relatedDirIds: string[],
  factRoles: string[],
): RealityFact[] {
  return realityFacts.filter((fact) => {
    // Unknown / declined / not_applicable are not propositions
    // and cannot be used as the opposing side of a Conflict.
    if (
      fact.status === "unknown" ||
      fact.status === "declined" ||
      fact.status === "not_applicable"
    ) {
      return false;
    }

    const dirs = fact.related_dir_ids ?? [];
    if (!relatedDirIds.some((dirId) => dirs.includes(dirId))) {
      return false;
    }

    // Require an actual shared role for conflict evidence.
    // Missing historical role metadata is insufficient evidence.
    const oldRoles = fact.fact_roles ?? [];
    if (oldRoles.length === 0 || factRoles.length === 0) {
      return false;
    }

    return oldRoles.some((role) => factRoles.includes(role));
  });
}"""
if old_find not in apply:
    raise SystemExit("findRelatedOldFacts not found")
apply = apply.replace(old_find, new_find, 1)
# call site still passes reality_facts variable - parameter rename is internal only
if "findRelatedOldFacts(\n          reality_facts," not in apply:
    raise SystemExit("findRelatedOldFacts call site missing")
apply_path.write_text(apply, encoding="utf-8", newline="\n")
print("patched apply-answer-to-dc.ts")
print("ok")
