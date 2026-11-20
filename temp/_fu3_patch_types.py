from pathlib import Path
p = Path(r"D:\POJU\pojulife\lib\poju\decision-intake\types.ts")
text = p.read_text(encoding="utf-8")

old_reason = '''export type UnresolvedAnswerReason =
  | "unlocated_role_code"
  | "unauthorized_role_code"
  | "illegal_role_code"
  | "unclear_certainty"
  | "estimated_constraint_not_persistable"
  | "missing_authorized_answer_target"
  | "missing_authorized_fact_roles";
'''
new_reason = '''export type UnresolvedAnswerReason =
  | "unlocated_role_code"
  | "unauthorized_role_code"
  | "illegal_role_code"
  | "unclear_certainty"
  | "estimated_constraint_not_persistable"
  | "definition_patch_not_persistable"
  | "missing_authorized_answer_target"
  | "missing_authorized_fact_roles";
'''
assert old_reason in text, "reason union not found"
text = text.replace(old_reason, new_reason)

old_item = '''export type UnresolvedAnswerItem = {
  source_turn_id: string;
  text: string;
  semantic_kind: "reality_fact" | "constraint" | "definition_patch";
  certainty: "explicit" | "estimated" | "unclear";
  reason: UnresolvedAnswerReason;
  /** Actually-sent question plan_id at the time of rejection; empty if none. */
  sent_question_id: string;
  authorized_role_codes: string[];
  raw_role_code_hint?: string | null;
};
'''
new_item = '''export type UnresolvedAnswerItem = {
  /**
   * Stable identity for the whole pending lifecycle.
   * Format: `${source_turn_id}#${extracted_index}`. Never text alone.
   */
  item_id: string;
  source_turn_id: string;
  text: string;
  semantic_kind: "reality_fact" | "constraint" | "definition_patch";
  certainty: "explicit" | "estimated" | "unclear";
  reason: UnresolvedAnswerReason;
  /** Actually-sent question plan_id at the time of rejection; empty if none. */
  sent_question_id: string;
  authorized_role_codes: string[];
  raw_role_code_hint?: string | null;
};
'''
assert old_item in text, "UnresolvedAnswerItem not found"
text = text.replace(old_item, new_item)

old_pending = '''export type PendingAnswerResolutionStatus = "pending";

/**
 * Scheduling state only — never a second Decision Context or fact source.
 * Unresolved items here must not be written as RealityFacts or Constraints
 * until they pass complete role-code authorization.
 */
export type PendingAnswerResolution = {
  status: PendingAnswerResolutionStatus;
  source_turn_id: string;
  original_statement: string;
  original_classification: AnswerClass;
  unresolved_items: UnresolvedAnswerItem[];
  authorized_role_codes: string[];
  sent_question_id: string;
  clarification_plan: AdaptiveQuestionPlan | null;
  clarification_plan_id: string | null;
};
'''
new_pending = '''export type PendingAnswerResolutionStatus = "pending" | "rejected";

/**
 * Auditable refusal of one pending item. Not a known fact and not a DC write.
 */
export type PendingRejectedItem = {
  item_id: string;
  source_turn_id: string;
  text: string;
  semantic_kind: "reality_fact" | "constraint" | "definition_patch";
  certainty: "explicit" | "estimated" | "unclear";
  reason: UnresolvedAnswerReason;
  rejected_at_turn_id: string;
  rejected_statement: string;
};

/**
 * Scheduling state only — never a second Decision Context or fact source.
 * Unresolved items here must not be written as RealityFacts or Constraints
 * until they pass complete role-code / certainty authorization and a legal
 * DC writer path.
 */
export type PendingAnswerResolution = {
  status: PendingAnswerResolutionStatus;
  source_turn_id: string;
  original_statement: string;
  original_classification: AnswerClass;
  unresolved_items: UnresolvedAnswerItem[];
  rejected_items: PendingRejectedItem[];
  authorized_role_codes: string[];
  /** DIR ids authorized by the originally sent question; never widened. */
  authorized_dir_ids: string[];
  sent_question_id: string;
  clarification_plan: AdaptiveQuestionPlan | null;
  clarification_plan_id: string | null;
  /** The single item this pending clarification is currently resolving. */
  resolving_item_id: string | null;
};
'''
assert old_pending in text, "PendingAnswerResolution not found"
text = text.replace(old_pending, new_pending)

p.write_text(text, encoding="utf-8", newline="\n")
print("types.ts patched", p.stat().st_size)
