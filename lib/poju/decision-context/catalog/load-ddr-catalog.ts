/**
 * DDR Catalog loader — pure resolve + production load.
 */

import {
  DDR_CATALOG_VERSION,
  DDR_CATALOG_V1_ENTRIES,
  DIR_TO_DDR_INDEX_V1,
  type DdrDefinitionEntry,
} from "./ddr-catalog.v1";

export type DdrCatalogVersion = typeof DDR_CATALOG_VERSION;

export const ACTIVE_DDR_CATALOG_VERSION: DdrCatalogVersion = DDR_CATALOG_VERSION;

export type DdrCatalogSnapshot = {
  ddr_catalog_version: DdrCatalogVersion;
  entries: readonly DdrDefinitionEntry[];
  by_id: ReadonlyMap<string, DdrDefinitionEntry>;
  dir_to_ddr: ReadonlyMap<string, readonly string[]>;
};

export type DdrCatalogLoadResult =
  | { ok: true; snapshot: DdrCatalogSnapshot }
  | {
      ok: false;
      reason_code:
        | "ddr_catalog_version_missing"
        | "ddr_catalog_version_invalid"
        | "ddr_catalog_version_unknown"
        | "ddr_catalog_load_failed";
    };

const REGISTRY: Record<string, () => DdrCatalogSnapshot> = {
  [DDR_CATALOG_VERSION]: () => {
    const by_id = new Map<string, DdrDefinitionEntry>();
    for (const e of DDR_CATALOG_V1_ENTRIES) by_id.set(e.ddr_id, e);
    return {
      ddr_catalog_version: DDR_CATALOG_VERSION,
      entries: DDR_CATALOG_V1_ENTRIES,
      by_id,
      dir_to_ddr: DIR_TO_DDR_INDEX_V1,
    };
  },
};

export function resolveDdrCatalog(version: unknown): DdrCatalogLoadResult {
  if (version === undefined || version === null) {
    return { ok: false, reason_code: "ddr_catalog_version_missing" };
  }
  if (typeof version !== "string" && typeof version !== "number") {
    return { ok: false, reason_code: "ddr_catalog_version_invalid" };
  }
  const key = String(version);
  const factory = REGISTRY[key];
  if (!factory) {
    return { ok: false, reason_code: "ddr_catalog_version_unknown" };
  }
  try {
    const snapshot = factory();
    if (!snapshot.entries.length) {
      return { ok: false, reason_code: "ddr_catalog_load_failed" };
    }
    return { ok: true, snapshot };
  } catch {
    return { ok: false, reason_code: "ddr_catalog_load_failed" };
  }
}

export function loadDdrCatalog(
  version: unknown = ACTIVE_DDR_CATALOG_VERSION,
): DdrCatalogLoadResult {
  return resolveDdrCatalog(version);
}

export function assertDdrIdInCatalog(
  load: DdrCatalogLoadResult,
  ddrId: string,
): boolean {
  if (!load.ok) return false;
  return load.snapshot.by_id.has(ddrId);
}
