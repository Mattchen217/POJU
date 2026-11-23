/**
 * Page04 architecture barrel — Batch 1 production-system SSOT.
 */

export {
  PAGE04_SECTION_IDS,
  PAGE04_SECTION_DEFINITIONS,
  page04SectionById,
  page04DefaultReadingOrder,
  page04RequiredSectionIds,
  isPage04SectionId,
  normalizePage04ReadingOrder,
  type Page04SectionId,
  type Page04SectionDefinition,
} from "./sections";

export {
  PAGE04_GAP_STATUSES,
  isPage04GapStatus,
  gapStatusFromDcFactStatus,
  type Page04GapStatus,
  type Page04MissingInput,
  type Page04GenerationStatus,
} from "./gaps";

export {
  PAGE04_INPUT_SOURCE_KINDS,
  PAGE04_INPUT_FIELD_CONTRACTS,
  page04InputContractsForSection,
  page04InputContractById,
  type Page04InputSourceKind,
  type Page04InputFieldContract,
  type Page04InputManifestEntry,
} from "./input-contracts";

export {
  PAGE04_SECTION_CONTENT_SPECS,
  page04ContentSpecForSection,
  type Page04ContentKind,
  type Page04SectionContentSpec,
} from "./content-specs";

export {
  PAGE04_TASK_IDS,
  PAGE04_MODEL_TASKS,
  page04TaskById,
  type Page04TaskId,
  type Page04ModelTaskDefinition,
} from "./tasks";

export {
  PAGE04_ARCHITECTURE_PROMPT_VERSION,
  buildPage04SectionPromptBlock,
  buildPage04ArchitecturePromptBundle,
} from "./prompt-templates";

export {
  assemblePage04InputManifest,
  buildPage04MissingInputs,
  resolvePage04GenerationStatus,
  page04FactGapsFromDc,
  filterValidApprovedReadings,
  page04AssembledFieldIds,
  assertPage04InputAssemblyCoverage,
  PAGE04_FIELD_ASSEMBLERS,
  type Page04ArchitectureInputSnapshot,
  type Page04FieldAssemblyRow,
} from "./assemble-inputs";

export {
  buildPage04ArchitectureEnvelope,
  buildPage04ArchitectureProduction,
  attachPage04ArchitectureToPage,
  validatePage04CanonicalPage,
  page04TaskInterface,
  type Page04ArchitectureEnvelope,
  type Page04ArchitectureBuildOk,
  type Page04ArchitectureBuildFail,
} from "./production-path";

export {
  page04SectionTitle,
  resolvePage04ReadingOrder,
  resolvePage04SectionUnitTexts,
  resolvePage04SectionGapLines,
  assemblePage04SectionsForDisplay,
  assemblePage04PdfArgumentBodies,
  type Page04AssembledSection,
} from "./section-assembly";
