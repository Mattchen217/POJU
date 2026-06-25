/**
 * OpenRouter session keys for prefix-cache observability and request grouping.
 * Upstream supplier pin: OPENROUTER_PROVIDER_ORDER → provider.order (not session_id body).
 * @see Cursor 指令 - DeepSeek 缓存省钱工程
 */

export type MatrixNarrativeProduct = "poju" | "glyph" | "match" | "syncro";

export function pojuCacheSessionId(sessionId: string): string {
  return sessionId.trim();
}

export function matchCacheSessionId(aProfileId: string, bProfileId: string): string {
  const a = aProfileId.trim();
  const b = bProfileId.trim();
  return a < b ? `match-${a}-${b}` : `match-${b}-${a}`;
}

export function glyphCacheSessionId(readingId: string | undefined, profileId: string): string {
  const rid = readingId?.trim();
  if (rid) return `glyph-${rid}`;
  return `glyph-profile-${profileId.trim()}`;
}

export function syncroCacheSessionId(sessionId: string): string {
  return sessionId.trim();
}

export function syncroProfileCacheSessionId(profileId: string): string {
  return `syncro-profile-${profileId.trim()}`;
}

/** All 12 LLM batches in one matrix run share one session key (observability; supplier pin = OPENROUTER_PROVIDER_ORDER). */
export function syncroBatchCacheSessionId(profileId: string, computeStartedAt: string): string {
  return `syncro-${profileId.trim()}-${computeStartedAt.trim()}`;
}

export function matrixNarrativeCacheSessionId(product: MatrixNarrativeProduct, locale: string): string {
  const loc = locale.startsWith("zh") ? "zh" : locale.split("-")[0] || "en";
  return `preview-mn-${product}-${loc}`;
}

export function baseAnalysisCacheSessionId(profileId: string): string {
  return `base-analysis-${profileId.trim()}`;
}
