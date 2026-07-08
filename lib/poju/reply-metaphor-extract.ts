/**
 * Block 65 追加 — Insight Memory：标志性比喻短语抽取（本地、确定性）。
 * 与 anchored_fact_ids（术语 id）互补；比喻不在闭集术语里。
 */

/** 高频复读比喻 — 子串命中即记录（整场勿再用）。 */
const CURATED_METAPHOR_PHRASES = [
  "藤蔓",
  "冷却模块",
  "冷却机制",
  "外部支点",
  "外部支撑",
  "外部结构",
  "通行证",
  "打卡",
  "棉花",
  "空转",
  "架子",
  "借势",
] as const;

const EN_METAPHOR_PHRASES = [
  "cooling module",
  "external anchor",
  "external support",
  "passport",
  "vine",
  "cotton",
  "scaffolding",
] as const;

/** Strip term markers so visible soft labels are scanned for metaphor reuse. */
function plainTextForMetaphorScan(text: string): string {
  return text
    .replace(/⟦t:[^⟧]+⟧/g, " ")
    .replace(/⟦g\|[^⟧]+⟧/g, " ")
    .replace(/\s+/g, " ");
}

/** Extract distinctive metaphor / imagery phrases from one assistant reply. */
export function extractUsedMetaphorsFromAssistant(text: string): string[] {
  const plain = plainTextForMetaphorScan(text);
  if (!plain.trim()) return [];

  const found = new Set<string>();
  const lower = plain.toLowerCase();

  for (const phrase of CURATED_METAPHOR_PHRASES) {
    if (plain.includes(phrase)) found.add(phrase);
  }
  for (const phrase of EN_METAPHOR_PHRASES) {
    if (lower.includes(phrase)) found.add(phrase);
  }

  for (const m of plain.matchAll(/[\u4e00-\u9fff]{2,10}模块/g)) {
    const s = m[0]?.trim();
    if (s) found.add(s);
  }
  for (const m of plain.matchAll(/外部[\u4e00-\u9fff]{1,8}/g)) {
    const s = m[0]?.trim();
    if (s) found.add(s);
  }
  for (const m of plain.matchAll(/像[\u4e00-\u9fff]{1,6}(?:一样|般|那样)/g)) {
    const inner = m[0]?.replace(/^像/, "").replace(/(?:一样|般|那样)$/, "").trim();
    if (inner && inner.length >= 2) found.add(inner);
  }

  return [...found].slice(0, 16);
}

export function mergeUsedMetaphors(existing: string[] | undefined, incoming: string[]): string[] {
  const merged = [...(existing ?? [])];
  for (const phrase of incoming) {
    const t = phrase.trim();
    if (!t || merged.includes(t)) continue;
    merged.push(t);
  }
  return merged;
}

/** User-side avoid block — dynamic per session, not in System. */
export function buildUsedMetaphorsAvoidBlock(
  metaphors: string[] | undefined,
  locale: string,
): string {
  if (!metaphors?.length) return "";
  const list = metaphors.join("、");
  if (locale.startsWith("zh")) {
    return `## 已用过的比喻（本轮勿再用 · 用户不可见）
【已用过的比喻，勿再用】: ${list}
本轮若要打比方，换一个未用过的；或【直接说本质，不打比方】。相近判断优先换一块新命理料谈，勿给旧判断换新比喻皮。`;
  }
  return `## Used metaphors (do not repeat · user-invisible)
Already used this session — do not reuse: ${list}
Use a fresh image, or state the essence plainly without metaphor. Prefer new structural material over rephrasing the same judgment.`;
}
