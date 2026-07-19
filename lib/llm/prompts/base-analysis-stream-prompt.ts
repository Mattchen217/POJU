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
import { buildDualLayerDeliveryPromptBlock } from "@/lib/llm/prompts/dual-layer-delivery";
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
  用它把容易卡住的地方或你的核心配置锚到真实结构张力上——
  例：结构里有一处彼此消耗的拉扯（源自相刑）、核心与外部有一股要合而未合的牵引（源自天干合）。
- 【最多点一处】，织进叙事，【禁枚举】关系名（不写你有寅巳相刑、巳酉半合这类清单）。
- **关系类【不打标】**：刑/冲/合/害等只写中性白话；禁止 \`⟦t:liu_chong|…⟧\` / \`⟦t:liuhe|…⟧\` 等自造或套用关系 glossary slug。
- 【只用 source=natal 的本命关系】；实例清单里的【流年/动态关系一律忽略】——
  底座是稳定中立读数，流年剧情留给下游。`;

const BASE_ANALYSIS_NATAL_RELATION_ANCHOR_EN = `[Anchor structure on natal relations (natal only · one mention max · neutral · woven)]
- If the instance inventory lists **natal structure relations** (clash / penalty / harm / half-combo / triple / stem combine),
  use **one** to anchor **Where You Stick** or **Your Core Configuration** to real structural tension—
  e.g. "a mutually draining pull inside the structure" (from penalty), "core and outer field share an almost-merge pull" (from stem combine).
- **At most one mention**, woven into narrative—**never enumerate** ("you have Yin-Si penalty AND Si-You half-combo…").
- **No relation markers**: describe clash/combine in neutral vernacular only — never \`⟦t:liu_chong|…⟧\` / glossary relation slugs.
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
3. **## 怎么把自己调回来（调谐方向）** — 中立调谐方向：作息节律、环境、决策习惯、方位·颜色倾向；绑定 \`yong_shen\` / \`xi_shen\` + 调候。**禁止**写成行动打卡清单（如每天冥想 20 分钟、早起跑步这类打卡步骤）；只给方向感，不列步骤表。
4. **## 你和外部的能量交换** — 你**需要外界补给什么**、你**最擅长向外给出什么**；双向能量交换读数。**禁止**恋爱分型 / \`适合的伴侣\` / 婚恋推荐。
5. **## 什么状态下你最容易突破** — 只描述**能量状态**（用神得力 / 格局成时系统最易出信噪比）；**不预测事件、不指定行业、不点年龄段**。

## 收尾（系统渲染 · 模型勿写）

- **禁止**在 Markdown 里写收尾句。界面会在五块分区之外固定展示：这是你的能量配置读数。怎么用它，取决于你自己。
- **禁止**把该句写进任何 \`**依据与推理:**\` 块（会进折叠依据、用户看不见完整收尾）。
- **禁止**用这不是命运 / 不是命定 / 不是判决书等否定式收尾——会诱使写出禁词。`;

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

## Closing (system-rendered · do not write)

- **Do not** write a closing line in the Markdown. The UI always shows below the five sections: "This is your energy-config readout. How you use it is up to you."
- **Never** put that line inside any \`**Evidence & reasoning:**\` block (it would fold into evidence and vanish as a report closer).
- **Never** close with "this is not fate / not destiny / not a verdict" negations—those invite banned words.`;

