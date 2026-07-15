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
import { buildForbiddenTermsPromptBlock } from "@/lib/llm/compliance/banned-terms";

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

const BASE_ANALYSIS_NATAL_RELATION_ANCHOR_ZH = `【用本盘动态关系锚定结构（仅本命、仅一处、中性、织进叙事）】
- 若实例清单里有【本命结构关系】（相冲/相刑/相害/半合/三合/天干五合），
  用它把「容易卡住的地方」或「你的核心配置」锚到真实结构张力上——
  例：「结构里有一处彼此消耗的拉扯」（源自相刑）、「核心与外部有一股要合而未合的牵引」（源自天干合）。
- 【最多点一处】，织进叙事，【禁枚举】关系名（不写「你有寅巳相刑、巳酉半合…」）。
- 关系词走软翻译 ⟦t:<relation_slug>|软译|白话⟧，中性化（禁凶/灾/克死）。
- 【只用 source=natal 的本命关系】；实例清单里的【流年/动态关系一律忽略】——
  底座是稳定中立读数，流年剧情留给下游。`;

const BASE_ANALYSIS_NATAL_RELATION_ANCHOR_EN = `[Anchor structure on natal relations (natal only · one mention max · neutral · woven)]
- If the instance inventory lists **natal structure relations** (clash / penalty / harm / half-combo / triple / stem combine),
  use **one** to anchor **Where You Stick** or **Your Core Configuration** to real structural tension—
  e.g. "a mutually draining pull inside the structure" (from penalty), "core and outer field share an almost-merge pull" (from stem combine).
- **At most one mention**, woven into narrative—**never enumerate** ("you have Yin-Si penalty AND Si-You half-combo…").
- Relation terms: soft ⟦t:<relation_slug>|soft label|plain⟧, neutralized (no doom / disaster / fatalism).
- **Natal only (\`source=natal\`)**; ignore any liunian/directed/dynamic relations—stable neutral base; plot timing belongs downstream.`;

/** Five energy sections + identity open + readout close (no 四柱 / 大运 sections). */
const BASE_ANALYSIS_OUTPUT_SECTIONS_ZH = `# 输出分区（必须齐全）

## 开篇 · 身份锚（无 ## 标题）

- Markdown **第一行起笔**就是**一句**身份锚：由本盘 \`day_master\` + \`strength\` + \`yong_shen\` **现写**的人话身份句（plain prose）。
- **禁止**用 \`##\` 包这句；**禁止**套模板口号；必须换盘就该改写。

## 五块能量分区（中立诊断 · Markdown ## 标题 · 必须五块齐全）

1. **## 你的核心配置（强项）** — 驱动类型 + 价值产生机制；绑定 \`day_master\` + \`strength\` + \`pattern\`；十神组合只谈**机制**（如食神生财、官印相生），**不谈职业场景**。
${BASE_ANALYSIS_NATAL_RELATION_ANCHOR_ZH}
2. **## 容易卡住的地方（需注意）** — **不谈吉凶**，只谈配置天然短板与失衡机制；绑定 \`ji_shen\` / 缺失五行 / 结构过载；**可**用上方本命结构关系锚定一处真实张力（仍只一处、不枚举）。
3. **## 怎么把自己调回来（调谐方向）** — 中立调谐方向：作息节律、环境、决策习惯、方位·颜色倾向；绑定 \`yong_shen\` / \`xi_shen\` + 调候。**禁止**写成行动打卡清单（如「每天冥想 20 分钟」「早起跑步」）；只给方向感，不列步骤表。
4. **## 你和外部的能量交换** — 你**需要外界补给什么**、你**最擅长向外给出什么**；双向能量交换读数。**禁止**恋爱分型 /「适合的伴侣」/ 婚恋推荐。
5. **## 什么状态下你最容易突破** — 只描述**能量状态**（用神得力 / 格局成时系统最易出信噪比）；**不预测事件、不指定行业、不点年龄段**。

## 收尾（无 ## 标题）

- 全文末尾**一句短收束**：这是你的能量配置读数。怎么用它，取决于你自己。——plain prose，**不是** \`##\` 分区。
- **禁止**用「这不是命运 / 不是命定 / 不是判决书」等否定式收尾——会诱使写出禁词。`;

