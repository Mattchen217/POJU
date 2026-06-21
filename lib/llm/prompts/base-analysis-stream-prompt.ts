import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { buildStructuredInstanceInventory } from "@/lib/base-analysis/build-structured-instance-inventory";
import { outputLanguageLabel } from "@/lib/base-analysis/resolve-output-language";
import {
  buildPlainspeakVoiceSections,
  PLAINSPEAK_STYLE_EXAMPLE_BASE_ANALYSIS,
} from "@/lib/llm/prompts/plainspeak-voice";
import { ORIENTAL_SHARED_GUARDRAILS } from "@/lib/llm/prompts/glyph-guanyin-base";
import { READING_LAYOUT_CONTRACT } from "@/lib/llm/prompts/reading-layout";
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
5. **术语标记 · 干支禁裸** — 凡命理术语一律 \`⟦t:<id>|<可见软译词>|<该处白话>⟧\` 三段位；**id 必须严格使用术语表中的闭集 slug**。**正文任何干支组合（年/月/日/时柱、大运、流年，如 癸酉/壬申/辛未/己巳）一律不得裸露**——要么 \`⟦t:decade|人生阶段（癸酉）|…⟧\` / \`⟦t:year|流年能量（丙午）|…⟧\` 三段位，要么在概览段**完全不用干支**，改用白话年龄段（「二十出头」「三十到四十岁」）。**禁止** \`(癸酉 phase)\`、\`during 壬申\` 这类半裸写法。
6. **藏干/十神禁罗列** — **禁止** \`Hidden stems (Wu earth, Xin metal…)\` 或整行藏干英文直译堆砌；藏干影响用**一句白话行为**（「底下藏着一份固执的账本感」），必要时最多 1 个 ⟦t:…⟧ 进 tooltip。
7. **标记排版** — 标记**紧贴**软译词，**禁止**在标记前插入裸换行。
8. **金色词密度** — **每段最多 1–2 个** ⟦t:…⟧；只在该论点**首次关键诊断**处标记；同段其余用白话指代（「你这藤蔓般的优势」「目前的火运」），**禁止**同 id 重复刷标记。
9. **禁止假设**「输出端会软翻译」——你必须在生成时直接写好标记与软译词。`;

const BASE_ANALYSIS_LAYOUT_ZH = `# 降维排版（命主画像 · 奢侈品交付 · 必遵）

这是**高客单价**交付——排版要像 **Apple 官网 / 顶级杂志**：**精炼、克制、留白；宁少勿堆**。禁止「## 标题 + 一堵字墙」。

## 每个 ## 分区内部结构
1. **### 小标题** — 长分区拆成 **2–4 个** \`###\` 子块（如 \`### 核心底色\`、\`### 三大变化\`）。
2. **Lead 引导块** — 每个论点以 \`**粗体引导句:** 正文\` 开启（渲染器 lead 块）；引导句 3–8 字/词，点出该段要旨。
3. **短段** — 每段 **≤120 字**（英文 ≤80 词），**一个论点一段**，段间空一行。
4. **金句框** — 每个 ## 分区至少 **1 个** \`> **核心句:** …\` 或 \`> **行动:** …\`（渲染器 pullquote）；只框最值得记住的一句。
5. **列表** — 调候建议、三大变化、可操作清单用 \`- \` bullet，**不要**挤成长段。

## 篇幅与完整性
- 全文 **1100–1600 词**（中文同等篇幅）；**优先保证七大分区的命理诊断点完整**——字数上限服从于分区完整性：**宁可结构齐全略超，不可为压字数砍掉任何分区**。
- 压缩对象是**水分**（铺垫、排比、同义重复），不是信息点；等量诊断用 lead/bullet 表达，天然比散文省字。

## 分区硬约束
- 七大 ## 分区**一个都不能少**（见输出要求列表）。
- **## 人生主题** 内：事业 · 财富 · 婚恋 · 健康 · 贵人方位**五项必须都覆盖**，每项至少一句可落地诊断，**不得**为省字数合并或省略。
- 每个 ## 分区至少 **1 个** \`**粗体引导句:**\` 论点；含行动建议的分区（**当前大运详解** / **传统调候建议**）至少 **1 个** \`>\` 金句框 **或** \`- \` bullets。`;