const BASE_ANALYSIS_NEUTRALITY_RULES_ZH = `# 中立元报告 · 硬禁（场景化留给下游 POJU/Glyph/Match/Syncro）

这份报告是**共用中立上下文底座**（像体检报告 / MBTI 原始读数 / 仪器说明书）：**客观、无场景、无定性职业、无人生故事**。

## 禁止任何现实情节与定性
- **禁**职业/行业/经营状态/雇佣/婚育/资产/具体人际关系断言。
- **禁例:** \`你适合开咖啡馆\` \`hire a part-time helper\` \`running a food stall\` \`该换工作了\` \`适合结婚\`。
- **只谈机制，不编情节**：说这套系统怎么运转、在什么条件下失效；不说他是谁、做什么、会遇到什么。
- **禁**未来事件预测（新合伙/扩张/机会到来/某年会…）— 只给**能量倾向**。
- **禁**医疗与脏腑点名：健康相关改为中立的 \`系统过载 / 内耗 / 节律失衡\` 能量描述 + 作息环境类调谐方向；**不点名器官、不给饮食医嘱**。
- 职业/关系若**必须**提及，只能作为 \`能量投射的中立举例\`，并显式标注 \`举例，非定性\`— **但优先完全不提**，把投射留给下游。
- **禁**恋爱分型 / \`适合的伴侣\` 类外部交换误写。

## 比喻边界（本盘唯一主隐喻）
- 全文**最多一条主隐喻**，由本盘 \`day_master\` + \`strength\` + \`yong_shen\` **现定**；服务于解释能量机制，**不编造现实情节**。
- **现定**：主比喻从这盘的 day_master / strength / yong_shen 长出来；别套用任何现成意象（含机械词）。
- 自检：**换一个命盘还成立吗？**——成立就必须重写。`;

const BASE_ANALYSIS_NEUTRALITY_RULES_EN = `# Neutral meta-report · hard bans (scenarios belong to downstream POJU/Glyph/Match/Syncro)

This is a **shared neutral context base** (like a lab report / raw MBTI readout / instrument manual): **objective, scene-free, no career typing, no life story**.

## No real-world plot or typing
- **Ban** career/industry/business status/hiring/marriage/parenting/assets/specific relationship assertions.
- **Bad:** "You should run a café," "hire a part-time helper," "running a food stall," "time to switch jobs," "ready for marriage."
- **Mechanism only, no plot**: describe how the system runs and where it fails; never who he is, what he does, or what will happen to him.
- **Ban** future-event predictions (new partner, expansion, opportunity arriving, "in 2027…")—**energy tendency only**.
- **Ban** medical/organ naming: health = neutral "system overload / internal friction / rhythm drift" + rhythm/environment retune direction—**no organs, no diet prescriptions**.
- Career/relationship mentions, if unavoidable, must be labeled "**example only—not a typing**"—**prefer omitting entirely**; downstream handles projection.
- **Ban** romance typing / "suitable partner" misreads of energy exchange.

## Metaphor boundary (one main metaphor per chart)
- **At most one** main metaphor, determined by this chart's \`day_master\` + \`strength\` + \`yong_shen\`; explains mechanism only—**no** life plot.
- **Chart-native**: the metaphor grows from this chart's day_master / strength / yong_shen — never reuse canned imagery (including mechanical stock).
- Self-check: **"Would this still work for another chart?"**—if yes, rewrite.`;

const BASE_ANALYSIS_NARRATIVE_BREVITY_ZH = `# 叙事精简 · 禁止逐柱复述（准确性）

- 正文保持**五块综合判断**的精简中立文本即可——**禁止**为显得详细而逐柱罗列原始数据（各柱藏干/十神/神煞/长生/干支表）。
- 原始配置由 **structured JSON** 完整注入下游；叙事复述既冗余，又是**神煞幻觉高发区**。
- **不要**写四柱命盘数据、大运能量气候概览分区；时机与干支纪年留给下游。
- 允许在五块中点名：**格局、用神/喜忌方向、关键十神机制组合**——只能引用 structured 实有字段，**不得新增神煞**。
- \`strength\`（强弱）**仅供你推理**——用户正文【禁止】写出 \`身弱\` \`身强\` \`身旺\`；软译说法**一律以上方【绝对禁词】块里的对照表为准**，这里不另立第二套说法。`;

const BASE_ANALYSIS_NARRATIVE_BREVITY_EN = `# Narrative brevity · no pillar dumps (accuracy)

- Keep body copy as **concise neutral synthesis across the five sections**—**never** pad with pillar-by-pillar raw dumps (hidden stems / ten gods / shen_sha / life stages / pillar tables).
- Raw config is injected downstream via **structured JSON**; narrative re-listing is redundant and a **shen_sha hallucination hotspot**.
- **Do not** write "Four-Pillar Configuration" or "Decade Energy Climate Overview" sections; timing and Ganzhi years belong downstream.
- You may name **pattern / favorable directions / key ten-god mechanisms** in the five sections—**structured fields only**; **no new shen_sha**.
- \`strength\` is for your reasoning only—**never** write "weak self / strong self / 身弱 / 身强" in user copy; use the soft-translation table in the absolute-bans block above—do not invent a second wording here.`;