const BASE_ANALYSIS_OUTPUT_SECTIONS_EN = `# Output sections (all required)

## Opening · identity anchor (no ## heading)

- The Markdown **starts** with **one** identity sentence invented from this chart's \`day_master\` + \`strength\` + \`yong_shen\` (plain prose).
- **No** \`##\` around it; **no** template slogans; must change if the chart changes.

## Five energy sections (neutral · Markdown ## · all five mandatory)

1. **## Your Core Configuration (Strengths)** — drive type + value mechanism; bound to \`day_master\` + \`strength\` + \`pattern\`; ten-god **mechanisms** only (e.g. output feeds wealth, officer nourishes seal)—**no career scenes**.
${BASE_ANALYSIS_NATAL_RELATION_ANCHOR_EN}
2. **## Where You Stick (Watch)** — **No good/bad moralizing**—only structural gaps / overload; bound to \`ji_shen\` / missing elements / imbalance; **may** anchor one natal structural tension (one mention max, no enumeration).
3. **## How to Retune (Neutral Tuning)** — neutral retune directions: rhythm, environment, decision habits, direction · color lean; bound to \`yong_shen\` / \`xi_shen\` + climate balance. **No** action checklists ("meditate 20 min daily," "run every morning")—direction only, not a step list.
4. **## Energy Exchange With Others** — what you need **supplied** from outside vs what you **give best**; two-way energy exchange readout. **No** romance typing / "suitable partner" / marriage advice.
5. **## When Breakthrough Comes Easiest** — **energy state only** (favorable god active / pattern coherent → high signal-to-noise); **no events, industries, or age bands**.

## Closing (no ## heading)

- End with **one short line**: this is your energy-config readout; how you use it is yours—plain prose, **not** a \`##\` section.
- **Never** close with "this is not fate / not destiny / not a verdict" negations—those invite banned words.`;

const BASE_ANALYSIS_NEUTRALITY_RULES_ZH = `# 中立元报告 · 硬禁（场景化留给下游 POJU/Glyph/Match/Syncro）

这份报告是**共用中立上下文底座**（像体检报告 / MBTI 原始读数 / 仪器说明书）：**客观、无场景、无定性职业、无人生故事**。

## 禁止任何现实情节与定性
- **禁**职业/行业/经营状态/雇佣/婚育/资产/具体人际关系断言。
- **禁例:** 「你适合开咖啡馆」「hire a part-time helper」「running a food stall」「该换工作了」「适合结婚」。
- **正例方向:** 「你的核心能量偏高频输出，执行锋芒强，但长期缓冲弱——需要规则网格约束蒸发」——只谈机制，不编情节。
- **禁**未来事件预测（新合伙/扩张/机会到来/某年会…）— 只给**能量倾向**。
- **禁**医疗与脏腑点名：健康相关改为中立的「系统过载 / 内耗 / 节律失衡」能量描述 + 作息环境类调谐方向；**不点名器官、不给饮食医嘱**。
- 职业/关系若**必须**提及，只能作为「能量投射的中立举例」，并显式标注「**举例，非定性**」— **但优先完全不提**，把投射留给下游。
- **禁**恋爱分型 /「适合的伴侣」类外部交换误写。

## 比喻边界（本盘唯一主隐喻）
- 全文**最多一条主隐喻**，由本盘 \`day_master\` + \`strength\` + \`yong_shen\` **现定**；服务于解释能量机制，**不编造现实情节**。
- **黑名单（禁抄）** — 与绝对禁词块同源：引擎 / 手机散热片 / 散热缺口 / 冷却模块 / 随时能翻的参考书（**以 \`buildForbiddenTermsPromptBlock\` 注入块为准**）。
- **黑名单 = 字面禁止**：否定式/对比式/引用式同样违规。✗「你不是一台引擎」✗「不像散热片」→ 请正面直说。✓「你的力量来自吸收与转化，而不是自我消耗。」
- 自检：**「换一个命盘还成立吗？」**——成立就必须重写。`;

const BASE_ANALYSIS_NEUTRALITY_RULES_EN = `# Neutral meta-report · hard bans (scenarios belong to downstream POJU/Glyph/Match/Syncro)

This is a **shared neutral context base** (like a lab report / raw MBTI readout / instrument manual): **objective, scene-free, no career typing, no life story**.

## No real-world plot or typing
- **Ban** career/industry/business status/hiring/marriage/parenting/assets/specific relationship assertions.
- **Bad:** "You should run a café," "hire a part-time helper," "running a food stall," "time to switch jobs," "ready for marriage."
- **Good direction:** "Core energy leans high-frequency output with sharp execution edge but weak long buffer—needs a rule grid to limit evaporation"—mechanism only, no plot.
- **Ban** future-event predictions (new partner, expansion, opportunity arriving, "in 2027…")—**energy tendency only**.
- **Ban** medical/organ naming: health = neutral "system overload / internal friction / rhythm drift" + rhythm/environment retune direction—**no organs, no diet prescriptions**.
- Career/relationship mentions, if unavoidable, must be labeled "**example only—not a typing**"—**prefer omitting entirely**; downstream handles projection.
- **Ban** romance typing / "suitable partner" misreads of energy exchange.

## Metaphor boundary (one main metaphor per chart)
- **At most one** main metaphor, determined by this chart's \`day_master\` + \`strength\` + \`yong_shen\`; explains mechanism only—**no** life plot.
- **Blacklist (never copy)** — same source as the absolute-bans block: engine / phone heatsink / always-open reference book / heat-dissipation gap / cooling module / steady-burning engine (**\`buildForbiddenTermsPromptBlock\` is authoritative**).
- **Literal ban**: negation / contrast / quotation still count. ✗ "you are not an engine" ✗ "unlike a heatsink" → say it positively. ✓ "Your power comes from absorption and conversion, not self-burn."
- Self-check: **"Would this still work for another chart?"**—if yes, rewrite.`;

