/**
 * Test-local DIR N/A Catalog registries — scripts/** only.
 * Must never be imported from lib/poju production modules.
 */

import type {
  DirNaCatalogRegistry,
  DirNaCatalogSnapshot,
  DirNaCatalogVersion,
} from "@/lib/poju/decision-context/catalog";
import type { DirNaCatalogEntry } from "@/lib/poju/decision-context/explicit-na-validate";
import { DIR_NA_CATALOG_V1_ENTRIES } from "@/lib/poju/decision-context/catalog/dir-na-catalog.v1";

/** Registry with no key for version 1 (ACTIVE gap → ssot_unavailable). */
export function registryWithoutVersion(
  version: DirNaCatalogVersion,
): DirNaCatalogRegistry {
  const m = new Map<DirNaCatalogVersion, DirNaCatalogSnapshot>();
  if (version !== 1) {
    m.set(1, {
      dir_catalog_version: 1,
      entries: [{ dir_id: "DIR-DEF-QUESTION", na_conditions: [] }],
    });
  }
  return m;
}

/** has(version) throws → load_failed (exception boundary). */
export function registryThrowingOnHas(
  version: DirNaCatalogVersion,
): DirNaCatalogRegistry {
  const inner = new Map<DirNaCatalogVersion, DirNaCatalogSnapshot>([
    [
      version,
      {
        dir_catalog_version: version,
        entries: [{ dir_id: "DIR-DEF-QUESTION", na_conditions: [] }],
      },
    ],
  ]);
  return {
    has: (_k: DirNaCatalogVersion) => {
      throw new Error("test registry.has throw");
    },
    get: (k: DirNaCatalogVersion) => inner.get(k),
    forEach: inner.forEach.bind(inner),
    size: inner.size,
    entries: inner.entries.bind(inner),
    keys: inner.keys.bind(inner),
    values: inner.values.bind(inner),
    [Symbol.iterator]: () => inner[Symbol.iterator](),
  } as DirNaCatalogRegistry;
}

/** has(1) true but get(1) throws → load_failed. */
export function registryThrowingOnGet(
  version: DirNaCatalogVersion,
): DirNaCatalogRegistry {
  const inner = new Map<DirNaCatalogVersion, DirNaCatalogSnapshot>([
    [
      version,
      {
        dir_catalog_version: version,
        entries: [{ dir_id: "DIR-DEF-QUESTION", na_conditions: [] }],
      },
    ],
  ]);
  return {
    has: (k: DirNaCatalogVersion) => inner.has(k),
    get: (_k: DirNaCatalogVersion) => {
      throw new Error("test materialize throw");
    },
    forEach: inner.forEach.bind(inner),
    size: inner.size,
    entries: inner.entries.bind(inner),
    keys: inner.keys.bind(inner),
    values: inner.values.bind(inner),
    [Symbol.iterator]: () => inner[Symbol.iterator](),
  } as DirNaCatalogRegistry;
}

/** Snapshot version field mismatches map key → load_failed. */
export function registryVersionMismatch(
  key: DirNaCatalogVersion,
  wrongVersion: DirNaCatalogVersion,
): DirNaCatalogRegistry {
  return new Map([
    [
      key,
      {
        dir_catalog_version: wrongVersion,
        entries: [{ dir_id: "DIR-DEF-QUESTION", na_conditions: [] }],
      },
    ],
  ]);
}

/** entries is not an array → load_failed. */
export function registryNonArrayEntries(
  version: DirNaCatalogVersion,
): DirNaCatalogRegistry {
  return new Map([
    [
      version,
      {
        dir_catalog_version: version,
        entries: null as unknown as readonly DirNaCatalogEntry[],
      },
    ],
  ]);
}

/**
 * Additive-only: full production v1 entries ⊆ v2 entries.
 * v1Pairs = every non-empty (dir_id, code) from the v1 catalog.
 */
export function additiveV1V2Registries(): {
  v1: DirNaCatalogRegistry;
  v2: DirNaCatalogRegistry;
  v1Pairs: Array<{ dir_id: string; code: string }>;
} {
  const v1Entries: readonly DirNaCatalogEntry[] = DIR_NA_CATALOG_V1_ENTRIES;
  const v1Pairs: Array<{ dir_id: string; code: string }> = [];
  for (const entry of v1Entries) {
    for (const code of entry.na_conditions) {
      v1Pairs.push({ dir_id: entry.dir_id, code });
    }
  }

  const v2Entries: DirNaCatalogEntry[] = v1Entries.map((entry) => {
    if (entry.dir_id === "DIR-DEF-UNACCEPTABLE") {
      return {
        dir_id: entry.dir_id,
        na_conditions: [
          ...entry.na_conditions,
          "explicit_extra_additive_only",
        ],
      };
    }
    return {
      dir_id: entry.dir_id,
      na_conditions: [...entry.na_conditions],
    };
  });
  v2Entries.push({
    dir_id: "DIR-NEW-ADDITIVE",
    na_conditions: ["explicit_new_dir_condition"],
  });

  return {
    v1: new Map([
      [1, { dir_catalog_version: 1, entries: v1Entries }],
    ]),
    v2: new Map([
      [2, { dir_catalog_version: 2, entries: v2Entries }],
    ]),
    v1Pairs,
  };
}
