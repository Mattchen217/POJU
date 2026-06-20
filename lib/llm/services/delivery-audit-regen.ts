/**
 * Read-only delivery audit + one-shot low-temp regen hint (§3.5).
 */

import {
  auditDeliveredText,
  type ComplianceViolation,
} from "@/lib/llm/sanitize/compliance-terms";

export function auditDeepStringFields(
  value: unknown,
  locale: string,
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
      v.label.includes("bazi_"),
  );
}

export function buildAuditRegenHint(
  violations: ComplianceViolation[],
  locale: string,
): string {
  const labels = [...new Set(violations.map((v) => v.label))].slice(0, 10).join(", ");
  return locale.startsWith("zh")
    ? `\n\n【合规复审未通过 — 须重写全部字符串字段】问题类型：${labels}。必须用术语表 soft 词 + ⟦t:id|可见文本⟧ 标记（keep_cn 保留中文干支如 乙木/丙午）；禁 Yi Wood / energy blueprint / ten-year cycle 等自创委婉词；禁裸签诗原文。返回完整 JSON/text。`
    : `\n\n[COMPLIANCE RE-AUDIT FAILED — rewrite ALL string fields] Issue types: ${labels}. Use term-table soft words in ⟦t:id|visible⟧ markers (keep_cn: Chinese stem-branch in parens like 乙木/丙午); NO invented euphemisms (Yi Wood/energy blueprint/ten-year cycle); NO verbatim sign-poem lines. Return complete JSON/text.`;
}
