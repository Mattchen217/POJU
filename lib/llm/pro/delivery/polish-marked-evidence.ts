/**
 * Post-mark evidence polish for Phase-4 delivery (P1).
 *
 * Primary path: `⟦w:真词⟧` slot encode → `⟦t:slug|⟧`.
 * Fallback: autoMarkBareTerms + pillar/relation wraps (zero bare 命理).
 * Tooltip situational plain is NOT filled here — GlossaryText evidence uses glossOf.
 */

import { encodeAndPolishDeliveryEvidence } from "@/lib/llm/sanitize/term-marking";

export function polishMarkedEvidenceText(text: string, locale: string): string {
  return encodeAndPolishDeliveryEvidence(text, locale);
}