const BASE_ANALYSIS_BINDING_RULES = `# 绑定计算结果 · 闭集 · 禁幻觉

1. **用神/喜神/忌神/强弱/格局** — 以 structured 为准；只能展开解释，**不得改判或另算**；喜忌方向不得与 structured 相反。
2. **神煞闭集 · 实例清单** — 神煞**只能逐字取自**本次 \`buildStructuredInstanceInventory\` 列出的项。**该清单为空则整篇不得出现任何神煞名**。你只能引用【本盘实例清单里实际算出】的神煞，按名引用；清单之外的任何神煞——无论你训练里多熟——对这个盘都不存在，写了即视为编造、会被拦截重写。
3. **十神/长生** — 同理，只用 structured 给出的具体条目；禁止类别统称代替或编造。
4. **data_availability.missing** — pillars_detail 或 da_yun 缺失时，该维度**只做方向性描述**，禁止编造具体干支/神煞/起运岁数。
5. **双层 + 术语标记** — 每个 ## 分区末尾加 \`**依据与推理:**\`（默认折叠），格式 \`⟦t:<slug>|⟧\`（竖线后留空；软译与白话由系统填）。

   **【正文零标记 · 硬错不是风格】** 正文是给用户读的白话，**任何 ⟦t:…⟧ 都不许出现在正文**。
   **特别注意五行字（火/水/木/金/土）**：正文里它们是你写的白话意象的一部分，**用字本身，绝不打标**。
     ✗ 你像一团被安置在陶罐里的 ⟦t:fire|⟧      ← 打标后会被渲染成软译，读起来不通顺 → 错
   **判断标准（自己判，不要背例子）**：把你想打的标记在心里渲染成软译（火会变成别的词、水会变成别的词），
   如果这句话**读起来不通顺了**，就说明这个字是你的白话意象、本来就不该打标 —— 直接用字本身。
   只有在**【依据与推理】块**里、把五行当**能量概念**引用时才打标。
   **正文（含开篇身份锚）出现任何 ⟦t:…⟧ = 判失败重写。**

   **【正文禁用角引号】** 正文是平静的自然语言，像一个懂你的人在跟你说话，
   **不要给任何词加角引号强调**（不写 \`精准释放\` \`泄压通道\` \`输出\` \`水\` \`木\` 这类）。
   要强调就靠句子本身写清楚，不靠引号划重点 —— 引号会让正文像教材划重点，打断自然感。
   （依据块同理：术语靠打标 ⟦t:…⟧，也不用角引号划词。）

   **【依据先行 · 顺序焊死】** 每块按此顺序，不许倒过来：
   ① **推理**：根据本段要讲清的内容，抓取相关锚点真算 —— 抓够为止，标准是这段讲透了、结论立得住，不是个数。
      **（至少 1 个必须是 shensha 或本命关系** —— 只用强弱+喜忌+十神三标签的是任何同类盘都成立的套话。）
      **推理自检（下结论前必做）**：我这条 **完整的承重证据链** 搭好了吗？——
      本段每一个结论断言，是不是都有承重锚点撑着？有没有哪个关键推断，我还没找到支撑就想略过？
      **漏了承重的一环就回去补算 —— 推理阶段宁可多算一环，不可漏算关键一环，再落笔。**
   ② 据这条链推结论；③ 写正文白话；④ 落依据块。
   **自检：把依据块整个删掉，正文结论还站得住吗？站得住 = 先写结论再补依据 = 整块重写。**

   **【依据块 = 完整的最短承重证据链，是引证不是推理实录】**
   （注意：**推理求全（完整的承重链，宁多不漏），依据求精（从算出的完整链里，只留本段结论必需的那几环）**。）
   - **最短**：推理时你可能算过很多锚点，依据里**只放本段结论真正依赖的**，无关的一个不带 → 天然不堆砌。
   - **完整**：承重的一个都不能少 —— 少一环，证据链就断，结论就悬空。
   - **不为求少而砍承重环，不为凑数而加无关环。**
   - **自检**：删掉任一金字，结论还站得住吗？站得住 = 那环是凑数的（删）；站不住 = 那环是承重的（留）。

   **【裸词一律打标，不许在正文或依据里裸露】**——这是硬错，不是风格问题：
   - 五行：依据里引用五行时打标 \`⟦t:wood|⟧\` \`⟦t:fire|⟧\`（土/金/水同理），不要写五行的原字。
     ✗ 增加木性让火烧得更旺（依据里裸写五行原字 → 错）
   - 十神：依据里引用十神时打标 \`⟦t:shi_shen|⟧\` \`⟦t:pian_cai|⟧\`，不要写十神原词。
     ✗ 展现才华（食神）获取资源（偏财）（依据里裸写十神原词 → 错）
   - 干支：任何干支组合都不得裸露，禁 \`(癸酉 phase)\`、\`during 壬申\` 半裸写法。
   **泄身通道要交代**：某通道在【当前强弱+喜忌方向】下是推进还是消耗，说明白，别默认当优势。

   仍禁：数据罗列（逐柱）、犹豫措辞（可能/也许）。须有锚点 + 推导闭合（因为 A＋B → 所以结论）。
6. **白话槽留空 · 系统填** — 格式 \`⟦t:<slug>|⟧\`（竖线保留、后面不写）。
   这一层是四产品共用的中立底座，**没有这位用户的具体处境**——任何"贴题白话"都是你编的，
   系统会丢弃并用术语表里的固定释义覆盖。你唯一要做的是**选对 slug**。
   - ✗ \`⟦t:day_master|乙木⟧\`（裸干支）
   - ✗ \`⟦t:weak_self|需养⟧\`（把软译抄进白话槽 = 用这个词解释这个词）
   - ✗ \`⟦t:shi_shen|将感受化为产出的食神⟧\`（白话里留了术语原词）
7. **时间锚 · 零大运叙事** — 用户报告**零大运 / 零年龄段 / 零公历年 / 零干支纪年**时间锚；时机留给下游；底座叙事**不要写大运气候概览**，也不要为显得完整硬塞 decade 策略。
8. **标记嵌入完整句（语法）** — ⟦t:…⟧ **必须**嵌入通顺完整句；软译词**前**要有自然冠词/物主词/连接词（在标记**外**），**禁止**把标记当作无冠词句首主语或句首碎片后接大写动词新句。
   - ✗ \`mobility pulse (驿马)[···] Pairs with a sharp…\`
9. **藏干/十神禁罗列** — **禁止** \`Hidden stems (Wu earth, Xin metal…)\` 英文堆砌；藏干用**一句机制白话**，必要时最多 1 个 ⟦t:…⟧。
10. **标记排版** — 标记只出现在依据块内，**禁止**在标记前插入裸换行；\`**依据与推理:**\` 与其后整段须连成一块（勿空行拆开，以免金字漏在折叠外）。
11. **金色词密度** — **正文零标记**（与第 5 条一致）；**依据与推理**块 = **完整的最短承重证据链**（不多一环、不少一环，环数随结论浮动）；同 id 不重复刷标记。
12. **禁止逐柱复述** — **禁止**在正文逐柱枚举藏干/十神/神煞/长生；不要另开四柱/大运展示段。
13. **软译词与白话由系统填入**——你只选 slug；白话槽留空；勿自造软译。
14. **本命结构关系 · 锚定不枚举** — 关系**只能**来自实例清单【本命结构关系】（\`source=natal\`）；**最多一处**织进你的核心配置或容易卡住的地方；**禁**流年/定向/十神张力词；**禁**裸写刑冲合害或关系清单；**关系类不打标、直接中性白话**（禁止 \`liu_chong\` / \`liuhe\` 等 glossary slug 标记）。清单为空则**不得**硬塞关系词。`;

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