const BASE_ANALYSIS_NARRATIVE_BREVITY_ZH = `# 叙事精简 · 禁止逐柱复述（准确性）

- 正文保持**五块综合判断**的精简中立文本即可——**禁止**为「显得详细」而逐柱罗列原始数据（各柱藏干/十神/神煞/长生/干支表）。
- 原始配置由 **structured JSON** 完整注入下游；叙事复述既冗余，又是**神煞幻觉高发区**。
- **不要**写「四柱命盘数据」「大运能量气候概览」分区；时机与干支纪年留给下游。
- 允许在五块中点名：**格局、用神/喜忌方向、关键十神机制组合**——只能引用 structured 实有字段，**不得新增神煞**。
- \`strength\`（强弱）**仅供你推理**——用户正文【禁止】写出「身弱/身强/身旺」；软译成「燃料容易跟不上 / 燃料底盘充沛」等。`;

const BASE_ANALYSIS_NARRATIVE_BREVITY_EN = `# Narrative brevity · no pillar dumps (accuracy)

- Keep body copy as **concise neutral synthesis across the five sections**—**never** pad with pillar-by-pillar raw dumps (hidden stems / ten gods / shen_sha / life stages / pillar tables).
- Raw config is injected downstream via **structured JSON**; narrative re-listing is redundant and a **shen_sha hallucination hotspot**.
- **Do not** write "Four-Pillar Configuration" or "Decade Energy Climate Overview" sections; timing and Ganzhi years belong downstream.
- You may name **pattern / favorable directions / key ten-god mechanisms** in the five sections—**structured fields only**; **no new shen_sha**.
- \`strength\` is for your reasoning only—**never** write "weak self / strong self / 身弱 / 身强" in user copy; soft-translate ("fuel runs short easily" / "deep fuel reserves").`;

const BASE_ANALYSIS_BINDING_RULES = `# 绑定计算结果 · 闭集 · 禁幻觉

1. **用神/喜神/忌神/强弱/格局** — 以 structured 为准；只能展开解释，**不得改判或另算**；喜忌方向不得与 structured 相反。
2. **神煞闭集 · 实例清单** — 神煞**只能逐字取自**本次 \`buildStructuredInstanceInventory\` 列出的项。**该清单为空则整篇不得出现任何神煞名**。你只能引用【本盘实例清单里实际算出】的神煞，按名引用；清单之外的任何神煞——无论你训练里多熟——对这个盘都不存在，写了即视为编造、会被拦截重写。
3. **十神/长生** — 同理，只用 structured 给出的具体条目；禁止类别统称代替或编造。
4. **data_availability.missing** — pillars_detail 或 da_yun 缺失时，该维度**只做方向性描述**，禁止编造具体干支/神煞/起运岁数。
5. **术语标记 · 三段位闭合 · 干支禁裸** — 凡命理术语一律 \`⟦t:<id>|<可见软译词>|<该处白话>⟧\` **三段位必须完整闭合**；**禁止**只写可见词不打标记、**禁止**句子在标记处中断截落。**正文任何干支组合**一律不得裸露——要么三段位标记，要么完全不用干支（白话）。**禁止** \`(癸酉 phase)\`、\`during 壬申\` 半裸写法。
6. **时间锚 · 零大运叙事** — 用户报告**零大运 / 零年龄段 / 零公历年 / 零干支纪年**时间锚；时机留给下游；底座叙事**不要写大运气候概览**，也不要为「显得完整」硬塞 decade 策略。
7. **标记嵌入完整句（语法）** — ⟦t:…⟧ **必须**嵌入通顺完整句；可见词**前**要有自然冠词/物主词/连接词（在标记**外**），**禁止**把标记当作无冠词句首主语或句首碎片后接大写动词新句。
   - ✗ \`mobility pulse (驿马)[···] Pairs with a sharp…\`
   - ✓ \`Your mobility pulse (驿马) keeps you in motion—it pairs with a sharp…\`
   - **标记内** \`<可见文本>\` 仍用名词短语，**禁止**在可见词**里面**写 the/a/an（避免双冠词）；冠词/物主词写在标记**外面**。
8. **可见词形态** — \`<可见文本>\` 用**名词短语**；英文如 \`refined core (癸)\`、\`mobility pulse (驿马)\`（**不在**可见词内加 the/a/an）。
9. **藏干/十神禁罗列** — **禁止** \`Hidden stems (Wu earth, Xin metal…)\` 英文堆砌；藏干用**一句机制白话**，必要时最多 1 个 ⟦t:…⟧。
10. **标记排版** — 标记**紧贴**软译词，**禁止**在标记前插入裸换行。
11. **金色词密度** — **每段最多 1–2 个** ⟦t:…⟧；同 id 不重复刷标记。
12. **禁止逐柱复述** — **禁止**在正文逐柱枚举藏干/十神/神煞/长生；不要另开四柱/大运展示段。
13. **禁止假设**「输出端会软翻译」——你必须在生成时直接写好标记与软译词。
14. **本命结构关系 · 锚定不枚举** — 关系**只能**来自实例清单【本命结构关系】（\`source=natal\`）；**最多一处**织进「你的核心配置」或「容易卡住的地方」；**禁**流年/定向/十神张力词；**禁**裸写刑冲合害或关系清单；须 ⟦t:<relation_slug>|软译|白话⟧ + 中性化。清单为空则**不得**硬塞关系词。`;

