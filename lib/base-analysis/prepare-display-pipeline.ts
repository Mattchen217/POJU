/**
 * Shared base-analysis display pipeline (teaser + full report).
 * Model output → sanitize → auto-mark → (UI: parseReadingBlocks → GlossaryText).
 * Gate audits the soft-visible text users actually see.
 */

import {
  sanitizePaymentAuditLeaks,
  toSoftTranslatedPlainText,
} from "@/lib/llm/sanitize/compliance-terms";
import {
  prepareTextForGlossaryRender,
  stripMarkersForPrompt,
} from "@/lib/llm/sanitize/term-marking";

/** Sanitized + auto-marked markdown ready for RichReadingText. */
export function prepareBaseAnalysisDisplayText(text: string, locale: string): string {
  if (!text?.trim()) return text ?? "";
  const scrubbed = sanitizePaymentAuditLeaks(text, locale);
  return prepareTextForGlossaryRender(scrubbed, locale);
}

/**
 * Final user-visible soft text after sanitize + auto-mark + strip markers.
 * Delivery gate / auditDeliveredText should prefer this over raw model output.
 */
export function renderBaseAnalysisSoftText(text: string, locale: string): string {
  if (!text?.trim()) return text ?? "";
  return toSoftTranslatedPlainText(text, locale);
}

/** Soft-visible audit subject (markers → visible soft labels only). */
export function softVisibleForAudit(markedOrRaw: string, locale: string): string {
  if (!markedOrRaw?.trim()) return markedOrRaw ?? "";
  const prepared = prepareBaseAnalysisDisplayText(markedOrRaw, locale);
  return stripMarkersForPrompt(prepared);
}
