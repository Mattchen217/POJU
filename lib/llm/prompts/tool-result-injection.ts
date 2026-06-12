import { formatBaseAnalysisForPrompt } from "@/lib/llm/prompts/base-analysis-context";
import type { ToolName } from "@/lib/poju/types";

export function buildToolResultInjectionMessage(input: {
  tool: ToolName;
  result_data: Record<string, unknown>;
  original_question: string;
  delivery_handoff?: boolean;
}): string {
  const delivery =
    input.delivery_handoff === true || input.result_data.handoff_source === "delivery_page";

  switch (input.tool) {
    case "match":
      return delivery
        ? buildMatchDeliveryHandoff(input.result_data, input.original_question)
        : buildMatchInjection(input.result_data, input.original_question);
    case "syncro":
      return delivery
        ? buildSyncroDeliveryHandoff(input.result_data, input.original_question)
        : buildSyncroInjection(input.result_data, input.original_question);
    case "glyph":
      return delivery
        ? buildGlyphDeliveryHandoff(input.result_data, input.original_question)
        : buildGlyphInjection(input.result_data, input.original_question);
  }
}

function buildMatchDeliveryHandoff(data: Record<string, unknown>, originalQuestion: string): string {
  const sections = formatReportSections(data.report_sections);
  const profileA = formatBaseAnalysisForPrompt(data.profile_a_base_analysis).slice(0, 6000);
  const profileB = formatBaseAnalysisForPrompt(data.profile_b_base_analysis).slice(0, 6000);

  return `[系统注入 · 交付页延续 · Match 合盘]

用户刚从 Match 交付页付费进入 POJU。这是【新会话】，不是回到旧 POJU 话题。
用户已完整看过合盘报告；下方是 POJU 可用的全部上下文。

## 用户想深入的方向
「${originalQuestion}」

## 合盘结论
- 关系：${String(data.relationship_description ?? "—")}
- 协同类型：${String(data.synergy_type ?? data.compatibility_level ?? "—")}
- 共振指数：${data.resonance_index != null ? String(data.resonance_index) : "—"}

## 关键优势
${listField(data.key_strengths ?? data.strengths) || "（见报告摘要）"}

## 关键挑战
${listField(data.key_challenges ?? data.challenges) || "（见报告摘要）"}

## 报告摘要
${String(data.summary ?? "")}

## 报告章节（用户已读）
${sections || "（章节摘要未随结果带回）"}

## 甲方命盘 · 基础分析
${profileA}

## 乙方命盘 · 基础分析
${profileB}

# 你接下来要做的（主动开场）

⭐ 这是交付页转入的新 POJU 会话，主题是上面的关系深入方向。

1. **深度思考**后给出 180–420 字（中文）/ 140–300 词（英文）的主动开场
2. **简要总结**用户刚看过的 Match 结构（1–2 个最相关洞察，勿复述整份报告）
3. **结合命盘**（至少引用甲方或乙方基础分析中的 1 条具体结论）
4. **引导用户**：问 1 个尖锐、可行动的问题——接下来想先聊冲突、边界、还是具体行动？

⛔ 不要：把合盘当独立专题另开论述；列长清单；空泛「我能帮你」
✓ 要：承上启下——「报告里 X，落到你身上可能是 Y，你想先从哪块下手？」`;
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

function buildSyncroDeliveryHandoff(data: Record<string, unknown>, originalQuestion: string): string {
  return `[系统注入 · 交付页延续 · Syncro]

用户刚从 Syncro 交付页付费进入 POJU。这是【新会话】。

## 用户想深入的方向
「${originalQuestion}」

## 用户的任务
「${String(data.task_description ?? "")}」

## 位置 / 时区
${String(data.user_location_summary ?? data.user_location ?? "—")}

# 你接下来要做的（主动开场）

1. 简要总结 Syncro 给出的时机结构（1–2 个最相关窗口，勿复述全矩阵）
2. 拉回用户的决策困境
3. 问用户想先聊「要不要做」还是「怎么做」

⛔ 不要：96 格全报；让 Syncro 取代 POJU 主题
✓ 要：承上启下，引导下一步对话`;
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

function buildGlyphDeliveryHandoff(data: Record<string, unknown>, originalQuestion: string): string {
  const question = String(data.question ?? originalQuestion);

  return `[系统注入 · 交付页延续 · Glyph]

用户刚从 Glyph 交付页付费进入 POJU。这是【新会话】。
用户已完整看过卦象解读；下方是 POJU 可用的上下文。

## 用户想深入的方向
「${originalQuestion}」

## 用户抽到的意象
${String(data.glyph_drawn ?? data.glyph_level ?? data.sign_number ?? "—")}

## 古典语
${String(data.classical_voice ?? data.meaning ?? "")}

## 针对问题的含义
${String(data.meaning_for_question ?? data.meaning ?? "")}

## 隐藏张力 / 当下时刻
${String(data.hidden_tension ?? "")}
${String(data.your_moment ?? "")}

## 探索引导
${String(data.exploration ?? data.reflection ?? "")}

## 反思问题（用户已看过）
${String(data.reflection_question ?? "")}

# 你接下来要做的（主动开场）

1. **深度思考**后给出主动开场——不要长篇解释签意
2. **简要镜像** Glyph 反映的核心张力（1–2 句）
3. **结合用户问题**「${question}」，问 1 个开放、尖锐的问题引导用户自己说出来

⛔ 不要：签书式讲解；取代用户感受
✓ 要：短、承上启下、让用户主导下一步`;
}

function buildGlyphInjection(data: Record<string, unknown>, originalQuestion: string): string {
  return `[系统注入 · Glyph 结果]

用户刚才完成了一次 Glyph 意象抽取（你此前建议的）。

## 抽到的意象
${String(data.glyph_drawn ?? data.sign_number ?? "—")}

## 含义（用户已看过，勿长段解释）
${String(data.meaning ?? data.meaning_for_question ?? data.classical_voice ?? "")}

## 用户问题
「${String(data.question ?? originalQuestion)}」

# 你接下来要做的

⭐ 当前 cycle 主题：「${originalQuestion}」

Glyph 用于【绕过理性】——不要当答案讲解。把意象当镜子，用 1–2 个克制的问题让用户自己说出来，并拉回 cycle 主题。

⛔ 不要：长篇解释签意；取代用户感受
✓ 要：短、开放、让用户主导`;
}

function formatReportSections(raw: unknown): string {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
  const sections = raw as Record<string, { title?: string; summary?: string; detail?: string }>;
  const lines: string[] = [];
  for (const [key, block] of Object.entries(sections)) {
    if (!block || typeof block !== "object") continue;
    const title = block.title ?? key;
    const summary = block.summary ?? "";
    const detail = block.detail ? block.detail.slice(0, 400) : "";
    lines.push(`### ${title}\n${summary}${detail ? `\n${detail}` : ""}`);
  }
  return lines.join("\n\n").slice(0, 8000);
}

function listField(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .slice(0, 3)
    .map((s, i) => `${i + 1}. ${String(s)}`)
    .join("\n");
}
