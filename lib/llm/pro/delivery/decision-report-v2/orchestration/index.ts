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
  REPORT_PAGE07_APPLICABILITY_STATUSES,
  type ReportPageId,
  type ReportDerivedNodeId,
  type ReportGraphNodeId,
  type ReportPageDefinition,
  type ReportDerivedNodeDefinition,
  type ReportPageOutcome,
  type ReportUpstreamSatisfyingOutcome,
  type ReportPage07ApplicabilityStatus,
  type ReportPageRuntimeState,
  type ReportBlockedReason,
  type ReportReadyResolution,
  type ReportPageSharedInputSlice,
  type ReportSharedInputKey,
  type ReportUpstreamOutputFingerprints,
  type ReportPageFingerprintInput,
  type ReportPageFingerprintResult,
  type ReportFingerprintFailure,
  type ReportFingerprintSuccess,
  type ReportFingerprintComputeResult,
  type ReportGraphValidationIssue,
} from "./types";

export {
  REPORT_PAGE_PRODUCTION_VERSION,
  PAGE_PRODUCTION_VERSIONS,
  PAGE_VALIDATOR_VERSIONS,
  REPORT_PAGE_REGISTRY,
  REPORT_DERIVED_NODE_REGISTRY,
  reportPageDefinition,
  isReportPageId,
  pageFingerprintUpstreamIds,
  pageSharedInputKeys,
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
  requireUpstreamFingerprintsForPage,
  buildPageInputFingerprintPayload,
  computePageInputFingerprint,
  computeAllPageInputFingerprints,
} from "./input-fingerprint";

export {
  selectSharedSliceForPage,
  pageSharedInputConsumptionNotes,
  makeTestSharedSlice,
} from "./shared-input-adapter";

export {
  missingRequiredUpstream,
  isPageReadyToDispatch,
  isUnconditionalPageModelReady,
  isPage07ApplicabilityGateReady,
  isPage07ModelGenerationReady,
  resolveReadyPages,
  isDerivedNodeReady,
  resolveReadyDerived,
  resolveReportReadyState,
  initialPendingPageStates,
} from "./dependency-resolver";
