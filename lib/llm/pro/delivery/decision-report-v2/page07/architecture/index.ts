/**
 * Page07 architecture barrel — Batch 1 production-system SSOT.
 */

export {
  PAGE07_SECTION_IDS,
  PAGE07_SECTION_DEFINITIONS,
  page07SectionById,
  page07DefaultReadingOrder,
  page07RequiredSectionIds,
  isPage07SectionId,
  normalizePage07ReadingOrder,
  type Page07SectionId,
  type Page07SegmentLetter,
  type Page07SectionDefinition,
} from "./sections";

export {
  PAGE07_GAP_STATUSES,
  isPage07GapStatus,
  gapStatusFromDcFactStatus,
  type Page07GapStatus,
  type Page07MissingInput,
  type Page07GenerationStatus,
} from "./gaps";

export {
  PAGE07_INPUT_SOURCE_KINDS,
  PAGE07_INPUT_FIELD_CONTRACTS,
  page07InputContractsForSection,
  page07InputContractById,
  type Page07InputSourceKind,
  type Page07InputFieldContract,
  type Page07InputManifestEntry,
} from "./input-contracts";

export {
  PAGE07_SECTION_CONTENT_SPECS,
  page07ContentSpecForSection,
  type Page07ContentKind,
  type Page07SectionContentSpec,
} from "./content-specs";

export {
  PAGE07_TASK_IDS,
  PAGE07_MODEL_TASKS,
  page07TaskById,
  type Page07TaskId,
  type Page07ModelTaskDefinition,
} from "./tasks";

export {
  PAGE07_ARCHITECTURE_PROMPT_VERSION,
  buildPage07SectionPromptBlock,
  buildPage07ArchitecturePromptBundle,
} from "./prompt-templates";

export {
  assemblePage07InputManifest,
  buildPage07MissingInputs,
  resolvePage07GenerationStatus,
  page07FactGapsFromDc,
  page07AssembledFieldIds,
  assertPage07InputAssemblyCoverage,
  PAGE07_FIELD_ASSEMBLERS,
  type Page07ArchitectureInputSnapshot,
  type Page07FieldAssemblyRow,
} from "./assemble-inputs";

export {
  buildPage07ArchitectureEnvelope,
  buildPage07ArchitectureProduction,
  attachPage07ArchitectureToPage,
  validatePage07CanonicalPage,
  page07TaskInterface,
  type Page07ArchitectureEnvelope,
  type Page07ArchitectureBuildOk,
  type Page07ArchitectureBuildFail,
} from "./production-path";

export {
  page07SectionTitle,
  resolvePage07ReadingOrder,
  resolvePage07SectionUnitTexts,
  resolvePage07SectionGapLines,
  assemblePage07SectionsForDisplay,
  assemblePage07PdfArgumentBodies,
  type Page07AssembledSection,
} from "./section-assembly";

export {
  PAGE07_UPSTREAM_CONTRACT,
  PAGE07_DOWNSTREAM_CONTRACT,
  PAGE07_STABLE_OUTPUT_FIELDS_FOR_DOWNSTREAM,
} from "./dependency-contracts";
