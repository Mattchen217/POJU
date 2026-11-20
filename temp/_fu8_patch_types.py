from pathlib import Path

p = Path("lib/poju/decision-intake/types.ts")
text = p.read_text(encoding="utf-8")
old = '''    role_code_hint?: string | null;
    certainty: "explicit" | "estimated" | "unclear";
  }>;
  unresolved_aspects: string[];
'''
new = '''    role_code_hint?: string | null;
    certainty: "explicit" | "estimated" | "unclear";
    /**
     * Exact substring of the current user answer that supports this item.
     * Required for persistable model extractions. Never a paraphrase,
     * and never manufactured by the parser.
     */
    source_quote: string;
  }>;
  unresolved_aspects: string[];
'''
assert old in text, "model item type block not found"
text = text.replace(old, new, 1)

old = '''export type AnswerEvent = {
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
};
'''
new = '''export type SourceQuoteRejectionReason =
  | "source_quote_not_grounded"
  | "source_quote_empty"
  | "source_quote_too_long";

export type SourceQuoteRejection = {
  extracted_index: number;
  text: string;
  source_quote: string;
  reason: SourceQuoteRejectionReason;
};

/**
 * Scheduling signal from a model unresolved_aspects entry.
 * Never a RealityFact, Constraint, or second fact store.
 */
export type UnresolvedModelAspect = {
  aspect_id: string;
  source_turn_id: string;
  text: string;
  sent_question_id: string;
  authorized_role_codes: string[];
  authorized_dir_ids: string[];
};

export type IntakeControlItemKind =
  | "unresolved_aspect"
  | "goal_change"
  | "insight_mismatch";

export type IntakeControlItemStatus =
  | "pending"
  | "clarified"
  | "confirmed"
  | "declined"
  | "uncertain";

/**
 * Session scheduling / control metadata only.
 * Never a Decision Context write and never an automatic Blueprint mutation.
 */
export type IntakeControlItem = {
  item_id: string;
  kind: IntakeControlItemKind;
  source_turn_id: string;
  text: string;
  /** User-stated proposed new decision target; goal_change only. */
  proposed_decision_target?: string;
  sent_question_id: string;
  authorized_role_codes: string[];
  authorized_dir_ids: string[];
  status: IntakeControlItemStatus;
};

export type PendingIntakeControlStatus = "pending" | "resolved";

export type PendingIntakeControl = {
  status: PendingIntakeControlStatus;
  source_turn_id: string;
  original_statement: string;
  original_classification: AnswerClass;
  items: IntakeControlItem[];
  clarification_plan: AdaptiveQuestionPlan | null;
  clarification_plan_id: string | null;
  resolving_item_id: string | null;
  /**
   * Set only after an explicit user confirmation of a proposed goal_change.
   * Records entry into the controlled Blueprint-update path.
   * This codebase does not yet have a complete auto-apply authority path;
   * confirmation must not mutate Blueprint or the confirmed DC definition.
   */
  entered_controlled_blueprint_update?: boolean;
  /** Original decision target retained while a goal change is pending or declined. */
  original_decision_target?: string | null;
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
  /**
   * Structured unresolved model aspects. Scheduling signals only;
   * never left only in notes and never written as facts.
   */
  unresolved_aspects: UnresolvedModelAspect[];
  /** Deterministic source-quote grounding rejections for this turn. */
  grounding_rejections: SourceQuoteRejection[];
  /** Control-plane clarification items captured from this turn. */
  control_items: IntakeControlItem[];
  /** Current writers record the interpreter actually used for this event. */
  interpreter: AnswerInterpreterVersion;
};
'''
assert old in text, "AnswerEvent block not found"
text = text.replace(old, new, 1)

p.write_text(text.replace("\r\n", "\n"), encoding="utf-8", newline="\n")
print("types.ts patched", p.stat().st_size)
