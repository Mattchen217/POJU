import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { OUT_OF_SET_FORBIDDEN_HAN } from "@/lib/glossary/term-closed-set";

const RED = OUT_OF_SET_FORBIDDEN_HAN as readonly string[];
const isRedlineShensha = (han: string): boolean =>
  RED.some((b) => han === b || han.includes(b));

/**
 * 真词真算保留所有中性神煞，仅剔除恐吓/宿命红线(十恶大败/孤鸾煞/童子煞/空亡…)。
 * doctrine 原则1 红线例外:这类不是中性数据源，会把宿命论算进结论 → 输入端就丢弃。
 * 深克隆，不改原对象。
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
      p.shen_sha = p.shen_sha.filter((s) => !isRedlineShensha(String(s).trim()));
    }
  }
  const anyClone = clone as unknown as { shensha_instances?: unknown[] };
  if (Array.isArray(anyClone.shensha_instances)) {
    anyClone.shensha_instances = anyClone.shensha_instances.filter(
      (s) => !isRedlineShensha(String(s).trim()),
    );
  }
  return clone;
}
