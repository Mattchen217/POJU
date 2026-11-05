/**
 * DIR N/A Catalog loader — pure resolveDirNaCatalog + production loadDirNaCatalog.
 * Production registry is module-private (not exported).
 */

import type { DirNaCatalogEntry } from "../explicit-na-validate";
import {
  DIR_NA_CATALOG_VERSION,
  DIR_NA_CATALOG_V1_ENTRIES,
} from "./dir-na-catalog.v1";

export type DirNaCatalogVersion = number;

export type DirNaCatalogSnapshot = {
  dir_catalog_version: DirNaCatalogVersion;
  entries: readonly DirNaCatalogEntry[];
};

export type DirNaCatalogLoadResult =
  | {
      ok: true;
      dir_catalog_version: DirNaCatalogVersion;
      entries: readonly DirNaCatalogEntry[];
    }
  | {
      ok: false;
      reason_code:
        | "dir_catalog_version_missing"
        | "dir_catalog_version_invalid"
        | "dir_catalog_version_unknown"
        | "dir_catalog_ssot_unavailable"
        | "dir_catalog_load_failed";
    };

export type DirNaCatalogRegistry = ReadonlyMap<
  DirNaCatalogVersion,
  DirNaCatalogSnapshot
>;

export { DIR_NA_CATALOG_VERSION };
export const ACTIVE_DIR_NA_CATALOG_VERSION: DirNaCatalogVersion =
  DIR_NA_CATALOG_VERSION;

const productionSnapshot: DirNaCatalogSnapshot = {
  dir_catalog_version: DIR_NA_CATALOG_VERSION,
  entries: DIR_NA_CATALOG_V1_ENTRIES,
};

/** Module-private — not exported from this file or barrels. */
const productionDirNaRegistry: DirNaCatalogRegistry = new Map([
  [DIR_NA_CATALOG_VERSION, productionSnapshot],
]);

function isValidDirNaCatalogVersion(
  value: unknown,
): value is DirNaCatalogVersion {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

/**
 * Pure resolver — tests may inject a test-local registry.
 * Never rethrows materialization errors.
 */
export function resolveDirNaCatalog(
  requested: DirNaCatalogVersion | null | undefined,
  registry: DirNaCatalogRegistry,
  activeVersion: DirNaCatalogVersion,
): DirNaCatalogLoadResult {
  if (requested === null || requested === undefined) {
    return { ok: false, reason_code: "dir_catalog_version_missing" };
  }
  if (!isValidDirNaCatalogVersion(requested)) {
    return { ok: false, reason_code: "dir_catalog_version_invalid" };
  }

  // has / get / snapshot reads share one exception boundary → load_failed.
  // Normal has()===false keeps ssot_unavailable vs version_unknown classification.
  try {
    if (!registry.has(requested)) {
      if (requested === activeVersion) {
        return { ok: false, reason_code: "dir_catalog_ssot_unavailable" };
      }
      return { ok: false, reason_code: "dir_catalog_version_unknown" };
    }
    const snapshot = registry.get(requested);
    if (snapshot == null) {
      return { ok: false, reason_code: "dir_catalog_load_failed" };
    }
    if (snapshot.dir_catalog_version !== requested) {
      return { ok: false, reason_code: "dir_catalog_load_failed" };
    }
    if (!Array.isArray(snapshot.entries)) {
      return { ok: false, reason_code: "dir_catalog_load_failed" };
    }
    return {
      ok: true,
      dir_catalog_version: requested,
      entries: snapshot.entries,
    };
  } catch {
    return { ok: false, reason_code: "dir_catalog_load_failed" };
  }
}

/**
 * Production wrapper. No default parameter — pass ACTIVE explicitly.
 * Explicit undefined/null → dir_catalog_version_missing.
 */
export function loadDirNaCatalog(
  requested: DirNaCatalogVersion | null | undefined,
): DirNaCatalogLoadResult {
  return resolveDirNaCatalog(
    requested,
    productionDirNaRegistry,
    ACTIVE_DIR_NA_CATALOG_VERSION,
  );
}

export function assertNaConditionInDirCatalog(
  load: Extract<DirNaCatalogLoadResult, { ok: true }>,
  dirId: string,
  code: string,
):
  | { ok: true }
  | { ok: false; reason_code: "dir_not_in_catalog" | "na_condition_not_in_catalog" } {
  const entry = load.entries.find((e) => e.dir_id === dirId);
  if (!entry) {
    return { ok: false, reason_code: "dir_not_in_catalog" };
  }
  if (!entry.na_conditions.includes(code)) {
    return { ok: false, reason_code: "na_condition_not_in_catalog" };
  }
  return { ok: true };
}
