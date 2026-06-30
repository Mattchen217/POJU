/**
 * POJU v6 prompt transport — production default (2026-06).
 *
 * V6 is ON by default on main. Rollback to v5: ENABLE_POJU_V6=false
 */

let memoryOverride: boolean | null = null;

/** Runtime memory toggle (tests / dev console). Does not persist. */
export function setPojuV6EnabledInMemory(enabled: boolean | null): void {
  memoryOverride = enabled;
}

/** True when v6 prompt transport + phase modules run (default: true). */
export function isPojuV6Enabled(): boolean {
  if (memoryOverride !== null) return memoryOverride;
  if (process.env.ENABLE_POJU_V6 === "false") return false;
  return true;
}
