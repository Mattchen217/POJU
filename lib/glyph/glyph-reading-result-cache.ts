import type { GlyphReadingServiceResult } from "@/lib/llm/services/glyph-reading-service";

const CACHE_PREFIX = "pojulife_glyph_reading_result_v1_";

export function loadCachedGlyphReadingResult(readingId: string): GlyphReadingServiceResult | null {
  if (typeof window === "undefined" || !readingId) return null;
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${readingId}`);
    if (!raw) return null;
    return JSON.parse(raw) as GlyphReadingServiceResult;
  } catch {
    return null;
  }
}

export function saveCachedGlyphReadingResult(readingId: string, result: GlyphReadingServiceResult): void {
  if (typeof window === "undefined" || !readingId) return;
  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${readingId}`, JSON.stringify(result));
  } catch {
    // ignore quota
  }
}
