export type AnswerInterpreterVersion =
  | "deterministic_m1_v1"
  | "deterministic_m2_4_r1"
  | "model_m2_4_r2";

export type ModelAnswerDraft = {
  classification:
    | "clear_answer"
    | "partial_answer"
    | "vague_answer"
    | "unknown"
    | "declined"
    | "correction"
    | "supplement"
    | "contradiction"
    | "goal_change"
    | "insight_mismatch"
    | "off_topic"
    | "invalid_input"
    | "estimate";
  extracted_items: Array<{
    text: string;
    semantic_kind: "reality_fact" | "constraint" | "definition_patch";
    role_hint: string | null;
    certainty: "explicit" | "estimated" | "unclear";
  }>;
  unresolved_aspects: string[];
  explanation: string;
};
