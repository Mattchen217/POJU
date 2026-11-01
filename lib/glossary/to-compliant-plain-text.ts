/**
 * Block 62-Part3 — compliant plain text for any export surface (copy / TTS / share / PDF).
 * Deterministic: auto-mark bare terms → soft visible labels → belt-and-suspenders scrub.
 *
 * SoT TERMS-PIPELINE-SPEC-v1: export path must soft-translate **all** closed-set hits
 * (longest-match), not the UI body density cap (maxPerPara=2).
 */

import {
  prepareTextForGlossaryRender,
  stripBrokenMarkers,
  stripMarkersForPrompt,
} from "@/lib/llm/sanitize/term-marking";
import { scrubLeakedComplianceTerms } from "@/lib/llm/sanitize/compliance-terms";

/** Export / copy / TTS: mark every closed-set traditional hit (no density cap). */
const EXPORT_AUTO_MARK_OPTS = {
  maxPerPara: Number.POSITIVE_INFINITY,
  oncePerText: false,
} as const;

/**
 * Any text leaving the app must pass through here.
 * 1) autoMarkBareTerms (+ keep_cn wrap) via prepareTextForGlossaryRender — full coverage
 * 2) ⟦t:id|软译|白话⟧ → keep soft visible segment only
 * 3) scrub stray markers, bare 干支/高危词, Stripe redlines
 *
 * Phase 5: for audited export exits (HTML/email/push/PDF) prefer
 * `sanitizeExportSurface` / `sanitizePlainExport` which wrap this pipeline
 * and return structured audit hits (token hash only).
 */
export function toCompliantPlainText(text: string, locale: string): string {
  if (!text?.trim()) return text ?? "";
  const prepared = prepareTextForGlossaryRender(text, locale, EXPORT_AUTO_MARK_OPTS);
  let plain = stripMarkersForPrompt(prepared, locale);
  plain = stripBrokenMarkers(plain);
  return scrubLeakedComplianceTerms(plain, locale).trim();
}