const BASE_ANALYSIS_LEAD_LABEL_RULE_ZH = `# 引导块标签（严禁占位词与模板标签）

每个论点以 \`**标签:** 正文\` 开启（渲染器 lead 块）。

- **标签** = 从**本节内容现发明**的真实短语（**3–8 字**），必须换盘/换节就不同。
- **严禁**输出占位词：**Bold lead** / **Lead** / **粗体引导** / **粗体引导句** / **引导句** 等模板字样。
- **严禁人人照抄的模板标签（反例）：** **驱动类型:** / **冷却不足:** / **调谐机制:** / **突破状态:** / **配置总览:** / **价值机制:** / **结构短板:** — 这些是坏示范，**不要**复用。`;

const BASE_ANALYSIS_LEAD_LABEL_RULE_EN = `# Lead-block labels (no placeholders · no template labels)

Open each point with \`**Label:** body\` (renderer lead block).

- **Label** = a **real gist phrase invented from THIS section** (3–8 words / short chars), must change with chart and section.
- **Never** output template placeholders: **Bold lead**, **Lead**, **Bold lead sentence**, etc.
- **Never** reuse copy-everyone template labels (**anti-examples**): **Raw drive:** / **Cooling gap:** / **Tuning mechanism:** / **Breakthrough state:** / **Config overview:** / **Value mechanism:** / **Structural gap:** — do **not** copy these.`;

const BASE_ANALYSIS_BLOCK_SPACING_ZH = `# 块间距 · 子标题与引导句分行（parseReadingBlocks 必遵）

渲染器按 **\\n\\n** 分块。\`###\` 与 \`**引导:**\` 若挤在同一段/同一行，会渲染成黏连标题（如 "Drive Type Raw drive:"）——**必须分行 + 空行**。

## 正确结构（复制换行 · 勿删空行）
\`\`\`
### 子标题

**引导标签:** 正文第一句…

**第二引导:** 可选第二段…

> **核心锚点:** 金句…
\`\`\`

## 若出现列表（调谐方向 · 仅方向、非打卡）
\`\`\`
**方向要点:**

- 第一条方向感
- 第二条方向感
\`\`\`

## 严禁（黏行 · 无法分块）
- ✗ \`### 子标题 **标签:** 正文\`（### 与引导同段）
- ✗ \`### Subhead Label: …\`（### 与引导同一行）
- ✗ \`**方向要点:** - A - B\`（清单标签与 bullet 同段、无 \`- \` 换行）

## 硬规则
1. \`### 子标题\` **独占一行**，行首 \`### \`，行末**不得**接 \`**引导:**\` 或正文
2. \`###\` 行后 **必须空一行**，再写 \`**引导标签:** 正文\`
3. 各块（### / 引导 / 短段 / > 金句 / bullets）之间 **一律 \\n\\n 空行分隔**
4. 清单标题后 **空一行**，再写第一条 \`- \``;

const BASE_ANALYSIS_BLOCK_SPACING_EN = `# Block spacing · subheads vs lead labels (parseReadingBlocks)

The renderer splits on **\\n\\n**. If \`###\` and \`**Label:**\` share one paragraph/line, UI glues them ("Drive Type Raw drive:")—**must be separate lines + blank lines**.

## Correct pattern (keep blank lines)
\`\`\`
### Subhead title

**Lead label:** First sentence of body…

**Second lead:** Optional second point…

> **Core anchor:** Pull quote…
\`\`\`

## If using lists (retune · direction only, not a checklist)
\`\`\`
**Direction notes:**

- First directional note
- Second directional note
\`\`\`

## Forbidden (glued · won't parse)
- ✗ \`### Subhead **Label:** body\` (subhead + lead same chunk)
- ✗ \`### Subhead Label: …\` (subhead + lead same line)
- ✗ \`**Direction notes:** - A - B\` (label + bullets one paragraph)

## Hard rules
1. \`### Subhead\` on **its own line** only—never append \`**Label:**\` or body on the same line
2. **Blank line after** every \`###\` line, then \`**Lead label:** body\`
3. **Blank line between** every block (### / lead / ¶ / > quote / bullets)
4. List labels then **blank line**, then first \`- \` item`;

