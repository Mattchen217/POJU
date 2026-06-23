import { auditOutOfSetTerms, auditShenShaAgainstInstance } from "@/lib/llm/sanitize/term-marking";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";

/** 命中集外神煞 / 在集内但不在本盘 → 视为污染，必须熔断重生成。 */
export function detectShenShaPollution(
  text: string,
  structured: ProfileStructured | null,
  _locale: string,
): { polluted: boolean; hits: string[] } {
  const hits: string[] = [];
  for (const h of auditOutOfSetTerms(text)) hits.push(h.snippet ?? String(h));
  if (structured) {
    for (const h of auditShenShaAgainstInstance(text, structured)) hits.push(h.snippet ?? String(h));
  }
  return { polluted: hits.length > 0, hits };
}

/** 通用熔断重试：generate() 产文 → 检测 → 脏则带纠正提示重生成，maxRetries 次仍脏 → 抛错。 */
export async function generateWithClosedSetGuard(args: {
  generate: (correctiveHint: string | null) => Promise<string>;
  structured: ProfileStructured | null;
  locale: string;
  maxRetries?: number;
  label: string;
}): Promise<string> {
  const maxRetries = args.maxRetries ?? 2;
  let hint: string | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const text = await args.generate(hint);
    const { polluted, hits } = detectShenShaPollution(text, args.structured, args.locale);
    if (!polluted) return text;
    console.error(
      `[circuit-breaker:${args.label}] 集外神煞污染，熔断重试 ${attempt + 1}/${maxRetries}:`,
      hits.slice(0, 5),
    );
    hint =
      `⚠️ 你上一次产出包含了集外或不在本盘的神煞：${hits.slice(0, 5).join("、")}。` +
      `严禁！神煞只能用本次 structured 实际算出的、且属于闭集 9 个（天乙贵人/禄神/飞刃/文昌/桃花/驿马/华盖/孤辰/寡宿）的那几个。` +
      `删除所有集外神煞，重写。`;
  }
  throw new Error(
    `[circuit-breaker:${args.label}] 集外神煞污染，${maxRetries} 次重试后仍脏，拒绝交付。`,
  );
}
