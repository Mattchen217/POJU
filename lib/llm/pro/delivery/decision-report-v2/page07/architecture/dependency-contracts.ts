/**
 * Page07 upstream/downstream contracts — record only (Batch 1).
 * Page07 is conditionally enabled. No Page08 implementation here.
 */

export const PAGE07_UPSTREAM_CONTRACT = {
  page01: [
    "core_judgment",
    "recommendation_conditions",
    "not_recommended",
    "applicability_boundary",
  ],
  page02: [
    "content_units",
    "explanation_boundary",
    "personal_interpretation unit_ids only for the USER (participant self)",
  ],
  page04: [
    "bottleneck content_units",
    "evidence_boundary",
  ],
  page05: [
    "preferred_path_ids (required when Page07 is applicable)",
    "all path_ids for related_page05_path_ids",
  ],
  page06: [
    "primary_path_id (required when Page07 is applicable)",
    "first_step.action_id + execution_actions.action_id",
  ],
  decision_context: [
    "decision_question",
    "reality_facts (status preserved)",
    "constraints",
    "dirs",
    "applicability gate runs before any LLM call",
  ],
} as const;

export const PAGE07_DOWNSTREAM_CONTRACT = {
  page08: {
    status: "future" as const,
    implemented: true as const,
    note: "Page08 Batch 1 consumes this handoff.",
    fields: [
      "applicability_status",
      "participant_ids",
      "related_page05_path_ids",
      "related_page06_action_ids",
      "effect_on_page06_execution",
      "claim_ids",
      "evidence_ids",
      "confirmed_fact_ids",
    ],
  },
} as const;

export const PAGE07_STABLE_OUTPUT_FIELDS_FOR_DOWNSTREAM = [
  "applicability_status",
  "applicability_reason",
  "participants",
  "field_units",
  "relationship_units",
  "alignment_with_main",
  "related_page05_path_ids",
  "related_page06_action_ids",
  "effect_on_page06_execution",
  "evidence_boundary",
] as const;
