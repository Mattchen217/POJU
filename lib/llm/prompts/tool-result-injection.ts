import type { ToolName } from "@/lib/poju/types";

export function buildToolResultInjectionMessage(input: {
  tool: ToolName;
  result_data: Record<string, unknown>;
  original_question: string;
}): string {
  switch (input.tool) {
    case "match":
      return buildMatchInjection(input.result_data, input.original_question);
    case "syncro":
      return buildSyncroInjection(input.result_data, input.original_question);
    case "glyph":
      return buildGlyphInjection(input.result_data, input.original_question);
  }
}

function buildMatchInjection(data: Record<string, unknown>, originalQuestion: string): string {
  const strengths = listField(data.key_strengths ?? data.strengths);
  const challenges = listField(data.key_challenges ?? data.challenges);

  return `[系统注入 · Match 结果]

用户刚才完成了 Match 双人契合分析（你此前建议的）。

## 核心数据

- 关系描述：${String(data.relationship_description ?? "—")}
- 协同类型：${String(data.synergy_type ?? data.compatibility_level ?? "—")}

## 关键优势
${strengths || "（见摘要）"}

## 关键挑战
${challenges || "（见摘要）"}

## 摘要
${String(data.summary ?? "")}

# 你接下来要做的

⭐ 当前 cycle 主题：「${originalQuestion}」

回到这个主题，基于合盘数据继续对话：
1. 简短承认你已看到结果（不要复述整份报告）
2. 把最相关的 1–2 条洞察拉回【原话题】
3. 问用户想从哪一步继续

⛔ 不要：展开新的合盘专题；把合盘当作新 session 主题
✓ 要：把洞察【应用到】原困境与行动`;
}

function buildSyncroInjection(data: Record<string, unknown>, originalQuestion: string): string {
  const matrixJson =
    data.full_matrix != null
      ? JSON.stringify(data.full_matrix, null, 2).slice(0, 24_000)
      : "（矩阵未随结果带回，仅根据任务描述回应）";

  return `[系统注入 · Syncro 结果]

用户刚才完成了 Syncro 24 小时方位时机分析（你此前建议的）。

## 用户的任务
「${String(data.task_description ?? "")}」

## 位置 / 时区
${String(data.user_location_summary ?? "—")}
真太阳时偏移：${data.true_solar_time_diff != null ? String(data.true_solar_time_diff) : "—"} 分钟
矩阵格数：${data.matrix_key_count != null ? String(data.matrix_key_count) : "—"}

## 完整矩阵（供你筛选，勿全部复述给用户）

\`\`\`json
${matrixJson}
\`\`\`

# 你接下来要做的

⭐ 当前 cycle 主题：「${originalQuestion}」

不要把 96 格全告诉用户。根据原话题里提到的具体时间，筛选 1–2 个最相关的时辰×方位，用白话给出建议，并拉回【原话题】决策。

⛔ 不要：复述整张矩阵；让 Syncro 取代原对话
✓ 要：例如「明天下午 14–16 点东南方向较顺」并回到用户的真实纠结`;
}

function buildGlyphInjection(data: Record<string, unknown>, originalQuestion: string): string {
  return `[系统注入 · Glyph 结果]

用户刚才完成了一次 Glyph 意象抽取（你此前建议的）。

## 抽到的意象
${String(data.glyph_drawn ?? data.sign_number ?? "—")}

## 含义（用户已看过，勿长段解释）
${String(data.meaning ?? "")}

## 用户问题
「${String(data.question ?? originalQuestion)}」

# 你接下来要做的

⭐ 当前 cycle 主题：「${originalQuestion}」

Glyph 用于【绕过理性】——不要当答案讲解。把意象当镜子，用 1–2 个克制的问题让用户自己说出来，并拉回 cycle 主题。

⛔ 不要：长篇解释签意；取代用户感受
✓ 要：短、开放、让用户主导`;
}

function listField(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .slice(0, 3)
    .map((s, i) => `${i + 1}. ${String(s)}`)
    .join("\n");
}
