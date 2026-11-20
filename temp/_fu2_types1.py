from pathlib import Path

# ---- types.ts ----
p = Path("lib/poju/decision-intake/types.ts")
text = p.read_text(encoding="utf-8")

old_event = '''export type AnswerEvent = {
  event_id: string;
  session_id: string;
  client_turn_id: string;
  raw_text: string;
  classification: AnswerClass;
  targets: { dir_ids: string[]; ddr_ids: string[]; direction_id?: string };
  proposed_writes: ProposedWrite[];
  notes: string[];
  /** Current writers record the interpreter actually used for this event. */
  interpreter: AnswerInterpreterVersion;
};'''

new_event = '''export type UnresolvedAnswerReason =
  | "unlocated_role_code"
  | "unauthorized_role_code"
  | "illegal_role_code"
  | "unclear_certainty"
  | "estimated_constraint_not_persistable"
  | "missing_authorized_answer_target"
  | "missing_authorized_fact_roles";

export type UnresolvedAnswerItem = {
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

export type PendingAnswerResolutionStatus = "pending";

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

export type AnswerEvent = {
  event_id: string;
  session_id: string;
  client_turn_id: string;
  raw_text: string;
  classification: AnswerClass;
  targets: { dir_ids: string[]; ddr_ids: string[]; direction_id?: string };
  proposed_writes: ProposedWrite[];
  notes: string[];
  /** Structured unresolved items; never enter proposed_writes. */
  unresolved_items: UnresolvedAnswerItem[];
  /** Current writers record the interpreter actually used for this event. */
  interpreter: AnswerInterpreterVersion;
};'''

if old_event not in text:
    raise SystemExit("AnswerEvent block not found")
text = text.replace(old_event, new_event, 1)

# PendingAnswerResolution references AdaptiveQuestionPlan which is defined later.
# Move the pending type to after AdaptiveQuestionPlan, keep Unresolved* before AnswerEvent.
# I inlined clarification_plan: AdaptiveQuestionPlan — that will fail because AdaptiveQuestionPlan is below.
# Fix: use a forward-friendly structure — put Pending types AFTER AdaptiveQuestionPlan.

# Revert the Pending types from the early insertion; keep only Unresolved* + AnswerEvent field.
# I'll do a cleaner replace.

p.write_text(text, encoding="utf-8", newline="\n")
print("types.ts first pass written; will fix Pending placement")
