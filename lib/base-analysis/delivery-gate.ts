/**
 * Mandatory delivery gate for base-analysis — shared POJU/Glyph/Match/Syncro context base.
 * Blocks incomplete / out-of-set content before KV or IndexedDB persistence.
 * Audits final soft-visible text; hard bans come from lib/llm/compliance/banned-terms.ts only.
 */

import { softVisibleForAudit } from "@/lib/base-analysis/prepare-display-pipeline";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { computeNatalChartRelations } from "@/lib/calculations/relation-engine";
import { isHardBannedTermLabel } from "@/lib/llm/compliance/banned-terms";
import {
  auditDeliveredText,
  auditMetaphorBlacklist,
  auditSoftReplaceReadability,
  auditUserFacingBannedLeaks,
  type ComplianceViolation,
} from "@/lib/llm/sanitize/compliance-terms";
import {
  auditMarkerCompleteness,
  auditShenShaAgainstInstance,
  maskMarkersForAudit,
  prepareTextForGlossaryRender,
  stripMarkersForPrompt,
} from "@/lib/llm/sanitize/term-marking";

export const BASE_ANALYSIS_GATE_ERROR = "BASE_ANALYSIS_DELIVERY_GATE_FAILED";

export type BaseAnalysisGateResult = {
  ok: boolean;
  violations: ComplianceViolation[];
};

function dedupeViolations(violations: ComplianceViolation[]): ComplianceViolation[] {
  const seen = new Set<string>();
  return violations.filter((v) => {
    const key = `${v.label}:${v.snippet}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Full base-analysis delivery audit (shared context base — hard gate before persist). */
export function auditBaseAnalysisDelivery(
  text: string,
  locale: string,
  structured: ProfileStructured,
): BaseAnalysisGateResult {
  const marked = prepareTextForGlossaryRender(text, locale);
  const softVisible = softVisibleForAudit(text, locale);
  const maskedMarked = maskMarkersForAudit(marked);

  const violations = dedupeViolations([
    ...auditDeliveredText(maskedMarked, locale, structured, {
      relations: computeNatalChartRelations(structured),
    }),
    ...auditUserFacingBannedLeaks(softVisible, locale),
    ...auditUserFacingBannedLeaks(maskedMarked, locale),
    ...auditMetaphorBlacklist(softVisible, locale),
    ...auditSoftReplaceReadability(softVisible, locale),
    ...auditDeliveredText(stripMarkersForPrompt(marked), locale).filter((v) =>
      isHardBannedTermLabel(v.label),
    ),
    ...auditMarkerCompleteness(marked),
    ...auditShenShaAgainstInstance(marked, structured),
  ]);

  if (violations.length > 0) {
    console.warn(
      `[base-analysis-gate] blocked (${violations.length}, locale=${locale}):`,
      violations.slice(0, 8),
    );
  }

  return { ok: !isBaseAnalysisGateFailure(violations), violations };
}

/** Critical failures that must block persist / trigger repair (then optional full regen). */
export function isBaseAnalysisGateFailure(violations: ComplianceViolation[]): boolean {
  return violations.some(
    (v) =>
      v.label === "broken_marker" ||
      v.label.startsWith("broken_marker_") ||
      v.label.startsWith("out_of_set_") ||
      v.label.startsWith("shen_sha_") ||
      v.label.startsWith("relation_") ||
      v.label === "bare_ganzhi" ||
      v.label === "stem_element" ||
      v.label.startsWith("term_density:") ||
      v.label === "marker_missing_plain" ||
      v.label.startsWith("marker_visible_") ||
      isHardBannedTermLabel(v.label) ||
      v.label === "soft_replace_unreadable" ||
      v.label === "payment_leak:chained_soft_replace",
  );
}

/** Last-resort full rewrite hint — prefer repairViolationsOnly first. */
export function buildBaseAnalysisRegenHint(
  violations: ComplianceViolation[],
  locale: string,
): string {
  const labels = [...new Set(violations.map((v) => v.label))].slice(0, 12).join(", ");
  return locale.startsWith("zh")
    ? `\n\n【元报告落库门禁仍未通过（定点修补已用尽）— 须完整重写 Markdown 正文】问题：${labels}。神煞只能逐字取自本次 structured 实例清单；每个 ⟦t:id|可见词|白话⟧ 必须三段位闭合；禁裸干支/禁词见 system 禁词块；零大运/零年龄段时间锚。返回完整正文，勿截断。`
    : `\n\n[BASE-ANALYSIS DELIVERY GATE STILL FAILING after surgical repair — rewrite COMPLETE Markdown body] Issues: ${labels}. Shen_sha ONLY from structured inventory; every ⟦t:id|visible|plain⟧ fully closed; honor system banned-terms block; zero decade/age-band anchors. Return complete text.`;
}
