import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { isShenshaInternalRedline } from "@/lib/glossary/shensha-disposition";
import { stripRedlineShenshaFromText } from "@/lib/poju/shensha";

/**
 * 真词真算保留可公开展示神煞，剔除 internal_redline（恐吓/宿命 + 未上闭集敏感项）。
 * 在 prompt 构造前调用；最终交付须再跑 stripRedlineShenshaFromText / textContainsRedlineShensha。
 */
export function stripRedlineShenshaFromStructured<T extends ProfileStructured>(
  structured: T,
): T {
  if (!structured?.pillars_detail) return structured;
  const clone: T = JSON.parse(JSON.stringify(structured));
  const cd = clone.pillars_detail!;
  for (const key of ["year", "month", "day", "hour"] as const) {
    const p = cd[key];
    if (p?.shen_sha?.length) {
      p.shen_sha = p.shen_sha.filter((s) => !isShenshaInternalRedline(String(s).trim()));
    }
  }
  const anyClone = clone as unknown as { shensha_instances?: unknown[] };
  if (Array.isArray(anyClone.shensha_instances)) {
    anyClone.shensha_instances = anyClone.shensha_instances.filter(
      (s) => !isShenshaInternalRedline(String(s).trim()),
    );
  }
  return clone;
}

export { stripRedlineShenshaFromText, textContainsRedlineShensha } from "@/lib/poju/shensha";
