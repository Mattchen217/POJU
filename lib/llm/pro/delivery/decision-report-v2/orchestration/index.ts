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
  REPORT_SHARED_INPUT_KEYS,
  REPORT_OPTIONAL_UPSTREAM_ABSENT,
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
  pageFingerprintOptionalUpstreamIds,
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
  selectOptionalUpstreamFingerprintsForPage,
  requireUpstreamFingerprintsForPage,
  buildPageInputFingerprintPayload,
  computePageInputFingerprint,
  computePageInputFingerprintFromProductionContext,
  assertPage02OptionalUpstreamConsistency,
  computeAllPageInputFingerprints,
} from "./input-fingerprint";

export {
  selectSharedSliceForPage,
  pageSharedInputConsumptionNotes,
  makeTestSharedSlice,
} from "./shared-input-adapter";

export {
  buildPageSharedInputFingerprintFromProductionContext,
  extractConsumedInputFromFace01,
  extractConsumedInputFromFace02,
  extractConsumedInputFromFace04,
  extractConsumedInputFromFace05,
  extractConsumedInputFromFace06,
  extractConsumedInputFromFace07,
  extractConsumedInputFromFace08,
  page02ConsumesPage01Alignment,
  applicabilityFromProductionContext,
  type ReportPageConsumedInputExtract,
  type ProductionContextFingerprintResult,
} from "./production-context-fingerprint";

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
