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

/**
 * 依据块锚点闸：只杀 0 锚点（结论悬空 / 假装有依据）。
 * 不设数字下限：任何 ≥1 的下限都会误杀"完整的最短承重证据链"，并逼模型注水凑数。
 */
export function auditEvidenceMarkDensity(text: string): ComplianceViolation[] {
  const out: ComplianceViolation[] = [];
  // ZH + EN dual-layer labels (v1 RichReadingText / isEvidenceLeadLabel)
  const re =
    /\*\*(?:依据与推理|Evidence\s*&\s*reasoning)[:：]\*\*([\s\S]*?)(?=\n#{2,3}\s|\n*$)/gi;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = re.exec(text)) !== null) {
    idx += 1;
    const marks = new Set(m[1]?.match(/⟦t:[^|⟧]+/g) ?? []);
    // 不设数字下限：任何 ≥1 的数字下限都会误杀"完整的最短承重证据链"（真 2 环完整就该 2 环），
    // 并逼模型注水凑数。质量由「完整的最短」内容约束 + 推理端「完整承重链」自检 + 人工验收管。
    // 代码只兜最硬一条：依据块存在、却一个承重锚点都没有 = 结论悬空 = 假装有依据。
    if (marks.size === 0) {
      out.push({
        label: "evidence_zero_anchor",
        snippet: (m[1] ?? "").trim().slice(0, 60),
      });
    }
  }
  if (idx === 0) out.push({ label: "evidence_block_missing", snippet: text.slice(0, 60) });
  return out;
}

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
    // Soft-visible (markers → slot-2) must itself be stem_element-clean.
    ...auditDeliveredText(softVisible, locale).filter(
      (v) => v.label === "stem_element" || v.label === "bare_ganzhi",
    ),
    ...auditUserFacingBannedLeaks(softVisible, locale),
    ...auditUserFacingBannedLeaks(maskedMarked, locale),
    // Metaphor on soft-visible AND on post-sanitize draft (labels/blockquote leads).
    // softVisible alone can miss label-slot hits if a strip path transforms them.
    ...auditMetaphorBlacklist(softVisible, locale),
    ...auditMetaphorBlacklist(text, locale),
    ...auditSoftReplaceReadability(softVisible, locale),
    ...auditDeliveredText(stripMarkersForPrompt(marked), locale).filter((v) =>
      isHardBannedTermLabel(v.label),
    ),
    ...auditMarkerCompleteness(marked, locale),
    ...auditShenShaAgainstInstance(marked, structured),
    ...auditEvidenceMarkDensity(text),
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
      v.label === "marker_visible_ganzhi" ||
      v.label.startsWith("term_density:") ||
      v.label === "marker_missing_plain" ||
      v.label.startsWith("marker_plain_banned") ||
      v.label.startsWith("marker_visible_") ||
      isHardBannedTermLabel(v.label) ||
      v.label === "soft_replace_unreadable" ||
      v.label === "payment_leak:chained_soft_replace" ||
      // 依据块 0 锚点 = 结论悬空 = 假装有依据；单行 repair 救不了，整篇重生成。
      v.label === "evidence_zero_anchor" ||
      v.label === "evidence_block_missing",
  );
}

/** Last-resort full rewrite hint — prefer repairViolationsOnly first. */
export function buildBaseAnalysisRegenHint(
  violations: ComplianceViolation[],
  locale: string,
): string {
  const labels = [...new Set(violations.map((v) => v.label))].slice(0, 12).join(", ");
  return locale.startsWith("zh")
    ? `\n\n【元报告落库门禁仍未通过（定点修补已用尽）— 须完整重写 Markdown 正文】问题：${labels}。神煞只能逐字取自本次 structured 实例清单；标记用标准形 ⟦t:<slug>|<贴题白话>⟧（软译由系统填；第2格白话不得为空）；禁裸干支/禁词见 system 禁词块；零大运/零年龄段时间锚。返回完整正文，勿截断。`
    : `\n\n[BASE-ANALYSIS DELIVERY GATE STILL FAILING after surgical repair — rewrite COMPLETE Markdown body] Issues: ${labels}. Shen_sha ONLY from structured inventory; markers as ⟦t:<slug>|<contextual plain>⟧ (system fills soft; plain slot must be non-empty); honor system banned-terms block; zero decade/age-band anchors. Return complete text.`;
}
