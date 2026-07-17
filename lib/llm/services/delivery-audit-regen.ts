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
      v.label.startsWith("marker_visible_") ||
      v.label.startsWith("payment_leak:"),
  );
}

export function buildAuditRegenHint(
  violations: ComplianceViolation[],
  locale: string,
): string {
  const labels = [...new Set(violations.map((v) => v.label))].slice(0, 10).join(", ");
  return locale.startsWith("zh")
    ? `\n\n【合规复审未通过 — 须重写全部字符串字段】问题类型：${labels}。仅两条硬红线：① 不报具体日期/时间点（只给阶段趋势）② 不占卜/不宿命。另：用户可见字段禁裸大运/流年/日柱/煞名/五行相克短语——只写软译白话；标记用 ⟦t:<slug>|<贴题白话>⟧（软译由系统填；白话不得为空；兼容形软译格绝不填煞/刃原名）。禁裸签诗、禁 broken marker。返回完整 JSON/text。`
    : `\n\n[COMPLIANCE RE-AUDIT FAILED — rewrite ALL string fields] Issue types: ${labels}. Hard redlines only: (1) no point-in-time date predictions — phase trends only; (2) no divination/fatalism. Also: no bare Da Yun / Day Pillar / shensha originals / element-clash phrases in user-visible fields — soft vernacular only; markers as ⟦t:<slug>|<contextual plain>⟧ (system fills soft; plain non-empty; compat soft never original 煞 names). NO verbatim sign-poem lines; NO broken markers. Return complete JSON/text.`;
}
