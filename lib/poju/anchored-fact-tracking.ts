/**
 * Block 66 — 已锚定命理事实追踪（user 侧 turnContext 注入，不进 System）。
 */

const FACT_ID_LABELS: Record<string, string> = {
  day_master: "本元",
  yong_shen: "锚元",
  xi_shen: "顺势能量",
  ji_shen: "结构张力",
  eating_god: "表达从容",
  year: "岁环",
  month: "事业宫",
  day: "配偶宫",
  hour: "成果宫",
  shangguan_jianguan: "表达力与规范约束拉扯",
  xiaoshen_duoshi: "内省对表达节奏的挤占",
};

/** Extract term-marker ids from assistant visible text. */
export function extractAnchoredFactIdsFromAssistant(text: string): string[] {
  const ids = new Set<string>();
  const termRe = /⟦t:([^|]+)\|/g;
  let m: RegExpExecArray | null;
  while ((m = termRe.exec(text)) !== null) {
    const id = m[1]?.trim();
    if (id) ids.add(id);
  }
  return [...ids];
}

export function mergeAnchoredFactIds(existing: string[] | undefined, incoming: string[]): string[] {
  const merged = [...(existing ?? [])];
  for (const id of incoming) {
    if (!merged.includes(id)) merged.push(id);
  }
  return merged;
}

export function labelAnchoredFactId(id: string): string {
  return FACT_ID_LABELS[id] ?? id.replace(/_/g, " ");
}

/** User-side block: facts already covered in this session — do not re-expand. */
export function buildAnchoredFactsExclusionBlock(
  ids: string[] | undefined,
  locale: string,
): string {
  if (!ids?.length) return "";
  const labels = ids.map(labelAnchoredFactId).join("、");
  if (locale.startsWith("zh")) {
    return `## 已锚定命理事实（本轮勿复述 · 用户不可见）
以下切面在本场对话中已点透，禁止再展开或换说法重复：${labels}
本轮请用【未讲过的新切面】锚定；优先读上方「优先锚定这些」里尚未用过的项。`;
  }
  return `## Anchored facts (do not repeat · user-invisible)
Already covered this session — do not re-expand or paraphrase: ${labels}
Anchor a **new** structural angle this turn; prefer directed items not yet used.`;
}