- 若怎么把自己调回来需要分点，**必须**用 Markdown 列表，且只写**方向感**，禁止打卡式行动清单：
  1. 清单标题行后 **空一行**
  2. **每一条**以 \`- \` 开头、**独占一行**
  3. 允许 \`- **标签:** 内容\`（标签仍须现发明，禁模板标签）
- **禁止**用纯文本冒号列举挤在同一段（错误：\`Rhythm: … Environment: …\` 无 \`- \`、无换行）
- **禁止**在同一行或同一段内写多个 \`- \` 项（错误：\`This looks like: - A - B - C\`）
- **禁止**每天…分钟 / 早起跑步类可执行打卡句`;

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
3. **收尾** — **勿写**；由界面在五块之外固定展示配置读数 / 怎么用取决于你

## 每个 ## 分区内部结构
1. **### 小标题** — 长分区拆成 **2–3 个** \`###\` 子块；**独占一行 + 后空一行**（见块间距规则）。
2. **引导块** — \`**真实现发明标签:** 正文\`（见引导块标签规则）；**禁止** Bold lead / 驱动类型 等模板；**不得与 ### 同段/同行**。
3. **短段** — 每段 **≤120 字**（英文 ≤80 词），**一个论点一段**，段间空一行。
4. **金句框 / 锚点** — **五个 ## 各至少 1 个** \`> **…:** …\`（锚点标签也要现发明真实短语）。
5. **列表** — 仅调谐方向可用；见列表格式规则。

## 篇幅与完整性
- 全文约 **800–1200 词**（中文同等篇幅）；**身份锚 + 五块必须齐全**—宁可略超，**不可**为压字数砍掉任何块；**不要**再写四柱/大运展示段；**不要**手写收尾句。
- 压缩对象是**水分**（铺垫、排比、同义重复、场景举例、**逐柱原始数据罗列**、黑名单隐喻）。

## 分区硬约束
- **五块一个都不能少**；开篇身份锚必有；收尾由系统渲染、模型勿写。
- 每个 ## 分区至少 **1 个** 现发明标签引导块；怎么把自己调回来至少 **1 个** \`>\` 金句框 **或** 多行方向 bullets（非打卡）。`;

