/**
 * Mandatory delivery gate for base-analysis — shared POJU/Glyph/Match/Syncro context base.
 * Blocks incomplete / out-of-set content before KV or IndexedDB persistence.
 * PART 2: audit runs on **final soft-visible text** (sanitize → auto-mark → strip), not raw model only.
 */

import { softVisibleForAudit } from "@/lib/base-analysis/prepare-display-pipeline";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { computeNatalChartRelations } from "@/lib/calculations/relation-engine";
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
  // Marked = sanitize+autoMark; soft-visible = what users read after GlossaryText.
  // stem_element / bare_ganzhi: audit masked marked text (soft inside ⟦t:⟧ is intentional).
  // 身弱/命/引擎/可读性: audit soft-visible (façade — soft labels must not reintroduce them).
  const marked = prepareTextForGlossaryRender(text, locale);
  const softVisible = softVisibleForAudit(text, locale);
  const maskedMarked = maskMarkersForAudit(marked);

  const violations = dedupeViolations([
    ...auditDeliveredText(maskedMarked, locale, structured, {
      relations: computeNatalChartRelations(structured),
    }),
    ...auditUserFacingBannedLeaks(softVisible, locale),
    ...auditMetaphorBlacklist(softVisible, locale),
    ...auditSoftReplaceReadability(softVisible, locale),
    // If markers strip and soft still shows bare stem compounds, catch on soft too.
    ...auditDeliveredText(stripMarkersForPrompt(marked), locale).filter(
      (v) =>
        v.label === "term:身弱" ||
        v.label === "term:身强" ||
        v.label === "term:身旺" ||
        v.label.startsWith("term:命"),
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

/** Critical failures that must block persist / trigger one-shot regen. */
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
      v.label === "term:身弱" ||
      v.label === "term:身强" ||
      v.label === "term:身旺" ||
      v.label.startsWith("term:命") ||
      v.label === "soft_replace_unreadable" ||
      v.label === "metaphor_blacklist" ||
      v.label === "payment_leak:chained_soft_replace",
  );
}

export function buildBaseAnalysisRegenHint(
  violations: ComplianceViolation[],
  locale: string,
): string {
  const labels = [...new Set(violations.map((v) => v.label))].slice(0, 12).join(", ");
  return locale.startsWith("zh")
    ? `\n\n【元报告落库门禁未通过 — 须完整重写 Markdown 正文】问题：${labels}。神煞只能逐字取自本次 structured 实例清单；严禁 元辰/六秀日/阴差阳错/空亡/将星/劫煞 等引擎不计算项。每个 ⟦t:id|可见词|白话⟧ 必须三段位闭合；禁止断标记、禁止可见词前加 the/a；每段 ≤2 金字。全文须含身份锚 + 五块分区（含能量交换）+ 收尾，零大运/零年龄段时间锚。返回完整正文，勿截断。`
    : `\n\n[BASE-ANALYSIS DELIVERY GATE FAILED — rewrite COMPLETE Markdown body] Issues: ${labels}. Shen_sha ONLY from this structured instance inventory; NEVER 元辰/六秀日/阴差阳错/Void/General Star/etc. Every ⟦t:id|visible|plain⟧ must be fully closed with plain tooltip; no broken markers; visible text = noun phrase without leading "the/a"; ≤2 markers per paragraph, ≤2 per pillar block. Return complete text—do not truncate.`;
}
