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

const ZH_FORBIDDEN =
  "八字、四柱、日主、用神、忌神、大运、格局、算命、命理、命盘、吉、凶、命运、预测";
const EN_FORBIDDEN =
  "Bazi, Four Pillars, Day Master, Yong Shen, Da Yun, fate, destiny, fortune-telling, auspicious, inauspicious";

export function buildBaseAnalysisStreamPrompt(input: BaseAnalysisStreamPromptInput): {
  system: string;
  user: string;
} {
  const lang = input.local_data.output_language;
  const langLabel = outputLanguageLabel(lang);
  const forbidden = lang === "zh" ? ZH_FORBIDDEN : EN_FORBIDDEN;

  const system = `# 你的任务

基于以下东方哲学性格数据，生成一份给用户看的完整性格画像（display text only）。

[输入] structured JSON（含核心特质 / 关键能量 / 人生阶段等术语数据 —— **仅供你理解，禁止原样泄露给用户**）

# OUTPUT FRAMING（必须遵守）

这是基于东方哲学的「个性化性格画像」，用于个人成长与自我反思，**不是算命**。

ALLOWED 概念与表述:
- Eastern Spatiotemporal Philosophy / I Ching framework
- core nature / inherent traits / 核心特质 / 先天特质
- 人生阶段 / 关键能量 / 东方哲学 / 五行能量 / 性格画像

FORBIDDEN — 输出中**绝不出现**（含否定句、解释句、引号内也不行）:
- 中文禁词: ${ZH_FORBIDDEN}（「吉」「凶」单字也不行，改用「顺遂/需留意」）
- 也禁止出现上述字的任意组合（如「不是算命」「非命理」）
- English forbidden: ${EN_FORBIDDEN}

NEGATION 改写:
- ❌「不是算命」→ ✅「不是宿命判定 / 不提供好坏分明的预言」
- ❌「命运」→ ✅「人生轨迹 / 生命节律」

REPLACE 示例:
- 「日主戊土」→「核心特质属于沉稳承载型（东方哲学的厚土意象）」
- 「用神是土」→「关键支撑能量是稳定与包容」
- 「大运庚辰」→「人生阶段（约 5–15 岁）：稳定积累期」

# 输出要求

1. **只输出**给用户阅读的白榜正文（Markdown 标题 + 段落），不要 JSON，不要 \`---META---\`，不要代码块包裹全文。
2. 语言: **${langLabel}** — 全文使用这一种语言。
3. 详细、有深度，体现「基于数千年东方哲学的专业画像」；分区可用白榜标题，例如:
   - ${lang === "zh" ? "性格核心 / 天赋与盲点 / 人生方向 / 人生阶段概览" : "Core Character / Gifts & Blind Spots / Life Direction / Life Phases Overview"}
4. 1500–2500 词（或同等篇幅的中文）。
5. 第二人称（你 / you），现代、专业、有温度。
6. 这是反思性指引，不预测命运，不给医疗/财务/法律建议。

# pojulife 品牌

可自然提及 POJU / pojulife；禁止 astrology / divination / psychic / horoscope 等西方占卜用语。`;

  const user = `structured JSON (internal — translate into compliant user-facing copy):

\`\`\`json
${JSON.stringify(input.local_data.structured, null, 2)}
\`\`\`

Write the full personality portrait now. Remember: zero forbidden terms (${forbidden}).`;

  return { system, user };
}
