import {
  auditOutOfSetTerms,
  auditRelationsAgainstInstance,
  auditShenShaAgainstInstance,
  stripOutOfSetFactTerms,
} from "@/lib/llm/sanitize/term-marking";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import type { RelationLabel } from "@/lib/calculations/relation-engine";

/** 命中集外神煞 / 在集内但不在本盘 → 视为污染，必须熔断重生成。 */
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

/** 通用熔断重试：generate() 产文 → 检测 → 脏则带纠正提示重生成；耗尽后剥离降级交付，不抛错。 */
export async function generateWithClosedSetGuard(args: {
  generate: (correctiveHint: string | null) => Promise<string>;
  structured: ProfileStructured | null;
  locale: string;
  maxRetries?: number;
  label: string;
  opts?: { relations?: RelationLabel[] };
}): Promise<string> {
  const maxRetries = args.maxRetries ?? 2;
  let hint: string | null = null;
  let lastText = "";
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const text = await args.generate(hint);
    lastText = text;
    const { polluted, hits } = detectShenShaPollution(
      text,
      args.structured,
      args.locale,
      args.opts,
    );
    if (!polluted) return text;
    console.error(
      `[circuit-breaker:${args.label}] 集外神煞/关系污染，熔断重试 ${attempt + 1}/${maxRetries}:`,
      hits.slice(0, 5),
    );
    hint =
      `⚠️ 你上一次产出包含了集外或不在本盘的神煞/关系：${hits.slice(0, 5).join("、")}。` +
      `严禁！神煞只能引用本盘实例清单；关系只能引用本盘动态关系清单。删除所有集外项，重写。`;
  }
  console.warn(
    `[circuit-breaker:${args.label}] ${maxRetries} 次仍脏，剥离集外词后降级交付。`,
  );
  return stripOutOfSetFactTerms(lastText, args.structured, args.opts);
}

export { stripOutOfSetFactTerms };
