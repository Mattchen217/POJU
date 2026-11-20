from pathlib import Path
p = Path("lib/poju/decision-intake/types.ts")
text = p.read_text(encoding="utf-8")

# Remove Pending types from early insertion (leave Unresolved* + AnswerEvent)
early_pending = '''export type PendingAnswerResolutionStatus = "pending";

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
if early_pending not in text:
    raise SystemExit("early pending block not found")
text = text.replace(early_pending, "", 1)

anchor = '''  /** Exact Conflict addressed by this plan, if any. Scheduling metadata only. */
  conflict_clarification?: ConflictClarificationTarget | null;
};
'''
pending_after = anchor + '''
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
'''
if anchor not in text:
    raise SystemExit("AdaptiveQuestionPlan end anchor not found")
# This anchor might match last_sent_question too? Check uniqueness
print("anchor count", text.count(anchor))
if text.count(anchor) != 1:
    raise SystemExit("anchor not unique")
text = text.replace(anchor, pending_after, 1)
p.write_text(text, encoding="utf-8", newline="\n")
print("types.ts pending placement fixed")
