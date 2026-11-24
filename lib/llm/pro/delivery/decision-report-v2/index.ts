/**
 * Decision Report V2 — Batch 0 public foundation + Page 01 + Page 02 + Page 04 + Page 06 + Page 07 + Page 08
 * + orchestration Batch 1 (DAG SSOT only).
 */

export * from "./types";
export * from "./schemas";
export * from "./system-prompt";
export * from "./body-compliance";
export * from "./term-allowlist";
export * from "./evidence-registry";
export * from "./reading-order";
export * from "./glossary-appendix";
export * from "./page01/slice";
export * from "./page01/prompt";
export * from "./page01/validate";
export * from "./page01/legacy-adapter";
export * from "./page01/production";
export * from "./page02/slice";
export * from "./page02/prompt";
export * from "./page02/validate";
export * from "./page02/legacy-adapter";
export * from "./page02/production";
export * from "./page02/body-blob";
export * from "./page02/fact-id";
export * from "./page02/credible-fact-claim";
export * from "./page02/content-units";
export * from "./page02/architecture";
export * from "./page04/prompt";
export * from "./page04/validate";
export * from "./page04/legacy-adapter";
export * from "./page04/production";
export * from "./page04/content-units";
// Architecture barrel: avoid clashing re-exports with page02 (gapStatus/filterValid*).
export {
  PAGE04_SECTION_IDS,
  PAGE04_SECTION_DEFINITIONS,
  PAGE04_INPUT_FIELD_CONTRACTS,
  PAGE04_SECTION_CONTENT_SPECS,
  PAGE04_MODEL_TASKS,
  PAGE04_GAP_STATUSES,
  PAGE04_ARCHITECTURE_PROMPT_VERSION,
  PAGE04_FIELD_ASSEMBLERS,
  buildPage04ArchitectureProduction,
  buildPage04ArchitectureEnvelope,
  attachPage04ArchitectureToPage,
  validatePage04CanonicalPage,
  assemblePage04SectionsForDisplay,
  assemblePage04PdfArgumentBodies,
  assemblePage04InputManifest,
  buildPage04MissingInputs,
  buildPage04ArchitecturePromptBundle,
  normalizePage04ReadingOrder,
  page04TaskInterface,
} from "./page04/architecture";
export {
  buildFace06ProductionContext,
  validateFace06ProductionOutput,
  parseFace06JsonStrict,
  face06SliceSummary,
  knownPage05PathIdsFromFace,
} from "./page06/production";
export { validateFace06Output } from "./page06/validate";
export { assertFace06PathIntegrity } from "./page06/path-integrity";
export {
  isFace06V2,
  isFace06Legacy,
  projectLegacyFace06ForDisplay,
} from "./page06/legacy-adapter";
export {
  PAGE06_SECTION_IDS,
  PAGE06_SECTION_DEFINITIONS,
  PAGE06_INPUT_FIELD_CONTRACTS,
  PAGE06_SECTION_CONTENT_SPECS,
  PAGE06_MODEL_TASKS,
  PAGE06_GAP_STATUSES,
  PAGE06_ARCHITECTURE_PROMPT_VERSION,
  PAGE06_FIELD_ASSEMBLERS,
  PAGE06_UPSTREAM_CONTRACT,
  PAGE06_DOWNSTREAM_CONTRACT,
  PAGE06_STABLE_OUTPUT_FIELDS_FOR_DOWNSTREAM,
  buildPage06ArchitectureProduction,
  buildPage06ArchitectureEnvelope,
  attachPage06ArchitectureToPage,
  validatePage06CanonicalPage,
  assemblePage06SectionsForDisplay,
  assemblePage06PdfArgumentBodies,
  assemblePage06InputManifest,
  buildPage06MissingInputs,
  buildPage06ArchitecturePromptBundle,
  normalizePage06ReadingOrder,
  page06TaskInterface,
  assertPage06InputAssemblyCoverage,
} from "./page06/architecture";
export {
  buildFace07ProductionContext,
  validateFace07ProductionOutput,
  parseFace07JsonStrict,
  face07SliceSummary,
  synthesizeFace07StatusPage,
  knownPage06ActionIdsFromFace,
} from "./page07/production";
export { validateFace07Output } from "./page07/validate";
export { assertFace07PathIntegrity } from "./page07/path-integrity";
export { evaluatePage07Applicability } from "./page07/applicability";
export {
  isFace07V2,
  isFace07Legacy,
  projectLegacyFace07ForDisplay,
} from "./page07/legacy-adapter";
export {
  PAGE07_SECTION_IDS,
  PAGE07_SECTION_DEFINITIONS,
  PAGE07_INPUT_FIELD_CONTRACTS,
  PAGE07_SECTION_CONTENT_SPECS,
  PAGE07_MODEL_TASKS,
  PAGE07_GAP_STATUSES,
  PAGE07_ARCHITECTURE_PROMPT_VERSION,
  PAGE07_FIELD_ASSEMBLERS,
  PAGE07_UPSTREAM_CONTRACT,
  PAGE07_DOWNSTREAM_CONTRACT,
  PAGE07_STABLE_OUTPUT_FIELDS_FOR_DOWNSTREAM,
  buildPage07ArchitectureProduction,
  buildPage07ArchitectureEnvelope,
  attachPage07ArchitectureToPage,
  validatePage07CanonicalPage,
  assemblePage07SectionsForDisplay,
  assemblePage07PdfArgumentBodies,
  assemblePage07InputManifest,
  buildPage07MissingInputs,
  buildPage07ArchitecturePromptBundle,
  normalizePage07ReadingOrder,
  page07TaskInterface,
  assertPage07InputAssemblyCoverage,
} from "./page07/architecture";
export {
  buildFace08ProductionContext,
  validateFace08ProductionOutput,
  parseFace08JsonStrict,
  face08SliceSummary,
  buildFace08RepairUserMessage,
  readPage07ForFace08,
} from "./page08/production";
export { validateFace08Output } from "./page08/validate";
export { assertFace08PathIntegrity } from "./page08/path-integrity";
export {
  isFace08V2,
  isFace08Legacy,
  projectLegacyFace08ForDisplay,
} from "./page08/legacy-adapter";
export {
  PAGE08_SECTION_IDS,
  PAGE08_SECTION_DEFINITIONS,
  PAGE08_INPUT_FIELD_CONTRACTS,
  PAGE08_SECTION_CONTENT_SPECS,
  PAGE08_MODEL_TASKS,
  PAGE08_GAP_STATUSES,
  PAGE08_ARCHITECTURE_PROMPT_VERSION,
  PAGE08_FIELD_ASSEMBLERS,
  PAGE08_UPSTREAM_CONTRACT,
  PAGE08_DOWNSTREAM_CONTRACT,
  PAGE08_STABLE_OUTPUT_FIELDS_FOR_DOWNSTREAM,
  buildPage08ArchitectureProduction,
  buildPage08ArchitectureEnvelope,
  attachPage08ArchitectureToPage,
  validatePage08CanonicalPage,
  assemblePage08SectionsForDisplay,
  assemblePage08PdfArgumentBodies,
  assemblePage08InputManifest,
  buildPage08MissingInputs,
  buildPage08ArchitecturePromptBundle,
  normalizePage08ReadingOrder,
  page08TaskInterface,
  assertPage08InputAssemblyCoverage,
} from "./page08/architecture";
export * from "./registry-from-sources";
export * from "./fact-relevance";
export * from "./personal-domains";
export * from "./term-provenance";
export * from "./assembly";
export {
  REPORT_ORCHESTRATION_GRAPH_VERSION,
  REPORT_PAGE_IDS,
  REPORT_PAGE_REGISTRY,
  REPORT_DERIVED_NODE_REGISTRY,
  REPORT_PAGE_PRODUCTION_VERSION,
  PAGE_PRODUCTION_VERSIONS,
  PAGE_VALIDATOR_VERSIONS,
  buildReportDependencyGraph,
  validateReportDependencyGraph,
  requiredUpstreamOf,
  transitiveUpstreamOf,
  downstreamDependentsOf,
  assertPage01Page02Independent,
  computePageInputFingerprint,
  computePageInputFingerprintFromProductionContext,
  computeAllPageInputFingerprints,
  selectUpstreamFingerprintsForPage,
  requireUpstreamFingerprintsForPage,
  selectSharedSliceForPage,
  makeTestSharedSlice,
  buildPageSharedInputFingerprintFromProductionContext,
  resolveReportReadyState,
  initialPendingPageStates,
  isPageReadyToDispatch,
  isUnconditionalPageModelReady,
  isPage07ApplicabilityGateReady,
  isPage07ModelGenerationReady,
  reportPageDefinition,
  isReportPageId,
  pageFingerprintOptionalUpstreamIds,
} from "./orchestration";