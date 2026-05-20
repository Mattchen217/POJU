/**
 * @deprecated Hardcoded opening copy removed in v5. File kept so stale dev bundles
 * do not 500 when the module path is still cached. Do not call from new code.
 */
export function getFallbackOpening(_question: string, _locale: string): string {
  return "";
}
