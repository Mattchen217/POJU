import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { outputLanguageLabel } from "@/lib/base-analysis/resolve-output-language";

export type BaseAnalysisStreamLocalData = {
  structured: ProfileStructured;
  /** zh | en — follows user input / browser, not URL locale */
  output_language: "zh" | "en";
};

export type BaseAnalysisStreamPromptInput = {
  local_data: BaseAnalysisStreamLocalData;
};

/** Semantic red-line words only — bazi terms are allowed; output-side sanitize handles soft translation. */
const ZH_RED_LINE =
  "算命、命运、吉、凶、预测";
const EN_RED_LINE =
  "fortune-telling, fate, destiny, auspicious, inauspicious, prediction";

export function buildBaseAnalysisStreamPrompt(input: BaseAnalysisStreamPromptInput): {
  system: string;
  user: string;
} {
  const lang = input.local_data.output_language;
  const langLabel = outputLanguageLabel(lang);
  const redLine = lang === "zh" ? ZH_RED_LINE : EN_RED_LINE;

  const system = `# 你的任务

基于以下东方哲学性格数据，生成一份给用户看的完整性格画像（display text only）。

[输入] structured JSON（含核心特质 / 关键能量 / 人生阶段等 —— **可自然引用术语，输出端会软翻译**）

# OUTPUT FRAMING（必须遵守）

这是基于东方哲学的「个性化性格画像」，用于个人成长与自我反思，**不是算命**。

ALLOWED:
- 自然使用命理术语（日主/用神/大运/干支等）与五行能量语言
- Eastern Spatiotemporal Philosophy / I Ching framework
- core nature / 核心特质 / 人生阶段 / 性格画像

FORBIDDEN — 语义红线（用户可见输出）:
- 中文: ${ZH_RED_LINE}（改用「顺遂/需留意/能量节律」等）
- English: ${EN_RED_LINE}
- 不预测具体未来事件、不下命运定论、不给医疗/财务/法律建议

# 输出要求

1. **只输出**给用户阅读的正文（Markdown 标题 + 段落），不要 JSON，不要 \`---META---\`，不要代码块包裹全文。
2. 语言: **${langLabel}** — 全文使用这一种语言；中文术语在英文画像中也可自然出现。
3. 详细、有深度；分区可用标题，例如:
   - ${lang === "zh" ? "性格核心 / 天赋与盲点 / 人生方向 / 人生阶段概览" : "Core Character / Gifts & Blind Spots / Life Direction / Life Phases Overview"}
4. 1500–2500 词（或同等篇幅的中文）。
5. 第二人称（你 / you），现代、专业、有温度。

# pojulife 品牌

可自然提及 POJU / pojulife；禁止 astrology / divination / psychic / horoscope 等西方占卜用语。`;

  const user = `structured JSON (internal — write a rich personality portrait for the user):

\`\`\`json
${JSON.stringify(input.local_data.structured, null, 2)}
\`\`\`

Write the full personality portrait now. Use real bazi terms naturally; avoid semantic red-line words (${redLine}).`;

  return { system, user };
}
