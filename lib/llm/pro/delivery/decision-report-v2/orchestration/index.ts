/**
 * Report production orchestration — Batch 1 public surface.
 * DAG SSOT + fingerprints + ready resolution only. No workers / Inngest.
 */

export {
  REPORT_ORCHESTRATION_GRAPH_VERSION,
  REPORT_PAGE_IDS,
  REPORT_DERIVED_NODE_IDS,
  REPORT_PAGE_OUTCOMES,
  REPORT_UPSTREAM_SATISFYING_OUTCOMES,
  type ReportPageId,
  type ReportDerivedNodeId,
  type ReportGraphNodeId,
  type ReportPageDefinition,
  type ReportDerivedNodeDefinition,
  type ReportPageOutcome,
  type ReportUpstreamSatisfyingOutcome,
  type ReportPageRuntimeState,
  type ReportBlockedReason,
  type ReportReadyResolution,
  type ReportSharedInputSnapshot,
  type ReportUpstreamOutputFingerprints,
  type ReportPageFingerprintInput,
  type ReportPageFingerprintResult,
  type ReportGraphValidationIssue,
} from "./types";

export {
  REPORT_PAGE_PRODUCTION_VERSION,
  REPORT_PAGE_REGISTRY,
  REPORT_DERIVED_NODE_REGISTRY,
  reportPageDefinition,
  isReportPageId,
  pageFingerprintUpstreamIds,
} from "./page-registry";

export {
  buildReportDependencyGraph,
  validateReportDependencyGraph,
  requiredUpstreamOf,
  transitiveUpstreamOf,
  downstreamDependentsOf,
  assertPage01Page02Independent,
  type ReportDependencyGraph,
} from "./dependency-graph";

export {
  hashCanonicalPayload,
  selectUpstreamFingerprintsForPage,
  buildPageInputFingerprintPayload,
  computePageInputFingerprint,
  computeAllPageInputFingerprints,
} from "./input-fingerprint";

export {
  missingRequiredUpstream,
  isPageReadyToDispatch,
  resolveReadyPages,
  isDerivedNodeReady,
  resolveReadyDerived,
  resolveReportReadyState,
  initialPendingPageStates,
} from "./dependency-resolver";
