/**
 * Page05 architecture barrel — Batch 1 production-system SSOT.
 */

export {
  PAGE05_SECTION_IDS,
  PAGE05_SECTION_DEFINITIONS,
  page05SectionById,
  page05DefaultReadingOrder,
  page05RequiredSectionIds,
  isPage05SectionId,
  normalizePage05ReadingOrder,
  type Page05SectionId,
  type Page05SectionDefinition,
} from "./sections";

export {
  PAGE05_GAP_STATUSES,
  isPage05GapStatus,
  gapStatusFromDcFactStatus,
  type Page05GapStatus,
  type Page05MissingInput,
  type Page05GenerationStatus,
} from "./gaps";

export {
  PAGE05_INPUT_SOURCE_KINDS,
  PAGE05_INPUT_FIELD_CONTRACTS,
  page05InputContractsForSection,
  page05InputContractById,
  type Page05InputSourceKind,
  type Page05InputFieldContract,
  type Page05InputManifestEntry,
} from "./input-contracts";

export {
  PAGE05_SECTION_CONTENT_SPECS,
  page05ContentSpecForSection,
  type Page05ContentKind,
  type Page05SectionContentSpec,
} from "./content-specs";

export {
  PAGE05_TASK_IDS,
  PAGE05_MODEL_TASKS,
  page05TaskById,
  type Page05TaskId,
  type Page05ModelTaskDefinition,
} from "./tasks";

export {
  PAGE05_ARCHITECTURE_PROMPT_VERSION,
  buildPage05SectionPromptBlock,
  buildPage05ArchitecturePromptBundle,
} from "./prompt-templates";

export {
  assemblePage05InputManifest,
  buildPage05MissingInputs,
  resolvePage05GenerationStatus,
  page05FactGapsFromDc,
  filterValidApprovedReadings,
  page05AssembledFieldIds,
  assertPage05InputAssemblyCoverage,
  PAGE05_FIELD_ASSEMBLERS,
  type Page05ArchitectureInputSnapshot,
  type Page05FieldAssemblyRow,
} from "./assemble-inputs";

export {
  buildPage05ArchitectureEnvelope,
  buildPage05ArchitectureProduction,
  attachPage05ArchitectureToPage,
  validatePage05CanonicalPage,
  page05TaskInterface,
  type Page05ArchitectureEnvelope,
  type Page05ArchitectureBuildOk,
  type Page05ArchitectureBuildFail,
} from "./production-path";

export {
  page05SectionTitle,
  resolvePage05ReadingOrder,
  resolvePage05SectionUnitTexts,
  resolvePage05SectionGapLines,
  assemblePage05SectionsForDisplay,
  assemblePage05PdfArgumentBodies,
  type Page05AssembledSection,
} from "./section-assembly";

export {
  PAGE05_UPSTREAM_CONTRACT,
  PAGE05_DOWNSTREAM_CONTRACT,
  PAGE05_STABLE_OUTPUT_FIELDS_FOR_DOWNSTREAM,
} from "./dependency-contracts";