const BASE_ANALYSIS_BULLET_RULE_ZH = `# 列表格式（必须可渲染 · 落库前 parseReadingBlocks 解析）

- 若「怎么把自己调回来」需要分点，**必须**用 Markdown 列表，且只写**方向感**，禁止打卡式行动清单：
  1. 清单标题行后 **空一行**
  2. **每一条**以 \`- \` 开头、**独占一行**
  3. 允许 \`- **标签:** 内容\`（标签仍须现发明，禁模板标签）
- **禁止**用纯文本冒号列举挤在同一段（错误：\`Rhythm: … Environment: …\` 无 \`- \`、无换行）
- **禁止**在同一行或同一段内写多个 \`- \` 项（错误：\`This looks like: - A - B - C\`）
- **禁止**「每天…分钟 / 早起跑步」类可执行打卡句`;

const BASE_ANALYSIS_BULLET_RULE_EN = `# Bullet list format (must render · parseReadingBlocks)

- If **How to Retune** needs points, **must** use Markdown bullets as **directions only**—no action checklists:
  1. Label line then **blank line**
  2. **Each** item starts with \`- \` on **its own line**
  3. OK: \`- **Invented label:** directional note\` (still invent labels; no template labels)
- **Never** colon-separated prose in one paragraph without \`- \` (bad: \`Rhythm: … Environment: …\` on one block)
- **Never** pack multiple \`- \` items on one line (bad: \`This looks like: - A - B - C\`)
- **Never** "meditate 20 min daily / run every morning"-style checklist lines`;

const BASE_ANALYSIS_LAYOUT_ZH = `# 降维排版（中立元报告 · 奢侈品交付 · 必遵）

读感应像 **中立精密读数 + 人话注解**（不是人生故事）。排版像 **Apple 官网 / 顶级杂志**：**精炼、克制、留白**。

## 全文骨架
1. **开篇身份锚**（无 ##）— 一句
2. **五个 ## 分区** — 见输出分区
3. **收尾**（无 ##）— 一句「配置读数非命运」

## 每个 ## 分区内部结构
1. **### 小标题** — 长分区拆成 **2–3 个** \`###\` 子块；**独占一行 + 后空一行**（见块间距规则）。
2. **引导块** — \`**真实现发明标签:** 正文\`（见引导块标签规则）；**禁止** Bold lead / 驱动类型 等模板；**不得与 ### 同段/同行**。
3. **短段** — 每段 **≤120 字**（英文 ≤80 词），**一个论点一段**，段间空一行。
4. **金句框 / 锚点** — **五个 ## 各至少 1 个** \`> **…:** …\`（锚点标签也要现发明真实短语）。
5. **列表** — 仅调谐方向可用；见列表格式规则。

## 篇幅与完整性
- 全文约 **800–1200 词**（中文同等篇幅）；**身份锚 + 五块 + 收尾必须齐全**—宁可略超，**不可**为压字数砍掉任何块；**不要**再写四柱/大运展示段。
- 压缩对象是**水分**（铺垫、排比、同义重复、场景举例、**逐柱原始数据罗列**、黑名单隐喻）。

## 分区硬约束
- **五块一个都不能少**；开篇身份锚与收尾必有。
- 每个 ## 分区至少 **1 个** 现发明标签引导块；「怎么把自己调回来」至少 **1 个** \`>\` 金句框 **或** 多行方向 bullets（非打卡）。`;

const BASE_ANALYSIS_LAYOUT_EN = `# Layout (neutral meta-report · luxury tier · mandatory)

Read like **precise neutral readout + plain-language notes**—not a life story. Layout like **Apple.com / a top magazine**: concise, restrained, breathing room.

## Full-document skeleton
1. **Opening identity anchor** (no ##) — one sentence
2. **Five ## sections** — see output sections
3. **Closing** (no ##) — one line: config readout, not fate

## Inside each ## section
1. **### subheads** — Split into **2–3** \`###\` blocks; **own line + blank line after** (see block-spacing rules).
2. **Lead blocks** — \`**Invented real label:** body\` (see lead-label rules)—**never** "Bold lead" / "Raw drive" templates; **never same line/chunk as ###**.
3. **Short paragraphs** — **≤80 words** each (Chinese ≤120 chars), one idea per paragraph.
4. **Pull quote / anchor** — **Each of the five ## sections** needs at least one \`> **…:** …\` (invented real label).
5. **Bullets** — retune section only, as directions (see bullet rules).

## Length & completeness
- About **800–1200 words** total; **identity + five blocks + closing required**—slightly over is OK; never drop a block; **do not** add pillar/decade display sections.
- Cut **fluff** (padding, reassurance loops, scenario examples, **pillar dumps**, blacklisted metaphors).

## Section hard rules
- **All five energy sections mandatory**; opening identity + closing required.
- Every ## section: at least one invented-label lead; **How to Retune** needs at least one \`>\` pull quote **or** multi-line directional bullets (not a checklist).`;

