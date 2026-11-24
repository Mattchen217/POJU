/**
 * Page08 architecture barrel — Batch 1 production-system SSOT.
 */

export {
  PAGE08_SECTION_IDS,
  PAGE08_SECTION_DEFINITIONS,
  page08SectionById,
  page08DefaultReadingOrder,
  page08RequiredSectionIds,
  isPage08SectionId,
  normalizePage08ReadingOrder,
  type Page08SectionId,
  type Page08SegmentLetter,
  type Page08SectionDefinition,
} from "./sections";

export {
  PAGE08_GAP_STATUSES,
  isPage08GapStatus,
  gapStatusFromDcFactStatus,
  type Page08GapStatus,
  type Page08MissingInput,
  type Page08GenerationStatus,
} from "./gaps";

export {
  PAGE08_INPUT_SOURCE_KINDS,
  PAGE08_INPUT_FIELD_CONTRACTS,
  page08InputContractsForSection,
  page08InputContractById,
  type Page08InputSourceKind,
  type Page08InputFieldContract,
  type Page08InputManifestEntry,
} from "./input-contracts";

export {
  PAGE08_SECTION_CONTENT_SPECS,
  page08ContentSpecForSection,
  type Page08ContentKind,
  type Page08SectionContentSpec,
} from "./content-specs";

export {
  PAGE08_TASK_IDS,
  PAGE08_MODEL_TASKS,
  page08TaskById,
  type Page08TaskId,
  type Page08ModelTaskDefinition,
} from "./tasks";

export {
  PAGE08_ARCHITECTURE_PROMPT_VERSION,
  buildPage08SectionPromptBlock,
  buildPage08ArchitecturePromptBundle,
} from "./prompt-templates";

export {
  assemblePage08InputManifest,
  buildPage08MissingInputs,
  resolvePage08GenerationStatus,
  page08FactGapsFromDc,
  page08AssembledFieldIds,
  assertPage08InputAssemblyCoverage,
  PAGE08_FIELD_ASSEMBLERS,
  type Page08ArchitectureInputSnapshot,
  type Page08FieldAssemblyRow,
  type Page08Page07Presence,
} from "./assemble-inputs";

export {
  buildPage08ArchitectureEnvelope,
  buildPage08ArchitectureProduction,
  attachPage08ArchitectureToPage,
  validatePage08CanonicalPage,
  page08TaskInterface,
  type Page08ArchitectureEnvelope,
  type Page08ArchitectureBuildOk,
  type Page08ArchitectureBuildFail,
} from "./production-path";

export {
  page08SectionTitle,
  resolvePage08ReadingOrder,
  resolvePage08SectionUnitTexts,
  resolvePage08SectionGapLines,
  assemblePage08SectionsForDisplay,
  assemblePage08PdfArgumentBodies,
  type Page08AssembledSection,
} from "./section-assembly";

export {
  PAGE08_UPSTREAM_CONTRACT,
  PAGE08_DOWNSTREAM_CONTRACT,
  PAGE08_STABLE_OUTPUT_FIELDS_FOR_DOWNSTREAM,
} from "./dependency-contracts";
