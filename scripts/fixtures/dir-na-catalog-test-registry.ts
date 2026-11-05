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

/** Minimal additive v1⊂v2 pair for compatibility checks. */
export function additiveV1V2Registries(): {
  v1: DirNaCatalogRegistry;
  v2: DirNaCatalogRegistry;
  v1Pairs: Array<{ dir_id: string; code: string }>;
} {
  const v1Entries: DirNaCatalogEntry[] = [
    {
      dir_id: "DIR-DEF-UNACCEPTABLE",
      na_conditions: ["explicit_no_hard_red_lines"],
    },
    { dir_id: "DIR-DEF-QUESTION", na_conditions: [] },
  ];
  const v2Entries: DirNaCatalogEntry[] = [
    {
      dir_id: "DIR-DEF-UNACCEPTABLE",
      na_conditions: [
        "explicit_no_hard_red_lines",
        "explicit_extra_additive_only",
      ],
    },
    { dir_id: "DIR-DEF-QUESTION", na_conditions: [] },
    {
      dir_id: "DIR-NEW-ADDITIVE",
      na_conditions: ["explicit_new_dir_condition"],
    },
  ];
  return {
    v1: new Map([
      [1, { dir_catalog_version: 1, entries: v1Entries }],
    ]),
    v2: new Map([
      [2, { dir_catalog_version: 2, entries: v2Entries }],
    ]),
    v1Pairs: [{ dir_id: "DIR-DEF-UNACCEPTABLE", code: "explicit_no_hard_red_lines" }],
  };
}
