/**
 * Post-mark evidence polish for Phase-4 delivery.
 *
 * - autoMarkBareTerms: safety net for leftover bare jargon (not the primary path)
 * - rewriteMarkersWithSsotSoft: fill SSOT soft labels; **preserve** model situational plain
 *
 * Do **NOT** call forceSsotPlainInMarkers here — that is neutral-base only and would
 * overwrite contextual 3rd-slot glosses with dictionary definitions.
 */
import {
  autoMarkBareTerms,
  demoteWuxingMarkers,
  normalizeTermMarkerIds,
  rewriteMarkersWithSsotSoft,
} from "@/lib/llm/sanitize/term-marking";

export function polishMarkedEvidenceText(text: string, locale: string): string {
  if (!text?.trim()) return text ?? "";
  let out = text.trim();
  // Keep evidence as one paragraph so parseReadingBlocks won't split mid-evidence.
  out = out.replace(/\s*\n+\s*/g, " ");
  // Fallback only — model mark step should already have marked load-bearing terms.
  out = autoMarkBareTerms(out, locale, { maxPerPara: 8, oncePerText: false });
  out = normalizeTermMarkerIds(out, locale);
  out = demoteWuxingMarkers(rewriteMarkersWithSsotSoft(out, locale));
  return out.trim();
}
