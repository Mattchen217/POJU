/**
 * Page05 upstream/downstream contracts — record only (Batch 1).
 * No DAG / scheduler implementation in this batch.
 */

export const PAGE05_UPSTREAM_CONTRACT = {
  page01: [
    "core_judgment",
    "primary/backup recommendations",
    "recommendation_conditions",
    "not_recommended",
    "applicability_boundary",
  ],
  page02: [
    "content_units",
    "explanation_boundary",
    "personal+reality interplay for path fit",
  ],
  page04: [
    "bottleneck naming / manifestation / force-through / leverage / evidence_boundary",
  ],
  decision_context: [
    "decision_question",
    "reality_facts (status preserved)",
    "constraints",
    "conflicts",
    "dirs",
  ],
  personal_readings_registry: [
    "approved readings",
    "Page05-slice claims/evidence only",
  ],
} as const;

export const PAGE05_DOWNSTREAM_CONTRACT = {
  page06: [
    "path_id",
    "path_role",
    "description",
    "prerequisites",
    "required_resources",
    "risks",
    "success_signals",
    "reconsideration_conditions",
  ],
  page08: [
    "path_id",
    "switching_rules (trigger/action/target)",
    "success_signals",
    "stop / redefine conditions",
  ],
  page07: [
    "not a required upstream for Page05",
    "may later supply field/relation conditions when topic-enabled",
  ],
} as const;

export const PAGE05_STABLE_OUTPUT_FIELDS_FOR_DOWNSTREAM = [
  "path_id",
  "path_role",
  "description",
  "prerequisites",
  "required_resources",
  "risks",
  "success_signals",
  "reconsideration_conditions",
  "switching_rules",
  "evidence_boundary",
] as const;