const BASE_ANALYSIS_LAYOUT_EN = `# Layout (portrait delivery · luxury tier · mandatory)

This is a **premium** deliverable—layout like **Apple.com / a top magazine**: **concise, restrained, breathing room; less is more**. Never "## heading + wall of text."

## Inside each ## section
1. **### subheads** — Split long sections into **2–4** \`###\` blocks (e.g. \`### Core baseline\`, \`### Three shifts\`).
2. **Lead blocks** — Open each point with \`**Bold lead:** body\` (renderer lead); lead label 3–8 words.
3. **Short paragraphs** — **≤80 words** each (Chinese ≤120 chars), **one idea per paragraph**, blank line between.
4. **Pull quote** — At least **one** \`> **The move:** …\` or \`> **Bottom line:** …\` per ## section.
5. **Bullets** — Balance guidance, three shifts, action lists use \`- \` bullets—not run-on prose.

## Length & completeness
- **1100–1600 words** total (equivalent length in Chinese); **prioritize complete diagnostic coverage across all seven sections**—word limits yield to section completeness: **better slightly over than drop any section to hit a cap**.
- Cut **fluff** (setup, reassurance loops, synonym repeats)—not diagnostic points; lead/bullet structure carries the same information in fewer words.

## Section hard rules
- All **seven ## sections** required—none may be omitted (see output list).
- **## Life Themes** must cover **career · wealth · relationships · health · mentor directions**—each with at least one actionable line; **do not** merge or skip items to save words.
- Every ## section needs at least **one** \`**Bold lead:**\` point; action sections (**Current Decade Cycle** / **Traditional Balance Guidance**) need at least **one** \`>\` pull quote **or** \`- \` bullets.`;

const BASE_ANALYSIS_FEW_SHOT_ZH = `# 分区范例（复制结构 · 勿抄意象）

\`\`\`markdown
## 核心性格

### 核心底色

**你不是软弱:** 你是天生靠慢慢长、靠人脉生根的人 ⟦t:day_master|核心特质（乙木）|你像藤蔓，硬撑单干反而散劲⟧。

**格局一句话:** 整体像「前台热闹、后厨才出菜」——structured.pattern 只展开，不重判。

> **破局钥匙:** 先找能透气的节奏，再往外伸——别跟外面的燥劲硬顶。

### 喜忌方向

**对你有利的:** 水性的灵活与润泽（structured 喜神方向）。

**需留意的:** 火木过旺时容易上头、认死理（structured 忌神方向）。

## 大运全程概览

### 人生阶段速览

**二十出头:** 像刚租到第一间小工作室——试错多，但学得快。（**禁裸** 癸酉/壬申；用年龄段白话）

**三十前后:** 压力上来，宜深耕一项技能，别频繁换赛道。

> **全程主线:** 不是越早越好，是越稳越赢。
\`\`\``;

