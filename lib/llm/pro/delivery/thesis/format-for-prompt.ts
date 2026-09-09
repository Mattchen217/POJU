/**
 * Format chart thesis for assign/write prompts (cite-only; not a user page).
 */

import type { ChartThesis } from "@/lib/llm/pro/delivery/thesis/types";

export function formatChartThesisForPrompt(thesis: ChartThesis | null | undefined): string {
  if (!thesis?.dimensions?.length) return "";
  const lines: string[] = [
    "## 命盘总纲（结构性事实 · 只引用勿重演批断）",
    `fingerprint=${thesis.structured_fingerprint} · frozen=${thesis.judgment_core_frozen ? "yes" : "no"}`,
    "规则：claim 的结构性归因须挂 dimension_id + 本次 inference_zh；现实处境（collecting）无需总纲出处。",
    "禁止把 conclusion_zh 原样粘贴进 evidence；同维多次引用须换切入角度。",
    "缺结构出处 → thesis_gap（扩展总纲），禁止 write 现编。",
    "",
  ];
  for (const d of thesis.dimensions) {
    if (d.depth === "skip") continue;
    lines.push(`### ${d.dimension_id} · ${d.dimension_name_zh} [${d.depth}]`);
    if (d.strength_verdict) {
      lines.push(`strength_verdict: ${d.strength_verdict}`);
    }
    lines.push(`conclusion_zh: ${d.conclusion_zh}`);
    if (d.usable_claims_hint.length) {
      lines.push(`usable_claims_hint: ${d.usable_claims_hint.join("；")}`);
    }
    if (d.wuxing_relations.length) {
      lines.push(
        "wuxing_relations (结构化 · 须写成通顺句，禁【元素】拼接): " +
          d.wuxing_relations
            .map((r) => `${r.from}${r.relation}${r.to}（${r.note}）`)
            .join("；"),
      );
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}
