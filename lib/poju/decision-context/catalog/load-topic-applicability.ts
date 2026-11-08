/**
 * Topic Applicability Rules loader — pure resolve + production loadTopicApplicability.
 * Production registry is module-private (not exported).
 */

import {
  TOPIC_APPLICABILITY_CATALOG_VERSION,
  TOPIC_APPLICABILITY_V1_RULES,
  type TopicApplicabilityRuleDefinition,
} from "./topic-applicability.v1";

export type TopicApplicabilityCatalogVersion = string;

export type TopicApplicabilitySnapshot = {
  topic_catalog_version: TopicApplicabilityCatalogVersion;
  rules: readonly TopicApplicabilityRuleDefinition[];
};

export type TopicApplicabilityLoadResult =
  | {
      ok: true;
      topic_catalog_version: TopicApplicabilityCatalogVersion;
      rules: readonly TopicApplicabilityRuleDefinition[];
    }
  | {
      ok: false;
      reason_code:
        | "topic_catalog_version_missing"
        | "topic_catalog_version_invalid"
        | "topic_catalog_version_unknown"
        | "topic_catalog_ssot_unavailable"
        | "topic_catalog_load_failed";
    };

export type TopicApplicabilityRegistry = ReadonlyMap<
  TopicApplicabilityCatalogVersion,
  TopicApplicabilitySnapshot
>;

export { TOPIC_APPLICABILITY_CATALOG_VERSION, TOPIC_PACK_NA_CONDITION_CODE } from "./topic-applicability.v1";
export type { TopicApplicabilityRuleDefinition } from "./topic-applicability.v1";

export const ACTIVE_TOPIC_APPLICABILITY_VERSION: TopicApplicabilityCatalogVersion =
  TOPIC_APPLICABILITY_CATALOG_VERSION;

const productionSnapshot: TopicApplicabilitySnapshot = {
  topic_catalog_version: TOPIC_APPLICABILITY_CATALOG_VERSION,
  rules: TOPIC_APPLICABILITY_V1_RULES,
};

/** Module-private — not exported from this file or barrels. */
const productionTopicRegistry: TopicApplicabilityRegistry = new Map([
  [TOPIC_APPLICABILITY_CATALOG_VERSION, productionSnapshot],
]);

function isValidTopicCatalogVersion(
  value: unknown,
): value is TopicApplicabilityCatalogVersion {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Pure resolver — tests may inject a test-local registry.
 * Never rethrows materialization errors.
 */
export function resolveTopicApplicability(
  requested: TopicApplicabilityCatalogVersion | null | undefined,
  registry: TopicApplicabilityRegistry,
  activeVersion: TopicApplicabilityCatalogVersion,
): TopicApplicabilityLoadResult {
  if (requested === null || requested === undefined || requested === "") {
    return { ok: false, reason_code: "topic_catalog_version_missing" };
  }
  if (!isValidTopicCatalogVersion(requested)) {
    return { ok: false, reason_code: "topic_catalog_version_invalid" };
  }

  try {
    if (!registry.has(requested)) {
      if (requested === activeVersion) {
        return { ok: false, reason_code: "topic_catalog_ssot_unavailable" };
      }
      return { ok: false, reason_code: "topic_catalog_version_unknown" };
    }
    const snapshot = registry.get(requested);
    if (snapshot == null) {
      return { ok: false, reason_code: "topic_catalog_load_failed" };
    }
    if (snapshot.topic_catalog_version !== requested) {
      return { ok: false, reason_code: "topic_catalog_load_failed" };
    }
    if (!Array.isArray(snapshot.rules)) {
      return { ok: false, reason_code: "topic_catalog_load_failed" };
    }
    return {
      ok: true,
      topic_catalog_version: requested,
      rules: snapshot.rules,
    };
  } catch {
    return { ok: false, reason_code: "topic_catalog_load_failed" };
  }
}

/**
 * Production wrapper. Pass ACTIVE explicitly — no default that hides missing version.
 */
export function loadTopicApplicability(
  requested: TopicApplicabilityCatalogVersion | null | undefined,
): TopicApplicabilityLoadResult {
  return resolveTopicApplicability(
    requested,
    productionTopicRegistry,
    ACTIVE_TOPIC_APPLICABILITY_VERSION,
  );
}

export function findTopicRuleDefinition(
  load: Extract<TopicApplicabilityLoadResult, { ok: true }>,
  ruleId: string,
): TopicApplicabilityRuleDefinition | undefined {
  return load.rules.find((r) => r.rule_id === ruleId);
}