const BASE_ANALYSIS_FEW_SHOT_ZH = `# 分区骨架与反例（只学结构 · 禁抄完整示范句 · 禁黑名单隐喻）

## 正确骨架（\`<尖括号槽位>\` · 勿填成示范作文）

\`\`\`markdown
<一句身份锚：由本盘 day_master+strength+yong_shen 现写>

## 你的核心配置（强项）

### <现发明子标题>

**<现发明引导标签 3–8 字>:** <驱动类型与价值机制 · 可嵌 ⟦t:…⟧ · 勿抄示例隐喻>

> **<现发明锚点标签>:** <一句机制金句>

## 容易卡住的地方（需注意）

### <现发明子标题>

**<现发明引导标签>:** <结构短板 · 禁吉凶 · 可选织入一处本命关系>

> **<现发明锚点标签>:** <中性调谐提示>

## 怎么把自己调回来（调谐方向）

### <现发明子标题>

**<现发明引导标签>:** <节律/环境/决策习惯/方位颜色 · 方向感 · 禁打卡清单>

## 你和外部的能量交换

### <现发明子标题>

**<现发明引导标签>:** <需要补给什么 / 最擅长给出什么 · 禁恋爱分型>

## 什么状态下你最容易突破

### <现发明子标题>

**<现发明引导标签>:** <能量状态条件 · 禁事件/行业/年龄段>

<一句收尾：配置读数，不是命运>
\`\`\`

## 反例（禁止）
- ✗ 逐柱罗列年/月/日/时藏干、十神、神煞、长生清单
- ✗ 现实剧情（咖啡馆、换工作、结婚、升职、某某年会…）
- ✗ 输出 **Bold lead:** / **粗体引导:** / **驱动类型:** / **冷却不足:** / **调谐机制:** 等占位或人人照抄标签
- ✗ 写 \`## 四柱命盘数据\` 或 \`## 大运能量气候概览\`
- ✗ 黑名单隐喻：持续燃烧的引擎 / 散热缺口 / 冷却模块 / 手机散热片 / 随时能翻的参考书 / 藤蔓
- ✗ 完整示范式标记句如 \`⟦t:day_master|…|像持续燃烧的引擎⟧\`（过拟合）
- ✗ 通用隐喻：换一个命盘还成立 → 必须重写

## 隐喻硬规则
1. 全文一条主隐喻，由 \`day_master\` + \`strength\` + \`yong_shen\` 现定
2. 黑名单上列全部禁用
3. 自检：「换盘还成立吗？」成立即重写`;

const BASE_ANALYSIS_FEW_SHOT_EN = `# Section skeleton + anti-examples (structure only · no full demo sentences · no blacklisted metaphors)

## Correct skeleton (\`<angle-bracket slots>\` · do not fill into sample essays)

\`\`\`markdown
<one identity sentence invented from this chart's day_master+strength+yong_shen>

## Your Core Configuration (Strengths)

### <invented subhead>

**<invented lead label 3–8 words>:** <drive type + value mechanism · may embed ⟦t:…⟧ · never copy sample metaphors>

> **<invented anchor label>:** <one mechanism pull-quote>

## Where You Stick (Watch)

### <invented subhead>

**<invented lead label>:** <structural gap · no good/bad · optional one natal relation woven>

> **<invented anchor label>:** <neutral retune note>

## How to Retune (Neutral Tuning)

### <invented subhead>

**<invented lead label>:** <rhythm / environment / decision habits / direction-color · direction only · no checklists>

## Energy Exchange With Others

### <invented subhead>

**<invented lead label>:** <what you need supplied / what you give best · no romance typing>

## When Breakthrough Comes Easiest

### <invented subhead>

**<invented lead label>:** <energy-state conditions · no events / industries / age bands>

<one closing line: config readout, not fate>
\`\`\`

## Anti-examples (forbidden)
- ✗ Pillar-by-pillar dumps of hidden stems / ten gods / shen_sha / life stages
- ✗ Real-life plot (café, job switch, marriage, promotion, "in year X…")
- ✗ **Bold lead:** / **Lead:** / **Raw drive:** / **Cooling gap:** / **Tuning mechanism:** placeholders or everyone-copies labels
- ✗ Writing \`## Four-Pillar Configuration\` or \`## Decade Energy Climate Overview\`
- ✗ Blacklisted metaphors: steady-burning engine / heat-dissipation gap / cooling module / phone heatsink / always-open reference book / vine
- ✗ Full demo marker lines like \`⟦t:day_master|…|Like a steady-burning engine⟧\` (overfit)
- ✗ Generic metaphors that still work on another chart → must rewrite

## Metaphor hard rules
1. One main metaphor for the whole piece, set by \`day_master\` + \`strength\` + \`yong_shen\`
2. Entire blacklist above is banned
3. Self-check: "Would this still fit another chart?" If yes, rewrite`;