const BASE_ANALYSIS_LAYOUT_EN = `# Layout (neutral meta-report · luxury tier · mandatory)

Read like **precise neutral readout + plain-language notes**—not a life story. Layout like **Apple.com / a top magazine**: concise, restrained, breathing room.

## Full-document skeleton
1. **Opening identity anchor** (no ##) — one sentence
2. **Five ## sections** — see output sections
3. **Closing** — **do not write**; UI always shows the config-readout closer below the five sections

## Inside each ## section
1. **### subheads** — Split into **2–3** \`###\` blocks; **own line + blank line after** (see block-spacing rules).
2. **Lead blocks** — \`**Invented real label:** body\` (see lead-label rules)—**never** "Bold lead" / "Raw drive" templates; **never same line/chunk as ###**.
3. **Short paragraphs** — **≤80 words** each (Chinese ≤120 chars), one idea per paragraph.
4. **Pull quote / anchor** — **Each of the five ## sections** needs at least one \`> **…:** …\` (invented real label).
5. **Bullets** — retune section only, as directions (see bullet rules).

## Length & completeness
- About **800–1200 words** total; **identity + five blocks required**—slightly over is OK; never drop a block; **do not** add pillar/decade display sections; **do not** hand-write a closing line.
- Cut **fluff** (padding, reassurance loops, scenario examples, **pillar dumps**, blacklisted metaphors).

## Section hard rules
- **All five energy sections mandatory**; opening identity required; closing is system-rendered (model must not write it).
- Every ## section: at least one invented-label lead; **How to Retune** needs at least one \`>\` pull quote **or** multi-line directional bullets (not a checklist).`;

const BASE_ANALYSIS_FEW_SHOT_ZH = `# 分区骨架与反例（只学结构 · 禁抄完整示范句 · 主比喻须现定）

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

（收尾句勿写——界面固定展示）
\`\`\`

## 反例（禁止）
- ✗ 逐柱罗列年/月/日/时藏干、十神、神煞、长生清单
- ✗ 现实剧情（咖啡馆、换工作、结婚、升职、某某年会…）
- ✗ 输出 **Bold lead:** / **粗体引导:** / **驱动类型:** / **冷却不足:** / **调谐机制:** 等占位或人人照抄标签
- ✗ 写 \`## 四柱命盘数据\` 或 \`## 大运能量气候概览\`
- ✗ 套用现成机械意象或人人通用的隐喻（换盘还成立）
- ✗ 完整示范式标记句（过拟合）
- ✗ 通用隐喻：换一个命盘还成立 → 必须重写

## 隐喻硬规则
1. 全文一条主隐喻，由 \`day_master\` + \`strength\` + \`yong_shen\` 现定
2. 自检：换盘还成立吗？成立即重写`;

