import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { buildStructuredInstanceInventory } from "@/lib/base-analysis/build-structured-instance-inventory";
import { outputLanguageLabel } from "@/lib/base-analysis/resolve-output-language";
import {
  buildPlainspeakVoiceSections,
  PLAINSPEAK_STYLE_EXAMPLE_BASE_ANALYSIS,
} from "@/lib/llm/prompts/plainspeak-voice";
import { ORIENTAL_SHARED_GUARDRAILS } from "@/lib/llm/prompts/glyph-guanyin-base";
import { stitchPromptSections } from "@/lib/llm/prompts/oriental-counselor-base";
import { buildTermMarkingPromptBlock } from "@/lib/llm/sanitize/compliance-terms";

export type BaseAnalysisStreamLocalData = {
  structured: ProfileStructured;
  /** zh | en — follows user input / browser, not URL locale */
  output_language: "zh" | "en";
};

export type BaseAnalysisStreamPromptInput = {
  local_data: BaseAnalysisStreamLocalData;
};

const ZH_RED_LINE = "算命、命运、吉、凶、预测";
const EN_RED_LINE =
  "fortune-telling, fate, destiny, auspicious, inauspicious, prediction";

const BASE_ANALYSIS_OUTPUT_SECTIONS_ZH = `# 输出分区（必须齐全 · Markdown ## 标题）

1. **## 核心性格** — 日主 + **结构化格局判断**（绑定 structured.pattern，展开不另判）+ 用神/喜神/忌神 + 强弱（绑定 structured，只展开不另算）
2. **## 四柱与隐藏世界** — 年/月/日/时柱与藏干、十神、神煞（**仅 structured 里有的**）
3. **## 天赋与盲点** — 天性优势与性格盲区（具体行为模式）
4. **## 人生主题** — 事业 · 财富 · 婚恋 · 健康 · 贵人方位（小标题或段落分隔）
5. **## 当前大运详解** — 当前 decade：主题 + 三大变化 + 2–3 个方向性时间窗（禁公历/干支纪年锚定）
6. **## 大运全程概览** — 按 structured.da_yun 时序概览（缺失则方向性 life phase，禁编干支）
7. **## 传统调候建议** — 方位 · 颜色 · 物件 · 朝向 · 规避（环境心理学落地，禁招财/催运/避邪）`;

const BASE_ANALYSIS_OUTPUT_SECTIONS_EN = `# Output sections (all required · Markdown ## headings)

1. **## Core Character** — day master + **structured pattern read** (bound to structured.pattern; explain only) + yong/xi/ji + strength (bound to structured; explain only)
2. **## Four Pillars & Hidden Layer** — pillars, hidden stems, ten gods, stars (**only those in structured**)
3. **## Gifts & Blind Spots** — natural strengths and blind spots (concrete behaviors)
4. **## Life Themes** — career · wealth · relationships · health · mentor directions
5. **## Current Decade Cycle** — theme + three shifts + 2–3 directional timing windows (no calendar/Ganzhi anchors)
6. **## Full Life-Phase Overview** — chronological da_yun summary (or directional if missing)
7. **## Traditional Balance Guidance** — directions · colors · objects · facing · avoid (grounded, no superstition promises)`;

const BASE_ANALYSIS_BINDING_RULES = `# 绑定计算结果 · 闭集 · 禁幻觉

1. **用神/喜神/忌神/强弱/格局** — 以 structured 为准；只能展开解释，**不得改判或另算**；喜忌方向不得与 structured 相反。
2. **神煞闭集** — 只能取自 structured.pillars_detail 里实际出现的神煞（引擎闭集 9 选 N：天乙贵人/禄神/飞刃/文昌/桃花/驿马/华盖/孤辰/寡宿）。**严禁**写出数据中不存在的神煞，尤其禁止：国印贵人、月德合、天德合、太极贵人、福星贵人、劫煞、十恶大败、空亡、学堂 等引擎不计算的项。
3. **十神/长生** — 同理，只用 structured 给出的具体条目；禁止类别统称代替或编造。
4. **data_availability.missing** — pillars_detail 或 da_yun 缺失时，该维度**只做方向性描述**，禁止编造具体干支/神煞/起运岁数。
5. **术语标记** — 凡命理术语一律 \`⟦t:<id>|<可见软译词>|<该处白话>⟧\` 三段位；**id 必须严格使用术语表中的闭集 slug**（如 \`yong_shen\`、\`favorable_element\`、\`unfavorable_element\`、\`yi_ma\`、\`fei_ren\`、\`zheng_yin\`、\`life_guandai\`、\`strong_self\`），**禁止自造 id**。keep_cn 词（日主/大运/流年/干支）拼成 \`软译 (干支)\`，如 \`⟦t:day_master|core nature (辛)|…⟧\`。用户正文**不得出现裸术语或未闭合标记**。
6. **标记排版** — 标记**紧贴**软译词，**禁止**在标记前插入裸换行或断行（错误：\`the\\n⟦t:zheng_yin|…⟧\`；正确：\`the ⟦t:zheng_yin|steady support|…⟧ rhythm\`）。
7. **禁止假设**「输出端会软翻译」——你必须在生成时直接写好标记与软译词。`;

