/**
 * Test-local ACTIVE DIR N/A catalog loader fault — scripts/** only.
 * Must never be imported from lib/ or app/ production modules.
 *
 * Same mechanism as the S7 boundary test: `Map.prototype.has` throws only for
 * the production catalog registry (identified by its ACTIVE snapshot pointing
 * at the real v1 entries array), so `loadDirNaCatalog` returns
 * `dir_catalog_load_failed` and the production builder throws
 * `ProductionNaAuthorityError`. No production authority is overridden.
 */

export type CatalogFault = {
  readonly hits: () => number;
  /** Idempotent. */
  readonly restore: () => void;
};

export function armActiveCatalogFault(
  activeVersion: string | number,
  activeEntries: readonly unknown[],
): CatalogFault {
  const originalHas = Map.prototype.has;
  const originalGet = Map.prototype.get;
  let hitCount = 0;
  let restored = false;
  const isProductionRegistry = (m: Map<unknown, unknown>): boolean => {
    const snap: unknown = originalGet.call(m, activeVersion);
    if (typeof snap !== "object" || snap === null) return false;
    // Structural match — avoid dual-module identity on the entries array import.
    if (Reflect.get(snap, "dir_catalog_version") !== activeVersion) return false;
    const entries = Reflect.get(snap, "entries");
    if (!Array.isArray(entries) || entries.length !== activeEntries.length) return false;
    return true;
  };
  Map.prototype.has = function faultHas(this: Map<unknown, unknown>, key: unknown): boolean {
    if (key === activeVersion && isProductionRegistry(this)) {
      hitCount += 1;
      throw new Error("S8 test-local fault: production DIR N/A registry read");
    }
    return originalHas.call(this, key);
  };
  return {
    hits: () => hitCount,
    restore: () => {
      if (restored) return;
      restored = true;
      Map.prototype.has = originalHas;
    },
  };
}
