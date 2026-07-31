/**
 * Post-mark evidence polish — fill SSOT slots only.
 * No sanitizeNonMarkerSegment, no forceRemarkAndFallback / 【】 delete-path.
 */
import {
  autoMarkBareTerms,
  demoteWuxingMarkers,
  forceSsotPlainInMarkers,
  normalizeTermMarkerIds,
} from "@/lib/llm/sanitize/term-marking";

export function polishMarkedEvidenceText(text: string, locale: string): string {
  if (!text?.trim()) return text ?? "";
  let out = text.trim();
  // Keep evidence as one paragraph so parseReadingBlocks won't split mid-evidence.
  out = out.replace(/\s*\n+\s*/g, " ");
  out = autoMarkBareTerms(out, locale, { maxPerPara: 8, oncePerText: false });
  out = normalizeTermMarkerIds(out, locale);
  out = demoteWuxingMarkers(forceSsotPlainInMarkers(out, locale));
  return out.trim();
}
