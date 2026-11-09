/**
 * Production DIR N/A Catalog + Topic Applicability + DDR/DIR Definition Catalogs.
 * Does not export production Registry Maps.
 */

export {
  ACTIVE_DIR_NA_CATALOG_VERSION,
  DIR_NA_CATALOG_VERSION,
  assertNaConditionInDirCatalog,
  loadDirNaCatalog,
  resolveDirNaCatalog,
  type DirNaCatalogLoadResult,
  type DirNaCatalogRegistry,
  type DirNaCatalogSnapshot,
  type DirNaCatalogVersion,
} from "./load-dir-na-catalog";

export {
  ACTIVE_TOPIC_APPLICABILITY_VERSION,
  TOPIC_APPLICABILITY_CATALOG_VERSION,
  TOPIC_PACK_NA_CONDITION_CODE,
  findTopicRuleDefinition,
  loadTopicApplicability,
  resolveTopicApplicability,
  type TopicApplicabilityCatalogVersion,
  type TopicApplicabilityLoadResult,
  type TopicApplicabilityRegistry,
  type TopicApplicabilityRuleDefinition,
  type TopicApplicabilitySnapshot,
} from "./load-topic-applicability";

export {
  DIR_DEFINITION_CATALOG_VERSION,
  DIR_DEFINITION_CATALOG_V1_ENTRIES,
  dirDefinitionById,
  type DirDefinitionCategory,
  type DirDefinitionEntry,
} from "./dir-definition-catalog.v1";

export {
  ACTIVE_DIR_DEFINITION_CATALOG_VERSION,
  assertDirIdInDefinitionCatalog,
  loadDirDefinitionCatalog,
  resolveDirDefinitionCatalog,
  type DirDefinitionCatalogLoadResult,
  type DirDefinitionCatalogSnapshot,
  type DirDefinitionCatalogVersion,
} from "./load-dir-definition-catalog";

export {
  DDR_CATALOG_VERSION,
  DDR_CATALOG_V1_ENTRIES,
  DIR_TO_DDR_INDEX_V1,
  buildDirToDdrIndex,
  ddrDefinitionById,
  type DdrDefinitionEntry,
  type DdrPriority,
} from "./ddr-catalog.v1";

export {
  ACTIVE_DDR_CATALOG_VERSION,
  assertDdrIdInCatalog,
  loadDdrCatalog,
  resolveDdrCatalog,
  type DdrCatalogLoadResult,
  type DdrCatalogSnapshot,
  type DdrCatalogVersion,
} from "./load-ddr-catalog";
