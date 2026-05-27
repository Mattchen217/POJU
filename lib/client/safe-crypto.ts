/**
 * Safe ID for browser / PWA (POJU, Syncro, profiles, archive).
 * - `crypto.randomUUID` is missing on HTTP (e.g. http://192.168.x.x LAN dev).
 * - Safari can throw "The string did not match the expected pattern" off secure origins.
 */
export function safeRandomUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      /* fall through */
    }
  }
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}