export function buildBaseAnalysisStreamPrompt(input: BaseAnalysisStreamPromptInput): {
  system: string;
  user: string;
} {
  const lang = input.local_data.output_language;
  const langLabel = outputLanguageLabel(lang);
  const redLine = lang === "zh" ? ZH_RED_LINE : EN_RED_LINE;
  const instanceInventory = buildStructuredInstanceInventory(input.local_data.structured, {
    forBaseAnalysis: true,
  });

  const taskBlock =
    lang === "zh"
      ? `# 你的任务

基于以下 **structured JSON（本地排盘引擎真算结果）**，生成一份 **「个人能量分析报告」**（Markdown 正文 only）。

这是 POJU / Glyph / Match / Syncro **四个产品共用的中立底座**。本层只写**用户可见叙事**；下游**不接收**这篇叙事——机器侧另取 structured + core_judgments。仍须写出完整 Markdown，给用户读。像体检报告 / MBTI 原始读数 / 仪器说明书——客观配置读数 + 人话注解，**不是**人生故事、职业定性或算命。`
      : `# Your task

From the **structured JSON (locally computed chart engine)** below, write a **Personal Energy Analysis Report** (Markdown body only).

Shared neutral base for **four products**: POJU / Glyph / Match / Syncro. This layer is **user-facing narrative only**; downstream does **NOT** receive this narrative—machines get structured + core_judgments separately. Still write full Markdown for the user. Read like a **lab report / raw MBTI readout / instrument manual**—objective config + plain notes, **not** life story, career typing, or fortune-telling.`;

  const outputBlock =
    lang === "zh"
      ? `# 输出要求

1. **只输出** Markdown 正文（开篇身份锚 + ## 五块 + ### 小标题 + lead + 金句框 + 可选方向 bullets + 收尾），不要 JSON，不要 \`---META---\`，不要代码块包裹全文。
2. 语言: **${langLabel}** — 全文使用这一种语言。
3. **身份锚 + 五块 + 收尾必须齐全**（标题措辞固定见下；勿再写四柱/大运段）：
${BASE_ANALYSIS_OUTPUT_SECTIONS_ZH.split("\n").slice(1).join("\n")}
4. 约 **800–1200 词**（中文同等篇幅）— **优先保证身份锚、五块与收尾完整**；宁可略超，**不可**为压字数砍块。
5. **压缩水分，不砍信息** — 删解释性铺垫、安慰性排比、同义重复、场景化举例、黑名单隐喻；保留每个分区的关键能量结论与中立调谐**方向**（作息/环境/决策习惯，非职业/关系打卡）。
6. 第二人称（你），现代、专业、克制；**每段 ≤120 字**；引导块用**现发明真实标签**（禁 Bold lead / 驱动类型 等模板）；**五块各至少 1 个**引导块 **+ 1 个** \`>\` 锚点；调谐段若用列表须**多行** \`- \`（每条独占一行，列表前空一行，非打卡）。
7. **### 独占一行**，其后空一行再写 \`**引导:**\`；子标题/引导/段落/bullets 块间一律 \`\\n\\n\` 空行（禁黏行）。
8. 挑战类**不得渲染成「灾祸/损失」恐吓**；**禁裸干支**；**用户报告零大运/零年龄段/零公历年/零干支纪年时间锚**；**禁止逐柱罗列**；神煞/十神**只能来自 structured 实例清单**；**每个 ⟦t:…⟧ 三段位必须闭合**、**嵌入完整句**；可见词内禁 the/a/an。
9. **落库门禁** — 集外神煞、断标记、裸干支、密度超标会导致整篇被拒并重写；可自然提及 POJU / pojulife；禁 astrology / divination / psychic / horoscope。`
      : `# Output requirements

1. **Markdown body only** (opening identity + five ## sections + ### subheads + lead + pull quotes + optional directional bullets + closing)—no JSON, no \`---META---\`, no fenced full-document code block.
2. Language: **${langLabel}** throughout.
3. **Identity + five sections + closing required** (fixed semantics below; no pillar/decade display sections):
${BASE_ANALYSIS_OUTPUT_SECTIONS_EN.split("\n").slice(1).join("\n")}
4. About **800–1200 words**—**identity, five blocks, and closing complete first**; slightly over is OK; never drop a block for word cap.
5. **Cut fluff, not facts** — drop padding, reassurance loops, scenario examples, blacklisted metaphors; keep each section's key energy read + **neutral retune direction** (rhythm/environment/decision habits—not career/relationship checklists).
6. Second person (you); modern, restrained, professional; **≤80 words per paragraph**; lead blocks use **invented real labels** (never "Bold lead" / "Raw drive" templates); **each of the five sections** needs at least one labeled lead **+ one** \`>\` anchor; retune lists (if any) use **multi-line** \`- \` (one per line, blank line before list, not a checklist).
7. **Each \`###\` on its own line**, blank line, then \`**Label:** body\`; blank \`\\n\\n\` between ### / lead / ¶ / bullets (never glued).
8. Do not frame challenges as doom/scare; **no bare Ganzhi**; **user report: zero decade / zero age-band / zero calendar-year / zero Ganzhi-year timing anchors**; **no pillar-by-pillar dumps**; shen_sha/ten_gods **only from structured instance inventory**; **every ⟦t:…⟧ fully closed**, **embedded in complete sentences**; no the/a/an **inside** visible text.
9. **Delivery gate** — out-of-set shen_sha, broken markers, bare Ganzhi, or density overflow will reject the draft and force rewrite; POJU / pojulife OK; no astrology / divination / psychic / horoscope.`;

  const forbiddenBlock =
    lang === "zh"
      ? `# 语义红线（用户可见输出）

- 中文禁: ${ZH_RED_LINE}（改用「能量倾向/需留意/节律」等）
- English禁: ${EN_RED_LINE}
- 不预测具体未来事件、不下命运定论、不给医疗/财务/法律建议`
      : `# Semantic red lines (user-visible)

- Chinese forbidden: ${ZH_RED_LINE}
- English forbidden: ${EN_RED_LINE}
- No specific future events, no fatalism, no medical/financial/legal advice`;

  const system = stitchPromptSections(
    taskBlock,
    lang === "zh" ? BASE_ANALYSIS_NEUTRALITY_RULES_ZH : BASE_ANALYSIS_NEUTRALITY_RULES_EN,
    buildForbiddenTermsPromptBlock(lang),
    lang === "zh" ? BASE_ANALYSIS_NARRATIVE_BREVITY_ZH : BASE_ANALYSIS_NARRATIVE_BREVITY_EN,
    ...buildPlainspeakVoiceSections(PLAINSPEAK_STYLE_EXAMPLE_BASE_ANALYSIS),
    READING_LAYOUT_CONTRACT,
    lang === "zh" ? BASE_ANALYSIS_BLOCK_SPACING_ZH : BASE_ANALYSIS_BLOCK_SPACING_EN,
    lang === "zh" ? BASE_ANALYSIS_LEAD_LABEL_RULE_ZH : BASE_ANALYSIS_LEAD_LABEL_RULE_EN,
    lang === "zh" ? BASE_ANALYSIS_BULLET_RULE_ZH : BASE_ANALYSIS_BULLET_RULE_EN,
    lang === "zh" ? BASE_ANALYSIS_LAYOUT_ZH : BASE_ANALYSIS_LAYOUT_EN,
    BASE_ANALYSIS_BINDING_RULES,
    buildTermMarkingPromptBlock(lang, { principlesOnly: true }),
    lang === "zh" ? BASE_ANALYSIS_FEW_SHOT_ZH : BASE_ANALYSIS_FEW_SHOT_EN,
    outputBlock,
    forbiddenBlock,
    ORIENTAL_SHARED_GUARDRAILS,
    instanceInventory,
  );

  const user =
    lang === "zh"
      ? `structured JSON（内部数据 — 据此写「个人能量分析报告」；守实例闭集、术语标记、中立硬禁）:

\`\`\`json
${JSON.stringify(input.local_data.structured, null, 2)}
\`\`\`

现在开始写完整 Markdown。**降维排版**（开篇身份锚 + 五块 ## + ### + **现发明标签:** 引导块 + 短段 + > 锚点 + 可选方向 bullets + 收尾）；约 **800–1200 词、身份锚+五块+收尾齐全**；零大运/零年龄段时间锚；不逐柱罗列；术语三段位；**禁裸干支**；神煞/十神不得超出 structured；避免语义红线词（${redLine}）。`
      : `structured JSON (internal — write Personal Energy Analysis Report; honor closed-set, term markers, neutral hard bans):

\`\`\`json
${JSON.stringify(input.local_data.structured, null, 2)}
\`\`\`

Write the full Markdown now. **Magazine layout** (opening identity + five ## + ### + **invented label:** lead + short ¶ + > anchor + optional directional bullets + closing); about **800–1200 words, identity + five blocks + closing complete**; zero decade/age-band timing anchors; no pillar dumps; 3-part term markers; **no bare Ganzhi**; shen_sha/ten_gods within structured; never output literal "Bold lead" or template leads like "Raw drive"; avoid red-line words (${redLine}).`;

  return { system, user };
}