const BASE_ANALYSIS_FEW_SHOT_EN = `# Section skeleton + anti-examples (structure only · no full demo sentences · chart-native metaphor)

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

(do not write closing — UI renders it)
\`\`\`

## Anti-examples (forbidden)
- ✗ Pillar-by-pillar dumps of hidden stems / ten gods / shen_sha / life stages
- ✗ Real-life plot (café, job switch, marriage, promotion, "in year X…")
- ✗ **Bold lead:** / **Lead:** / **Raw drive:** / **Cooling gap:** / **Tuning mechanism:** placeholders or everyone-copies labels
- ✗ Writing \`## Four-Pillar Configuration\` or \`## Decade Energy Climate Overview\`
- ✗ Canned mechanical imagery or metaphors that still fit another chart
- ✗ Full demo marker lines (overfit)
- ✗ Generic metaphors that still work on another chart → must rewrite

## Metaphor hard rules
1. One main metaphor for the whole piece, set by \`day_master\` + \`strength\` + \`yong_shen\`
2. Self-check: "Would this still fit another chart?" If yes, rewrite`;

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

基于以下 **structured JSON（本地排盘引擎真算结果）**，生成一份 **《个人能量分析报告》**（Markdown 正文 only）。

这是 POJU / Glyph / Match / Syncro **四个产品共用的中立底座**。本层只写**用户可见叙事**；下游**不接收**这篇叙事——机器侧另取 structured + core_judgments。仍须写出完整 Markdown，给用户读。像体检报告 / MBTI 原始读数 / 仪器说明书——客观配置读数 + 人话注解，**不是**人生故事、职业定性或算命。`
      : `# Your task

From the **structured JSON (locally computed chart engine)** below, write a **Personal Energy Analysis Report** (Markdown body only).

Shared neutral base for **four products**: POJU / Glyph / Match / Syncro. This layer is **user-facing narrative only**; downstream does **NOT** receive this narrative—machines get structured + core_judgments separately. Still write full Markdown for the user. Read like a **lab report / raw MBTI readout / instrument manual**—objective config + plain notes, **not** life story, career typing, or fortune-telling.`;

  const outputBlock =
    lang === "zh"
      ? `# 输出要求

