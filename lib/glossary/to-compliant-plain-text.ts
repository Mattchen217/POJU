/**
 * Block 62-Part3 — compliant plain text for any export surface (copy / TTS / share / PDF).
 * Deterministic: auto-mark bare terms → soft visible labels → belt-and-suspenders scrub.
 *
 * SoT TERMS-PIPELINE-SPEC-v1: export path must soft-translate **all** closed-set hits
 * (longest-match), not the UI body density cap (maxPerPara=2).
 */

import { toSoftTranslatedPlainText } from "@/lib/llm/sanitize/compliance-terms";

/**
 * Any text leaving the app must pass through here.
 * Delegates to toSoftTranslatedPlainText (TERMS-PIPELINE-SPEC-v1 soft exit):
 * prepareText(full closed-set mark) → assemble soft connective → strip markers →
 * repair abutting SSOT soft glue → scrub leaks.
 *
 * Phase 5: for audited export exits (HTML/email/push/PDF) prefer
 * `sanitizeExportSurface` / `sanitizePlainExport` which wrap this pipeline
 * and return structured audit hits (token hash only).
 */
export function toCompliantPlainText(text: string, locale: string): string {
  return toSoftTranslatedPlainText(text, locale);
}
