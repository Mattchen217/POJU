import {
  auditOutOfSetTerms,
  auditRelationsAgainstInstance,
  auditShenShaAgainstInstance,
  stripOutOfSetFactTerms,
} from "@/lib/llm/sanitize/term-marking";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import type { RelationLabel } from "@/lib/calculations/relation-engine";

/** 命中集外神煞 / 在集内但不在本盘 → 视为编造，直接剥离（不重试）。 */
export function detectShenShaPollution(
  text: string,
  structured: ProfileStructured | null,
  _locale: string,
  opts?: { relations?: RelationLabel[] },
): { polluted: boolean; hits: string[] } {
  const hits: string[] = [];
  for (const h of auditOutOfSetTerms(text)) hits.push(h.snippet ?? String(h));
  if (structured) {
    for (const h of auditShenShaAgainstInstance(text, structured)) hits.push(h.snippet ?? String(h));
    for (const h of auditRelationsAgainstInstance(text, structured, { relations: opts?.relations })) {
      hits.push(h.snippet ?? String(h));
    }
  }
  return { polluted: hits.length > 0, hits };
}

/**
 * 闭集守卫：generate() 一次 → 集外命中即 stripOutOfSetFactTerms，不赌重试。
 * 准确性靠 prompt 侧闭集喂入；剥离只是极少数漏网兜底。
 */
export async function generateWithClosedSetGuard(args: {
  generate: (correctiveHint: string | null) => Promise<string>;
  structured: ProfileStructured | null;
  locale: string;
  /** @deprecated 不再重试；保留参数避免调用方签名破坏 */
  maxRetries?: number;
  label: string;
  opts?: { relations?: RelationLabel[] };
}): Promise<string> {
  const text = await args.generate(null);
  const { polluted, hits } = detectShenShaPollution(
    text,
    args.structured,
    args.locale,
    args.opts,
  );
  if (!polluted) return text;

  console.warn(
    `[circuit-breaker:${args.label}] 集外命中，直接剥离：`,
    hits.slice(0, 5),
  );
  return stripOutOfSetFactTerms(text, args.structured, args.opts);
}

export { stripOutOfSetFactTerms };
