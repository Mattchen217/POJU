/**
 * Page08 upstream contracts — record only (Batch 1).
 * No global DAG / orchestrator. Page08 consumes Page01–07; it does not rewrite them.
 */

export const PAGE08_UPSTREAM_CONTRACT = {
  page01: [
    "core_judgment",
    "recommendation_conditions",
    "not_recommended",
    "applicability_boundary",
  ],
  page02: [
    "content_units",
    "explanation_boundary",
  ],
  page04: [
    "bottleneck content_units",
    "evidence_boundary",
  ],
  page05: [
    "preferred_path_ids (required)",
    "all path_ids for related_path_ids / affected_path_ids",
    "success_signals and reconsideration_conditions as read-only context",
  ],
  page06: [
    "primary_path_id",
    "action_ids (first_step + execution_actions)",
    "monitoring_contract (required — observe_signals, stop/continue/adjust triggers)",
  ],
  page07: [
    "not_applicable is allowed and does not block",
    "insufficient_information is a gap, not a fake applicable page",
    "applicable uses the stored participants, field units, and alignment only",
    "missing Page07 is a gap, not a reason to invent field content",
  ],
  decision_context: [
    "decision_question (required)",
    "reality_facts (status preserved)",
    "constraints",
    "dirs",
  ],
  personal_readings_registry: [
    "Page08-slice claims/evidence only",
  ],
} as const;

/**
 * Page08 is the monitoring and review page. No later page is produced here.
 */
export const PAGE08_DOWNSTREAM_CONTRACT = {
  none: {
    status: "terminal" as const,
    implemented: false as const,
    note: "Page08 is the risk monitoring and decision review page. No later page is produced in this batch.",
    fields: [] as readonly string[],
  },
} as const;

export const PAGE08_STABLE_OUTPUT_FIELDS_FOR_DOWNSTREAM = [
  "risk_id",
  "risk_category",
  "current_status",
  "signal_id",
  "related_risk_ids",
  "baseline_status",
  "threshold_status",
  "trigger_id",
  "decision_response",
  "trigger_status",
  "reassessment_id",
  "affected_path_ids",
  "confirmed_fact_ids",
  "unverified_fact_ids",
  "monitoring_limitations",
  "reassessment_limitations",
] as const;
