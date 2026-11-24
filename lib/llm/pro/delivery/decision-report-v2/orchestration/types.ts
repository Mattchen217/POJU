/**
 * Global report production orchestration types — Batch 1 SSOT only.
 * No scheduler / Inngest workers in this batch.
 */

export const REPORT_ORCHESTRATION_GRAPH_VERSION =
  "report-dag-v1-2026-11-24" as const;

export const REPORT_PAGE_IDS = [
  "01",
  "02",
  "04",
  "05",
  "06",
  "07",
  "08",
] as const;

export type ReportPageId = (typeof REPORT_PAGE_IDS)[number];

/** Derived terminal node after all page terminals are known. */
export const REPORT_DERIVED_NODE_IDS = ["glossary_appendix"] as const;

export type ReportDerivedNodeId = (typeof REPORT_DERIVED_NODE_IDS)[number];

export type ReportGraphNodeId = ReportPageId | ReportDerivedNodeId;

/**
 * Consumption dimensions hashed from a real production context.
 * Pages declare a subset via ReportPageDefinition.shared_input_keys —
 * not every page inherits the same bag.
 */
export const REPORT_SHARED_INPUT_KEYS = [
  "locale",
  "dc_consumed",
  "personal_consumed",
  "readings_consumed",
  "registry_consumed",
  "decision_consumed",
  "page01_alignment_consumed",
  "upstream_payload_alignment_consumed",
  "applicability_consumed",
  "date_corpus_consumed",
] as const;

export type ReportSharedInputKey = (typeof REPORT_SHARED_INPUT_KEYS)[number];

export type ReportPageDefinition = {
  page_id: ReportPageId;
  /** Page ids that must reach a satisfying terminal before this page may run. */
  required_upstream: readonly ReportPageId[];
  /** Documented optional upstream; never blocks ready-state. */
  optional_upstream: readonly ReportPageId[];
  output_schema_version: string;
  prompt_version: string;
  /** Independent per-page validator stamp (not a global report version). */
  validator_version: string;
  /** Independent per-page production contract stamp. */
  production_version: string;
  /** Page07 is conditionally enabled; others are unconditional. */
  conditional: boolean;
  /** Whether a model generation call is expected when the page is applicable. */
  model_generation: boolean;
  /**
   * Shared-input keys this page's production context actually consumes.
   * Fingerprints hash only these keys from the page-specific slice.
   */
  shared_input_keys: readonly ReportSharedInputKey[];
  notes?: string;
};

export type ReportDerivedNodeDefinition = {
  node_id: ReportDerivedNodeId;
  required_upstream: readonly ReportPageId[];
  notes?: string;
};

/**
 * Persisted / observed page outcomes used by the resolver (Batch 1 read model).
 * Batch 2+ will own the write path.
 */
export const REPORT_PAGE_OUTCOMES = [
  "pending",
  "ready",
  "queued",
  "running",
  "validating",
  "repair_queued",
  "completed",
  "skipped_not_applicable",
  "insufficient_information",
  "failed",
  "stale",
  "cancelled",
] as const;

export type ReportPageOutcome = (typeof REPORT_PAGE_OUTCOMES)[number];

/** Outcomes that satisfy a required upstream edge for dependents. */
export const REPORT_UPSTREAM_SATISFYING_OUTCOMES = [
  "completed",
  "skipped_not_applicable",
  "insufficient_information",
] as const;

export type ReportUpstreamSatisfyingOutcome =
  (typeof REPORT_UPSTREAM_SATISFYING_OUTCOMES)[number];

export const REPORT_PAGE07_APPLICABILITY_STATUSES = [
  "applicable",
  "not_applicable",
  "insufficient_information",
] as const;

export type ReportPage07ApplicabilityStatus =
  (typeof REPORT_PAGE07_APPLICABILITY_STATUSES)[number];

export type ReportPageRuntimeState = {
  page_id: ReportPageId;
  outcome: ReportPageOutcome;
  /** Canonical schema fingerprint when outcome is completed (optional in Batch 1). */
  output_fingerprint?: string | null;
  /** Last input fingerprint used for the recorded outcome. */
  input_fingerprint?: string | null;
  /** Page07 applicability when known (gate result). */
  applicability_status?: ReportPage07ApplicabilityStatus | null;
};

export type ReportBlockedReason = {
  page_id: ReportPageId | ReportDerivedNodeId;
  missing_upstream: ReportPageId[];
  detail: string;
};

/**
 * Ready resolution with explicit Page07 gate vs model-generation semantics.
 * `ready_pages` is NOT used — Batch 2 must not treat gate-ready as LLM-ready.
 */
export type ReportReadyResolution = {
  graph_version: typeof REPORT_ORCHESTRATION_GRAPH_VERSION;
  /**
   * Pages whose upstream is satisfied and that may receive a model generation task.
   * Page07 appears here only when applicability_status === "applicable".
   */
  ready_model_generations: ReportPageId[];
  /**
   * Conditional pages (Page07) whose upstream is satisfied and that may run
   * the applicability gate — not an LLM call.
   */
  ready_applicability_gates: ReportPageId[];
  blocked: ReportBlockedReason[];
  ready_derived: ReportDerivedNodeId[];
  blocked_derived: ReportBlockedReason[];
};

/**
 * Page-specific shared input slice fingerprints derived from a real
 * production context by buildPageSharedInputFingerprintFromProductionContext.
 * Only keys declared in the page registry are required / hashed.
 */
export type ReportPageSharedInputSlice = {
  locale: string;
} & Partial<Record<Exclude<ReportSharedInputKey, "locale">, string>>;

/**
 * Per-page upstream output fingerprints (canonical page results).
 * Absent keys mean that upstream is not yet available.
 */
export type ReportUpstreamOutputFingerprints = Partial<
  Record<ReportPageId, string>
>;

/** Sentinel recorded for optional upstream that was not supplied. */
export const REPORT_OPTIONAL_UPSTREAM_ABSENT = "absent" as const;

export type ReportPageFingerprintInput = {
  page_id: ReportPageId;
  /**
   * Page-filtered shared input slice — must come from a production-context
   * adapter in production paths (not opaque test strings).
   */
  shared_slice: ReportPageSharedInputSlice;
  /** Required + optional upstream page output fingerprints. */
  upstream_output_fingerprints: ReportUpstreamOutputFingerprints;
  /**
   * Required for Page07 and Page08. Must be an explicit applicability status —
   * null / undefined is rejected (fail closed).
   */
  page07_applicability_status?: ReportPage07ApplicabilityStatus | null;
  /**
   * Optional override for tests. Defaults to the page's registry validator_version.
   * Must never be a global stamp applied to every page.
   */
  validator_version?: string;
  /** Optional override for tests. Defaults to registry production_version. */
  production_version?: string;
};

export type ReportPageFingerprintResult = {
  page_id: ReportPageId;
  fingerprint: string;
  /** Deterministic canonical payload that was hashed (for tests / debug). */
  canonical_payload: Record<string, unknown>;
};

export type ReportFingerprintFailure = {
  ok: false;
  page_id: ReportPageId;
  code: string;
  detail: string;
};

export type ReportFingerprintSuccess = {
  ok: true;
  result: ReportPageFingerprintResult;
};

export type ReportFingerprintComputeResult =
  | ReportFingerprintSuccess
  | ReportFingerprintFailure;

export type ReportGraphValidationIssue = {
  code: string;
  detail: string;
};
