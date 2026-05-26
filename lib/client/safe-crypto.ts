/**
 * Safari / older WebViews: crypto.randomUUID() can throw
 * "The string did not match the expected pattern" off secure origins.
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
