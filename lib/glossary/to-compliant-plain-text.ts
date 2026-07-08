/**
 * Block 62-Part3 — compliant plain text for any export surface (copy / TTS / share / PDF).
 * Deterministic: auto-mark bare terms → soft visible labels → belt-and-suspenders scrub.
 */

import {
  prepareTextForGlossaryRender,
  stripBrokenMarkers,
  stripMarkersForPrompt,
} from "@/lib/llm/sanitize/term-marking";
import { scrubLeakedComplianceTerms } from "@/lib/llm/sanitize/compliance-terms";

/**
 * Any text leaving the app must pass through here.
 * 1) autoMarkBareTerms (+ keep_cn wrap) via prepareTextForGlossaryRender
 * 2) ⟦t:id|软译|白话⟧ → keep soft visible segment only
 * 3) scrub stray markers, bare 干支/高危词, Stripe redlines
 */
export function toCompliantPlainText(text: string, locale: string): string {
  if (!text?.trim()) return text ?? "";
  const prepared = prepareTextForGlossaryRender(text, locale);
  let plain = stripMarkersForPrompt(prepared);
  plain = stripBrokenMarkers(plain);
  return scrubLeakedComplianceTerms(plain, locale).trim();
}