1. **只输出** Markdown 正文（开篇身份锚 + ## 五块 + ### 小标题 + lead + 金句框 + 可选方向 bullets；**勿写收尾**），不要 JSON，不要 \`---META---\`，不要代码块包裹全文。
2. 语言: **${langLabel}** — 全文使用这一种语言。
3. **身份锚 + 五块必须齐全**（标题措辞固定见下；勿再写四柱/大运段；收尾由界面渲染）：
${BASE_ANALYSIS_OUTPUT_SECTIONS_ZH.split("\n").slice(1).join("\n")}
4. 约 **800–1200 词**（中文同等篇幅）— **优先保证身份锚与五块完整**；宁可略超，**不可**为压字数砍块。
5. **压缩水分，不砍信息** — 删解释性铺垫、安慰性排比、同义重复、场景化举例、黑名单隐喻；保留每个分区的关键能量结论与中立调谐**方向**（作息/环境/决策习惯，非职业/关系打卡）。
6. 第二人称（你），现代、专业、克制；**每段 ≤120 字**；引导块用**现发明真实标签**（禁 Bold lead / 驱动类型 等模板）；**五块各至少 1 个**引导块 **+ 1 个** \`>\` 锚点；调谐段若用列表须**多行** \`- \`（每条独占一行，列表前空一行，非打卡）。
7. **### 独占一行**，其后空一行再写 \`**引导:**\`；子标题/引导/段落/bullets 块间一律 \`\\n\\n\` 空行（禁黏行）。
8. 挑战类**不得渲染成灾祸/损失恐吓**；**禁裸干支**；**用户报告零大运/零年龄段/零公历年/零干支纪年时间锚**；**禁止逐柱罗列**；神煞/十神**只能来自 structured 实例清单**；**正文零标记**；依据块 \`⟦t:slug|贴题白话⟧\` 闭合完整。
9. **落库门禁** — 集外神煞、断标记、裸干支、密度超标会导致整篇被拒并重写；可自然提及 POJU / pojulife；禁 astrology / divination / psychic / horoscope。`
      : `# Output requirements

1. **Markdown body only** (opening identity + five ## sections + ### subheads + lead + pull quotes + optional directional bullets; **no closing line**)—no JSON, no \`---META---\`, no fenced full-document code block.
2. Language: **${langLabel}** throughout.
3. **Identity + five sections required** (fixed semantics below; no pillar/decade display sections; closing is UI-rendered):
${BASE_ANALYSIS_OUTPUT_SECTIONS_EN.split("\n").slice(1).join("\n")}
4. About **800–1200 words**—**identity and five blocks complete first**; slightly over is OK; never drop a block for word cap.
5. **Cut fluff, not facts** — drop padding, reassurance loops, scenario examples, blacklisted metaphors; keep each section's key energy read + **neutral retune direction** (rhythm/environment/decision habits—not career/relationship checklists).
6. Second person (you); modern, restrained, professional; **≤80 words per paragraph**; lead blocks use **invented real labels** (never "Bold lead" / "Raw drive" templates); **each of the five sections** needs at least one labeled lead **+ one** \`>\` anchor; retune lists (if any) use **multi-line** \`- \` (one per line, blank line before list, not a checklist).
7. **Each \`###\` on its own line**, blank line, then \`**Label:** body\`; blank \`\\n\\n\` between ### / lead / ¶ / bullets (never glued).
8. Do not frame challenges as doom/scare; **no bare Ganzhi**; **user report: zero decade / zero age-band / zero calendar-year / zero Ganzhi-year timing anchors**; **no pillar-by-pillar dumps**; shen_sha/ten_gods **only from structured instance inventory**; **every ⟦t:…⟧ fully closed**, **embedded in complete sentences**; no the/a/an **inside** visible text.
9. **Delivery gate** — out-of-set shen_sha, broken markers, bare Ganzhi, or density overflow will reject the draft and force rewrite; POJU / pojulife OK; no astrology / divination / psychic / horoscope.`;

  const forbiddenBlock =
    lang === "zh"
      ? `# 语义红线（用户可见输出）

- 中文禁: ${ZH_RED_LINE}（改用能量倾向/需留意/节律等）
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
    buildDualLayerDeliveryPromptBlock(lang),
    buildTermMarkingPromptBlock(lang, { principlesOnly: true, neutralBase: true }),
    lang === "zh" ? BASE_ANALYSIS_FEW_SHOT_ZH : BASE_ANALYSIS_FEW_SHOT_EN,
    outputBlock,
    forbiddenBlock,
    ORIENTAL_SHARED_GUARDRAILS,
    instanceInventory,
  );

  const user =
    lang === "zh"
      ? `structured JSON（内部数据 — 据此写《个人能量分析报告》；守实例闭集、术语标记、中立硬禁）:

\`\`\`json
${JSON.stringify(input.local_data.structured, null, 2)}
\`\`\`

现在开始写完整 Markdown。**双层排版**（开篇身份锚 + 五块 ##：正文白话零标记 + 每块末尾 \`**依据与推理:**\` 含金字）；约 **800–1200 词、身份锚+五块齐全**；**勿写收尾句**（界面固定展示）；零大运/零年龄段时间锚；不逐柱罗列；**禁裸干支**；神煞/十神不得超出 structured；避免语义红线词（${redLine}）。`
      : `structured JSON (internal — write Personal Energy Analysis Report; honor closed-set, term markers, neutral hard bans):

\`\`\`json
${JSON.stringify(input.local_data.structured, null, 2)}
\`\`\`

Write the full Markdown now. **Magazine layout** (opening identity + five ## + ### + **invented label:** lead + short ¶ + > anchor + optional directional bullets; **no closing line**—UI renders it); about **800–1200 words, identity + five blocks complete**; zero decade/age-band timing anchors; no pillar dumps; 3-part term markers; **no bare Ganzhi**; shen_sha/ten_gods within structured; never output literal "Bold lead" or template leads like "Raw drive"; avoid red-line words (${redLine}).`;

  return { system, user };
}
