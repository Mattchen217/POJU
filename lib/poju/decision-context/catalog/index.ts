/**
 * Production DIR N/A Catalog + Topic Applicability API.
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
