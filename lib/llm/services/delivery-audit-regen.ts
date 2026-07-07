/**
 * Read-only delivery audit + one-shot low-temp regen hint (§3.5 + grounding §3.5).
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import type { RelationLabel } from "@/lib/calculations/relation-engine";
import {
  auditDeliveredText,
  type ComplianceViolation,
} from "@/lib/llm/sanitize/compliance-terms";
import {
  auditGroundingMarkers,
  auditOutOfSetTerms,
} from "@/lib/llm/sanitize/term-marking";

export type DeliveryProduct = "poju" | "glyph" | "match" | "syncro";

const GROUNDING_THRESHOLDS: Record<
  DeliveryProduct,
  { minDistinct: number; minDepth: number }
> = {
  poju: { minDistinct: 4, minDepth: 1 },
  glyph: { minDistinct: 3, minDepth: 1 },
  match: { minDistinct: 3, minDepth: 1 },
  syncro: { minDistinct: 3, minDepth: 0 },
};

function collectDeepStrings(value: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      Object.values(v as Record<string, unknown>).forEach(walk);
    }
  };
  walk(value);
  return out;
}

export function auditDeepStringFields(
  value: unknown,
  locale: string,
  product?: DeliveryProduct,
  opts?: { structured?: ProfileStructured | null; relations?: RelationLabel[] },
): ComplianceViolation[] {
  const all: ComplianceViolation[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") {
      all.push(...auditDeliveredText(v, locale, opts?.structured, { relations: opts?.relations }));
    } else if (Array.isArray(v)) {
      v.forEach(walk);
    } else if (v && typeof v === "object") {
      Object.values(v as Record<string, unknown>).forEach(walk);
    }
  };
  walk(value);

  if (product) {
    const joined = collectDeepStrings(value).join("\n");
    const t = GROUNDING_THRESHOLDS[product];
    const grounding = auditGroundingMarkers(joined, t.minDistinct, t.minDepth);
    if (grounding) {
      console.warn(
        `[compliance-audit] grounding low (${product}): distinct=${grounding.distinctCount} depth=${grounding.depthCount}`,
        grounding.ids,
      );
    }
  }

  const seen = new Set<string>();
  return all.filter((v) => {
    const key = `${v.label}:${v.snippet}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function isCriticalDeliveryAuditFailure(
  violations: ComplianceViolation[],
): boolean {
  return violations.some(
    (v) =>
      v.label === "bare_sign_poem" ||
      v.label === "broken_marker" ||
      v.label === "marker_missing_plain" ||
      v.label.startsWith("marker_visible_"),
  );
}

export function buildAuditRegenHint(
  violations: ComplianceViolation[],
  locale: string,
): string {
  const labels = [...new Set(violations.map((v) => v.label))].slice(0, 10).join(", ");
  return locale.startsWith("zh")
    ? `\n\n【合规复审未通过 — 须重写全部字符串字段】问题类型：${labels}。仅两条硬红线：① 不报具体日期/时间点（只给阶段趋势）② 不占卜/不宿命。命理词须 ⟦t:id|软译|白话⟧ 打标（漏打 UI 会补）；禁裸签诗原文、禁 broken marker。返回完整 JSON/text。`
    : `\n\n[COMPLIANCE RE-AUDIT FAILED — rewrite ALL string fields] Issue types: ${labels}. Hard redlines only: (1) no point-in-time date predictions — phase trends only; (2) no divination/fatalism. Use ⟦t:id|soft|plain⟧ markers (UI auto-marks bare terms). NO verbatim sign-poem lines; NO broken markers. Return complete JSON/text.`;
}
