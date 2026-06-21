/**
 * Read-only delivery audit + one-shot low-temp regen hint (§3.5 + grounding §3.5).
 */

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
): ComplianceViolation[] {
  const all: ComplianceViolation[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") {
      all.push(...auditDeliveredText(v, locale));
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
      all.push({
        label: "grounding_low",
        snippet: `distinct=${grounding.distinctCount} depth=${grounding.depthCount} ids=${grounding.ids.slice(0, 8).join(",")}`,
      });
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
      v.label.startsWith("term:") ||
      v.label === "bare_sign_poem" ||
      v.label === "broken_marker" ||
      v.label === "grounding_low" ||
      v.label.startsWith("out_of_set_") ||
      v.label.startsWith("shen_sha_") ||
      v.label === "marker_missing_plain" ||
      v.label.startsWith("marker_visible_") ||
      v.label.includes("bazi_"),
  );
}

export function buildAuditRegenHint(
  violations: ComplianceViolation[],
  locale: string,
): string {
  const labels = [...new Set(violations.map((v) => v.label))].slice(0, 10).join(", ");
  return locale.startsWith("zh")
    ? `\n\n【合规复审未通过 — 须重写全部字符串字段】问题类型：${labels}。必须用术语表 soft 词 + ⟦t:id|可见文本|该处白话⟧ 三段位标记（keep_cn 保留中文干支如 乙木/丙午）；正文大白话+比喻入句；须引用 ≥N 个不同盘面结构（十神/神煞/格局/大运，不止四个五行词）；禁 Yi Wood / energy blueprint 等自创委婉词；禁裸签诗原文。返回完整 JSON/text。`
    : `\n\n[COMPLIANCE RE-AUDIT FAILED — rewrite ALL string fields] Issue types: ${labels}. Use ⟦t:id|visible|context plain⟧ 3-part markers (keep_cn: Chinese stem-branch like 乙木/丙午); body copy in plain language with metaphors; cite ≥N distinct chart structures (ten gods/shen sha/pattern/da yun—not just four elements); NO invented euphemisms; NO verbatim sign-poem lines. Return complete JSON/text.`;
}
