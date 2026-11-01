/**
 * TERMS-PIPELINE-SPEC-v1 display pipeline (code path).
 *
 * Dual-layer product rule:
 * - Body / narrative: vernacular only (no traditional jargon).
 * - Evidence: free traditional -> autoMark -> soft -> coined.
 *
 * LabTermsPipelinePanel and any terms-pipeline harness should import from here.
 * Implementation SoT remains in sanitize modules; this file is the stable facade.
 */

export { prepareTextForGlossaryRender } from "@/lib/llm/sanitize/term-marking";
export { toSoftTranslatedPlainText } from "@/lib/llm/sanitize/compliance-terms";
export type { Locale } from "@/lib/glossary/term-glossary";
