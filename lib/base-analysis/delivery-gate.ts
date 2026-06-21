/**
 * Mandatory delivery gate for base-analysis — shared POJU/Glyph/Match/Syncro context base.
 * Blocks incomplete / out-of-set content before KV or IndexedDB persistence.
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  auditDeliveredText,
  type ComplianceViolation,
} from "@/lib/llm/sanitize/compliance-terms";
import {
  auditMarkerCompleteness,
  auditShenShaAgainstInstance,
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
  const violations = dedupeViolations([
    ...auditDeliveredText(text, locale),
    ...auditMarkerCompleteness(text),
    ...auditShenShaAgainstInstance(text, structured),
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
      v.label === "bare_ganzhi" ||
      v.label.startsWith("term_density:") ||
      v.label === "marker_missing_plain" ||
      v.label.startsWith("marker_visible_"),
  );
}

export function buildBaseAnalysisRegenHint(
  violations: ComplianceViolation[],
  locale: string,
): string {
  const labels = [...new Set(violations.map((v) => v.label))].slice(0, 12).join(", ");
  return locale.startsWith("zh")
    ? `\n\n【元报告落库门禁未通过 — 须完整重写 Markdown 正文】问题：${labels}。神煞只能逐字取自本次 structured 实例清单；严禁 元辰/六秀日/阴差阳错/空亡/将星/劫煞 等引擎不计算项。每个 ⟦t:id|可见词|白话⟧ 必须三段位闭合；禁止断标记、禁止可见词前加 the/a；四柱逐柱段每柱最多 1–2 个金字；每段 ≤2 金字。返回完整正文，勿截断。`
    : `\n\n[BASE-ANALYSIS DELIVERY GATE FAILED — rewrite COMPLETE Markdown body] Issues: ${labels}. Shen_sha ONLY from this structured instance inventory; NEVER 元辰/六秀日/阴差阳错/Void/General Star/etc. Every ⟦t:id|visible|plain⟧ must be fully closed with plain tooltip; no broken markers; visible text = noun phrase without leading "the/a"; ≤2 markers per paragraph, ≤2 per pillar block. Return complete text—do not truncate.`;
}
