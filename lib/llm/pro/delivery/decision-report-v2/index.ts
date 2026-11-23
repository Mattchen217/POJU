/**
 * Decision Report V2 — Batch 0 public foundation + Page 01 + Page 02 + Page 04 + Page 06.
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
export * from "./registry-from-sources";
export * from "./fact-relevance";
export * from "./personal-domains";
export * from "./term-provenance";
export * from "./assembly";