/**
 * Page06 upstream/downstream contracts — record only (Batch 1).
 * No DAG / scheduler in this batch. Page08 is an active consumer of the
 * monitoring_contract handoff fields listed below.
 */

export const PAGE06_UPSTREAM_CONTRACT = {
  page05: [
    "preferred_path_ids (required — must exist)",
    "alternative_path_ids (fallback pool)",
    "path_id / path_role / description",
    "prerequisites / required_resources / risks / success_signals",
    "path_comparison.rows (frozen cost/risk/resource/reversibility context — do not re-rank)",
    "switching_rules (failure / stop / switch triggers)",
  ],
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
    "personal_interpretation unit_ids only for supporting_personal_unit_refs",
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
    "Page06-slice claims/evidence only",
  ],
} as const;

/**
 * Active Page08 consumer contract.
 * Page08 Batch 1 reads these stable handoff fields; it does not rewrite Page06.
 */
export const PAGE06_DOWNSTREAM_CONTRACT = {
  page08: {
    status: "active" as const,
    implemented: true as const,
    note: "Page08 Batch 1 actively consumes this monitoring_contract handoff.",
    fields: [
      "path_id",
      "action_ids",
      "experiment_ids",
      "observe_signals",
      "success_criteria",
      "failure_stop_switch_triggers",
      "window_time_boundary",
      "resource_guardrails",
      "defer_costs",
      "claim_ids",
      "evidence_ids",
      "reality_fact_ids",
    ],
  },
} as const;

export const PAGE06_STABLE_OUTPUT_FIELDS_FOR_DOWNSTREAM = [
  "primary_path_id",
  "fallback_path_ids",
  "path_id",
  "action_ids",
  "experiment_ids",
  "observe_signals",
  "success_criteria",
  "failure_stop_switch_triggers",
  "window_time_boundary",
  "resource_guardrails",
  "defer_costs",
  "claim_ids",
  "evidence_ids",
  "reality_fact_ids",
  "monitoring_contract",
  "evidence_boundary",
] as const;
