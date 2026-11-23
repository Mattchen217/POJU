/**
 * Page06 architecture barrel — Batch 1 production-system SSOT.
 */

export {
  PAGE06_SECTION_IDS,
  PAGE06_SECTION_DEFINITIONS,
  page06SectionById,
  page06DefaultReadingOrder,
  page06RequiredSectionIds,
  isPage06SectionId,
  normalizePage06ReadingOrder,
  type Page06SectionId,
  type Page06SegmentLetter,
  type Page06SectionDefinition,
} from "./sections";

export {
  PAGE06_GAP_STATUSES,
  isPage06GapStatus,
  gapStatusFromDcFactStatus,
  type Page06GapStatus,
  type Page06MissingInput,
  type Page06GenerationStatus,
} from "./gaps";

export {
  PAGE06_INPUT_SOURCE_KINDS,
  PAGE06_INPUT_FIELD_CONTRACTS,
  page06InputContractsForSection,
  page06InputContractById,
  type Page06InputSourceKind,
  type Page06InputFieldContract,
  type Page06InputManifestEntry,
} from "./input-contracts";

export {
  PAGE06_SECTION_CONTENT_SPECS,
  page06ContentSpecForSection,
  type Page06ContentKind,
  type Page06SectionContentSpec,
} from "./content-specs";

export {
  PAGE06_TASK_IDS,
  PAGE06_MODEL_TASKS,
  page06TaskById,
  type Page06TaskId,
  type Page06ModelTaskDefinition,
} from "./tasks";

export {
  PAGE06_ARCHITECTURE_PROMPT_VERSION,
  buildPage06SectionPromptBlock,
  buildPage06ArchitecturePromptBundle,
} from "./prompt-templates";

export {
  assemblePage06InputManifest,
  buildPage06MissingInputs,
  resolvePage06GenerationStatus,
  page06FactGapsFromDc,
  filterValidApprovedReadings,
  page06AssembledFieldIds,
  assertPage06InputAssemblyCoverage,
  PAGE06_FIELD_ASSEMBLERS,
  type Page06ArchitectureInputSnapshot,
  type Page06FieldAssemblyRow,
} from "./assemble-inputs";

export {
  buildPage06ArchitectureEnvelope,
  buildPage06ArchitectureProduction,
  attachPage06ArchitectureToPage,
  validatePage06CanonicalPage,
  page06TaskInterface,
  type Page06ArchitectureEnvelope,
  type Page06ArchitectureBuildOk,
  type Page06ArchitectureBuildFail,
} from "./production-path";

export {
  page06SectionTitle,
  resolvePage06ReadingOrder,
  resolvePage06SectionUnitTexts,
  resolvePage06SectionGapLines,
  assemblePage06SectionsForDisplay,
  assemblePage06PdfArgumentBodies,
  type Page06AssembledSection,
} from "./section-assembly";

export {
  PAGE06_UPSTREAM_CONTRACT,
  PAGE06_DOWNSTREAM_CONTRACT,
  PAGE06_STABLE_OUTPUT_FIELDS_FOR_DOWNSTREAM,
} from "./dependency-contracts";
