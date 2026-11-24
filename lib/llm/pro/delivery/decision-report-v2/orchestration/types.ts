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
 * Page-specific shared input slice fingerprints.
 * Callers must supply fingerprints of the data each page's production context
 * actually consumes (face-filtered DC / pack / readings / registry), not the
 * whole-job bag.
 */
export type ReportPageSharedInputSlice = {
  locale: string;
  dc_slice_fingerprint: string;
  personal_computation_slice_fingerprint: string;
  approved_readings_slice_fingerprint: string;
  evidence_registry_slice_fingerprint: string;
};

export type ReportSharedInputKey = keyof ReportPageSharedInputSlice;

/**
 * Per-page upstream output fingerprints (canonical page results).
 * Absent keys mean that upstream is not yet available.
 */
export type ReportUpstreamOutputFingerprints = Partial<
  Record<ReportPageId, string>
>;

export type ReportPageFingerprintInput = {
  page_id: ReportPageId;
  /** Already page-filtered shared input slice. */
  shared_slice: ReportPageSharedInputSlice;
  /** Only the upstream pages this page requires (and optional when present). */
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