const BASE_ANALYSIS_FEW_SHOT_EN = `# Section example (copy structure · do not copy imagery)

\`\`\`markdown
## Core Character

### Core baseline

**You're not weak:** You grow through people and pace ⟦t:day_master|core nature (乙木)|You extend through relationships; solo sprints drain you⟧.

**Pattern in one line:** Your chart reads like a shop with a lively front and a kitchen that actually runs the show—explain structured.pattern only.

> **The move:** Find breathable rhythm before you stretch outward—don't arm-wrestle the heat.

### Favorable vs watch

**What helps:** Water-like flexibility (aligned with structured favorable direction).

**What to watch:** When fire/wood run hot, you rush decisions (structured challenging direction).

## Full Life-Phase Overview

### Life-phase sketch

**Early twenties:** Like your first tiny studio—lots of trials, fast learning. (**No bare** 癸酉/壬申; use age phrases only.)

**Mid-thirties:** Pressure rises—deepen one craft, don't hop tracks every year.

> **Through-line:** Steady beats early; depth beats speed.
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

1. **只输出** Markdown 正文（## 分区 + ### 子标题 + lead + 金句框 + bullets），不要 JSON，不要 \`---META---\`，不要代码块包裹全文。
2. 语言: **${langLabel}** — 全文使用这一种语言。
3. **七大分区一个都不能少**（标题可微调措辞，但七块内容齐全、诊断点完整）：
${BASE_ANALYSIS_OUTPUT_SECTIONS_ZH.split("\n").slice(1).join("\n")}
4. **1100–1600 词**（中文同等篇幅）— **优先保证分区完整性**；宁可结构齐全略超，**不可**为压字数砍掉任何分区。
5. **## 人生主题** 内事业 · 财富 · 婚恋 · 健康 · 贵人方位**五项必须都覆盖**，每项至少一句可落地诊断，不得合并或省略。
6. **压缩水分，不砍信息** — 删除解释性铺垫、安慰性排比、同义重复（如「这不是缺点——而是…」类填充）；保留每个分区的关键命理结论与一条可操作建议。
7. 第二人称（你），现代、专业、有温度；**每段 ≤120 字**；每个 ## 分区至少 1 个 \`**粗体引导句:**\`；**当前大运详解** / **传统调候建议** 至少 1 个 \`>\` 金句框或 \`- \` bullets。
8. 凶煞/挑战类**不得渲染成「无端损失/灾祸」恐吓**；时机只用能量节律 / life phase，**禁公历年/干支纪年作时间锚**；**大运全程概览禁裸干支**（用年龄段白话或 ⟦t:decade|…⟧）。
9. 可自然提及 POJU / pojulife；禁 astrology / divination / psychic / horoscope。`
      : `# Output requirements

1. **Markdown body only** (## sections + ### subheads + lead blocks + pull quotes + bullets)—no JSON, no \`---META---\`, no fenced full-document code block.
2. Language: **${langLabel}** throughout.
3. **All seven sections required—none may be omitted** (wording may vary; diagnostic coverage must stay complete):
${BASE_ANALYSIS_OUTPUT_SECTIONS_EN.split("\n").slice(1).join("\n")}
4. **1100–1600 words** (equivalent length in Chinese)—**section completeness first**; slightly over is OK; **never** drop a section to hit a word cap.
5. **## Life Themes** must cover **career · wealth · relationships · health · mentor directions**—each with at least one actionable line; no merging or skipping to save words.
6. **Cut fluff, not facts** — drop explanatory padding, reassurance loops, synonym repeats (e.g. "this isn't a flaw—it's…" filler); keep each section's key chart read and one actionable takeaway.
7. Second person (you); modern, warm, professional; **≤80 words per paragraph**; every ## section needs at least one \`**Bold lead:**\`; **Current Decade Cycle** / **Traditional Balance Guidance** need at least one \`>\` pull quote or \`- \` bullets.
8. Do not frame challenges as doom/scare tactics; timing = energy rhythm / life phase only—**no calendar year or bare Ganzhi anchors**; **Full Life-Phase Overview must not leak bare 癸酉/壬申** (age phrases or ⟦t:decade|…⟧ only).
9. POJU / pojulife OK; no astrology / divination / psychic / horoscope.`;

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
    READING_LAYOUT_CONTRACT,
    lang === "zh" ? BASE_ANALYSIS_LAYOUT_ZH : BASE_ANALYSIS_LAYOUT_EN,
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

现在开始写完整 Markdown 性格画像。**降维排版**（### + **引导:** + 短段 + > 金句 + bullets）；**1100–1600 词、七大分区齐全**（人生主题五项全覆盖）；压缩水分不砍信息；术语三段位；**禁裸干支**；神煞/十神不得超出 structured；避免语义红线词（${redLine}）。`
      : `structured JSON (internal — write the full portrait; honor instance closed-set and term markers):

\`\`\`json
${JSON.stringify(input.local_data.structured, null, 2)}
\`\`\`

Write the full Markdown portrait now. **Magazine layout** (### + **Lead:** + short ¶ + > pull quote + bullets); **1100–1600 words, all seven sections** (Life Themes: all five items); cut fluff not facts; 3-part term markers; **no bare Ganzhi**; shen_sha/ten_gods must stay within structured; avoid red-line words (${redLine}).`;

  return { system, user };
}
