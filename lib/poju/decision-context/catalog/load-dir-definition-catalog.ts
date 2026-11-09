/**
 * DIR Definition Catalog loader — pure resolve + production load.
 */

import {
  DIR_DEFINITION_CATALOG_VERSION,
  DIR_DEFINITION_CATALOG_V1_ENTRIES,
  type DirDefinitionEntry,
} from "./dir-definition-catalog.v1";

export type DirDefinitionCatalogVersion = typeof DIR_DEFINITION_CATALOG_VERSION;

export const ACTIVE_DIR_DEFINITION_CATALOG_VERSION: DirDefinitionCatalogVersion =
  DIR_DEFINITION_CATALOG_VERSION;

export type DirDefinitionCatalogSnapshot = {
  dir_catalog_version: DirDefinitionCatalogVersion;
  entries: readonly DirDefinitionEntry[];
  by_id: ReadonlyMap<string, DirDefinitionEntry>;
};

export type DirDefinitionCatalogLoadResult =
  | { ok: true; snapshot: DirDefinitionCatalogSnapshot }
  | {
      ok: false;
      reason_code:
        | "dir_definition_version_missing"
        | "dir_definition_version_invalid"
        | "dir_definition_version_unknown"
        | "dir_definition_load_failed";
    };

const REGISTRY: Record<string, () => DirDefinitionCatalogSnapshot> = {
  [DIR_DEFINITION_CATALOG_VERSION]: () => {
    const by_id = new Map<string, DirDefinitionEntry>();
    for (const e of DIR_DEFINITION_CATALOG_V1_ENTRIES) by_id.set(e.dir_id, e);
    return {
      dir_catalog_version: DIR_DEFINITION_CATALOG_VERSION,
      entries: DIR_DEFINITION_CATALOG_V1_ENTRIES,
      by_id,
    };
  },
};

export function resolveDirDefinitionCatalog(
  version: unknown,
): DirDefinitionCatalogLoadResult {
  if (version === undefined || version === null) {
    return { ok: false, reason_code: "dir_definition_version_missing" };
  }
  if (typeof version !== "string" && typeof version !== "number") {
    return { ok: false, reason_code: "dir_definition_version_invalid" };
  }
  const key = String(version);
  if (!/^\d+(\.\d+)?$/.test(key) && key !== DIR_DEFINITION_CATALOG_VERSION) {
    // allow "1"
  }
  const factory = REGISTRY[key];
  if (!factory) {
    return { ok: false, reason_code: "dir_definition_version_unknown" };
  }
  try {
    const snapshot = factory();
    if (!snapshot.entries.length) {
      return { ok: false, reason_code: "dir_definition_load_failed" };
    }
    return { ok: true, snapshot };
  } catch {
    return { ok: false, reason_code: "dir_definition_load_failed" };
  }
}

export function loadDirDefinitionCatalog(
  version: unknown = ACTIVE_DIR_DEFINITION_CATALOG_VERSION,
): DirDefinitionCatalogLoadResult {
  return resolveDirDefinitionCatalog(version);
}

export function assertDirIdInDefinitionCatalog(
  load: DirDefinitionCatalogLoadResult,
  dirId: string,
): boolean {
  if (!load.ok) return false;
  return load.snapshot.by_id.has(dirId);
}
