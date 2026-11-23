/**
 * Page02 architecture barrel — Batch 1 production-system SSOT.
 */

export {
  PAGE02_SECTION_IDS,
  PAGE02_SECTION_DEFINITIONS,
  page02SectionById,
  page02DefaultReadingOrder,
  page02RequiredSectionIds,
  isPage02SectionId,
  normalizePage02ReadingOrder,
  type Page02SectionId,
  type Page02SectionDefinition,
} from "./sections";

export {
  PAGE02_GAP_STATUSES,
  isPage02GapStatus,
  gapStatusFromDcFactStatus,
  type Page02GapStatus,
  type Page02MissingInput,
  type Page02GenerationStatus,
} from "./gaps";

export {
  PAGE02_INPUT_SOURCE_KINDS,
  PAGE02_INPUT_FIELD_CONTRACTS,
  page02InputContractsForSection,
  page02InputContractById,
  type Page02InputSourceKind,
  type Page02InputFieldContract,
  type Page02InputManifestEntry,
} from "./input-contracts";

export {
  PAGE02_SECTION_CONTENT_SPECS,
  page02ContentSpecForSection,
  type Page02ContentKind,
  type Page02SectionContentSpec,
} from "./content-specs";

export {
  PAGE02_TASK_IDS,
  PAGE02_MODEL_TASKS,
  page02TaskById,
  type Page02TaskId,
  type Page02ModelTaskDefinition,
} from "./tasks";

export {
  PAGE02_ARCHITECTURE_PROMPT_VERSION,
  buildPage02SectionPromptBlock,
  buildPage02ArchitecturePromptBundle,
} from "./prompt-templates";

export {
  assemblePage02InputManifest,
  buildPage02MissingInputs,
  resolvePage02GenerationStatus,
  page02FactGapsFromDc,
  filterValidApprovedReadings,
  page02AssembledFieldIds,
  assertPage02InputAssemblyCoverage,
  PAGE02_FIELD_ASSEMBLERS,
  type Page02ArchitectureInputSnapshot,
  type Page02FieldAssemblyRow,
} from "./assemble-inputs";

export {
  buildPage02ArchitectureEnvelope,
  buildPage02ArchitectureProduction,
  attachPage02ArchitectureToPage,
  validatePage02CanonicalPage,
  page02TaskInterface,
  type Page02ArchitectureEnvelope,
  type Page02ArchitectureBuildOk,
  type Page02ArchitectureBuildFail,
} from "./production-path";

export {
  page02SectionTitle,
  resolvePage02ReadingOrder,
  resolvePage02SectionUnitTexts,
  resolvePage02SectionGapLines,
  assemblePage02SectionsForDisplay,
  assemblePage02PdfArgumentBodies,
  type Page02AssembledSection,
} from "./section-assembly";
