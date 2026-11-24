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
  /** Page07 is conditionally enabled; others are unconditional. */
  conditional: boolean;
  /** Whether a model generation call is expected when the page is applicable. */
  model_generation: boolean;
  /** Production code / contract version stamped into fingerprints. */
  production_version: string;
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

export type ReportPageRuntimeState = {
  page_id: ReportPageId;
  outcome: ReportPageOutcome;
  /** Canonical schema fingerprint when outcome is completed (optional in Batch 1). */
  output_fingerprint?: string | null;
  /** Last input fingerprint used for the recorded outcome. */
  input_fingerprint?: string | null;
  /** Page07 applicability when known. */
  applicability_status?:
    | "applicable"
    | "not_applicable"
    | "insufficient_information"
    | null;
};

export type ReportBlockedReason = {
  page_id: ReportPageId | ReportDerivedNodeId;
  missing_upstream: ReportPageId[];
  detail: string;
};

export type ReportReadyResolution = {
  graph_version: typeof REPORT_ORCHESTRATION_GRAPH_VERSION;
  ready_pages: ReportPageId[];
  blocked: ReportBlockedReason[];
  ready_derived: ReportDerivedNodeId[];
  blocked_derived: ReportBlockedReason[];
};

/**
 * Shared immutable inputs for fingerprints.
 * Only fields a page actually consumes are hashed for that page.
 */
export type ReportSharedInputSnapshot = {
  locale: string;
  dc_snapshot_fingerprint: string;
  personal_computation_fingerprint: string;
  approved_readings_fingerprint: string;
  evidence_registry_fingerprint: string;
};

/**
 * Per-page upstream output fingerprints (canonical page results).
 * Absent keys mean that upstream is not yet available.
 */
export type ReportUpstreamOutputFingerprints = Partial<
  Record<ReportPageId, string>
>;

export type ReportPageFingerprintInput = {
  page_id: ReportPageId;
  shared: ReportSharedInputSnapshot;
  /** Only the upstream pages this page requires (and optional when present). */
  upstream_output_fingerprints: ReportUpstreamOutputFingerprints;
  /**
   * Page07 applicability terminal when fingerprinting Page08 (or Page07 itself
   * after the gate). Other pages ignore this.
   */
  page07_applicability_status?:
    | "applicable"
    | "not_applicable"
    | "insufficient_information"
    | null;
  /** Validator / production stamp — defaults to registry production_version. */
  validator_version?: string;
};

export type ReportPageFingerprintResult = {
  page_id: ReportPageId;
  fingerprint: string;
  /** Deterministic canonical payload that was hashed (for tests / debug). */
  canonical_payload: Record<string, unknown>;
};

export type ReportGraphValidationIssue = {
  code: string;
  detail: string;
};
