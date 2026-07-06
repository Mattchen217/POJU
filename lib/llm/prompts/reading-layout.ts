/**
 * 降维排版 —— 杂志式结构化输出（Glyph / POJU / Match 共用 · 不进 Syncro）。
 * @see Cursor 指令 - 降维排版重构（全产品统一）.md
 */

export const READING_LAYOUT_CONTRACT = `# 降维排版（杂志式版面 · 用户可见 JSON 字符串必遵）

长字段禁止「一堵字墙」。用轻量 Markdown 排版，渲染器会解析为短段/小标题/金句框/列表。

## 1. 强制分段
- 每 **2–3 句** 一段，段间 **空一行**（\\n\\n）。
- **禁止** >4 句不分段。

## 2. 小标题引导（粗体自拟）
- 每个意思单元开头给 **粗体引导词**，格式 \`**Your Natural Advantage:**\` 或 \`**当前这股压力:**\`（3–8 字/词，点出该段要旨）。
- 用户扫粗体就能抓住逻辑链；引导词按**本段内容自拟**，勿全篇套用同一套标题。

## 3. 金句框（核心行动 / 直接结论）
- 每个 section/字段把**最该被记住的一句**（核心行动或直接结论）单独用引用框：
  \`> **The Move:** 具体可做的下一步…\`
- **每 section 至多 1 个**金句框；每屏整体 1–2 个即可。
- POJU **CONCLUSION** 里「直接回答用户问题」那句 + 每条 Action 的核心句 → 优先金句框。
- Match **conclusion.question_response** + synergy 定性 → 优先金句框。

## 4. 列表
- 并列项（多条信号、多个行动要点）用 \`* \` 或 \`- \` 列表，**不要**挤成长句堆叠。

## 5. 金色词降噪（与瘦身四条一致）
- 同一 term id 在**同一 section/字段内**只打 **1 次** ⟦t:id|可见|白话⟧（最关键诊断处）。
- 其余用普通人话指代（「你这藤蔓般的优势」「目前的火运」「那把双刃」）。
- **禁止**正文先写 soft 词、标记里又重复同词（如 core nature is core nature）。

## 6. 本地计算事实（神煞 / 干支关系 / 流年引动 / 十神张力）的使用纪律
- 这些是本地【算死】的事实，不是可推理项：只能引用清单里实际算出的，严禁自造。
- **定向不堆砌**：只挑与用户当前问题最相关的 1–3 条织进叙事，其余是判断底料、不写给用户。
- 每类事实点到即止（最多 1–2 处），且必须落到「所以对这件事意味着什么 + 第一步做什么」，不做名词展览、不逐条罗列。
- 关系/十神一律软翻译、中性化：冲/刑/害→系统张力类中性词，合→协同类；严禁凶/灾/克死等恐惧渲染。
- 可见文本严禁出现裸干支与高危词（算命/大运/流年/星象/占卜）——用 SaaS 术语（行为倾向/系统脆弱性/时空效能）。
- 降维排版不变：一个论点一段、每段金字 ≤2、短段 + 金句框，禁字墙。

## 版式范例（结构示意 · 勿抄意象）
\`\`\`
**Your Natural Advantage:** You are like a tender vine—flexible and adaptive. You thrive by bending, not bulldozing.

**The Current Storm:** Right now you're running hot. Your ⟦t:decade|life phase (丁酉)|…⟧ is a pressure cooker.

> **The Move:** Improvement won't come from more hustle. Step back, cut costs without sentiment, and find one trusted advisor.
\`\`\`

## 产品落点
- **Glyph**：question_response / 命理看此事 / 签文看此事 / synthesis / hidden_tension / your_moment / exploration.text 等均按上式。
- **POJU 主交付**：═══ ANALYSIS / CONCLUSION / WHAT TO DO / COMING BACK ═══ 各段内小标题+短段；CONCLUSION 直答 + Action 用金句框。
- **Match**：analysis_a/b.detail、combined.detail、conclusion、recommendations.actions[].detail 同式。`;

/** POJU 主交付专用 — 排版硬约束（解析依赖 · 违反即字墙） */
export const POJU_DELIVERY_STRUCTURE_MANDATE = `# 主交付排版硬约束（解析依赖 · 违反即字墙）

【必须】ANALYSIS / CONCLUSION / WHAT TO DO / COMING BACK 四段之间用**独立成行**的 \`═══ SECTION ═══\` 分隔（SECTION 名必须英文大写）。

【必须】ANALYSIS 内拆 **3–4 个 \`### 子标题\`**，每个子标题下 **2–3 个短段**（每段 ≤120 中文 / ≤120 英文词），段间 **空一行**。

【必须】每个大段至少 **1 个金句框** \`> **要旨:** …\`（CONCLUSION 直答 original_question 的句子**必须**金句框；WHAT TO DO 每条 Action 核心句优先金句框）。

【必须】并列要点用 \`- \` 列表，**每条独占一行**。

【禁止】任何超过 120 字/词的长段；禁止把多个论点挤进一段；禁止省略 \`═══\` 分隔或省略 ANALYSIS 内 \`###\`。`;