const BASE_ANALYSIS_FEW_SHOT_ZH = `# 字段范例（复制此形态 · 三段位 + 比喻入正文）

\`\`\`
先说结论：你不是软弱，是**天生靠慢慢长** ⟦t:day_master|核心特质（乙木）|你像藤蔓，硬撑单干反而散劲，适合先找能依靠的支点⟧。这阵**人生阶段像关在小房间刷题** ⟦t:decade|人生阶段（癸酉）|这十年宜深耕一项技能，别频繁换赛道⟧——外面燥，不是你无能。若 structured 只有文昌、驿马，就只谈这两项；**禁止编造国印/空亡**。
\`\`\``;

const BASE_ANALYSIS_FEW_SHOT_EN = `# Field examples (copy this shape · 3-part markers + metaphor in prose)

\`\`\`
Bottom line: you're not weak—you **grow through people and pace** ⟦t:day_master|core nature (乙木)|You extend through relationships; forcing solo sprints drains you⟧. This **life phase feels like a cramped study room** ⟦t:decade|life phase (癸酉)|A decade to deepen one craft, not hop tracks every year⟧. If structured only lists Wen Chang and Yi Ma, mention only those—**never invent Guo Yin or Kong Wang**.
\`\`\``;

export function buildBaseAnalysisStreamPrompt(input: BaseAnalysisStreamPromptInput): {
  system: string;
  user: string;
} {
  const lang = input.local_data.output_language;
  const langLabel = outputLanguageLabel(lang);
  const redLine = lang === "zh" ? ZH_RED_LINE : EN_RED_LINE;
  const instanceInventory = buildStructuredInstanceInventory(input.local_data.structured);

  const taskBlock =
    lang === "zh"
      ? `# 你的任务

基于以下 **structured JSON（本地排盘引擎真算结果）**，生成一份给用户看的完整**命主基础分析 / 性格画像**（Markdown 正文 only）。

这是基于东方哲学的「个性化性格画像」，用于个人成长与自我反思，**不是算命**。`
      : `# Your task

From the **structured JSON (locally computed chart engine)** below, write a complete **Base Analysis / Personality Portrait** for the user (Markdown body only).

This is an Eastern-spatiotemporal philosophy personality portrait for self-reflection—not fortune-telling.`;

  const outputBlock =
    lang === "zh"
      ? `# 输出要求

1. **只输出** Markdown 正文（## 分区标题 + 段落），不要 JSON，不要 \`---META---\`，不要代码块包裹全文。
2. 语言: **${langLabel}** — 全文使用这一种语言。
3. 详细、有深度；必须包含下列 **7 个分区**（标题可微调措辞，但七块内容齐全）：
${BASE_ANALYSIS_OUTPUT_SECTIONS_ZH.split("\n").slice(1).join("\n")}
4. 1500–2500 词（或同等篇幅的中文）。
5. 第二人称（你 / you），现代、专业、有温度。
6. 凶煞/挑战类**不得渲染成「无端损失/灾祸」恐吓**；时机只用能量节律 / life phase，**禁公历年/干支纪年作时间锚**。
7. 可自然提及 POJU / pojulife；禁 astrology / divination / psychic / horoscope。`
      : `# Output requirements

1. **Markdown body only** (## section headings + paragraphs)—no JSON, no \`---META---\`, no fenced full-document code block.
2. Language: **${langLabel}** throughout.
3. All **7 sections** required:
${BASE_ANALYSIS_OUTPUT_SECTIONS_EN.split("\n").slice(1).join("\n")}
4. ~1500–2500 words (or equivalent Chinese length).
5. Second person (you); modern, warm, professional.
6. Do not frame challenges as doom/scare tactics; timing = energy rhythm / life phase only—**no calendar year or Ganzhi year anchors**.
7. POJU / pojulife OK; no astrology / divination / psychic / horoscope.`;

  const forbiddenBlock =
    lang === "zh"
      ? `# 语义红线（用户可见输出）

- 中文禁: ${ZH_RED_LINE}（改用「顺遂/需留意/能量节律」等）
- English禁: ${EN_RED_LINE}
- 不预测具体未来事件、不下命运定论、不给医疗/财务/法律建议`
      : `# Semantic red lines (user-visible)

- Chinese forbidden: ${ZH_RED_LINE}
- English forbidden: ${EN_RED_LINE}
- No specific future events, no fatalism, no medical/financial/legal advice`;

  const system = stitchPromptSections(
    taskBlock,
    ...buildPlainspeakVoiceSections(PLAINSPEAK_STYLE_EXAMPLE_BASE_ANALYSIS),
    BASE_ANALYSIS_BINDING_RULES,
    buildTermMarkingPromptBlock(lang),
    lang === "zh" ? BASE_ANALYSIS_FEW_SHOT_ZH : BASE_ANALYSIS_FEW_SHOT_EN,
    outputBlock,
    forbiddenBlock,
    ORIENTAL_SHARED_GUARDRAILS,
    instanceInventory,
  );

  const user =
    lang === "zh"
      ? `structured JSON（内部数据 — 据此写完整性格画像；守实例闭集与术语标记）:

\`\`\`json
${JSON.stringify(input.local_data.structured, null, 2)}
\`\`\`

现在开始写完整 Markdown 性格画像。术语必须三段位标记；神煞/十神不得超出 structured；避免语义红线词（${redLine}）。`
      : `structured JSON (internal — write the full portrait; honor instance closed-set and term markers):

\`\`\`json
${JSON.stringify(input.local_data.structured, null, 2)}
\`\`\`

Write the full Markdown portrait now. All technical terms must use 3-part markers; shen_sha/ten_gods must stay within structured; avoid red-line words (${redLine}).`;

  return { system, user };
}
