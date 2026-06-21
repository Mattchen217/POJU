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

/** Four neutral energy dimensions + two data-display layers (fixed semantics). */
const BASE_ANALYSIS_OUTPUT_SECTIONS_ZH = `# 输出分区（必须齐全 · Markdown ## 标题）

## 四维能量动力学（中立诊断 · 必须四块齐全）

1. **## 核心底色（Core Engine Baseline · 强项）** — 原始驱动力类型（火=高频爆发 / 土=稳健承载 等），绑定 \`day_master\` + \`strength\` + \`pattern\`；能量在何种机制下产生最大价值（十神组合的现代机制转译，如食神生财、官印相生——**只谈机制，不谈职业场景**）。
2. **## 系统脆弱点（Structural Vulnerabilities · 需注意）** — **不谈吉凶**，只谈配置天然短板：缺冷却机制（缺水）→ 冲动决策；结构过载（克泄交加）→ 身心内耗。绑定 \`ji_shen\` / 缺失五行 / 失衡。
3. **## 能量平衡锚（Balancing Anchors · 解决方案）** — 中立、**非场景**的调谐：作息节律、环境心理学、决策习惯（Wood/Water/Metal 的调谐机制）。绑定 \`yong_shen\` / \`xi_shen\` + 调候；可含方位 · 颜色 · 物件 · 朝向 · 规避（禁招财/催运/避邪承诺）。
4. **## 高杠杆发力区（High-Leverage Trajectory · 全力以赴方向）** — 当系统处于何种状态（用神得力 / 格局成）时**最易突破**；只描述「什么能量状态下最易出成就」，**不预测具体事件，不指定行业**。

## 数据展示层（配置读数 · 禁人生剧情）

5. **## 四柱命盘数据** — 年/月/日/时柱、藏干、十神、神煞（**仅 structured 里该柱实际有的项**）；仪器读数口吻。**逐柱：有则写、无则跳过**；每柱 ≤2 个金字；**禁止**为填满四柱补神煞。
6. **## 大运能量气候概览** — 按 \`structured.da_yun\` 时序概览各阶段**能量气候倾向**（偏燥/偏润/收敛/扩张等）；缺失则方向性 climate sketch。**只讲气候，不讲人生剧情**；禁裸干支（用年龄段白话或 ⟦t:decade|…⟧）。`;

const BASE_ANALYSIS_OUTPUT_SECTIONS_EN = `# Output sections (all required · Markdown ## headings)

## Four neutral energy dimensions (mandatory · all four)

1. **## Core Engine Baseline (强项)** — Raw drive type (fire = high-frequency bursts / earth = steady load-bearing, etc.), bound to \`day_master\` + \`strength\` + \`pattern\`; where energy creates max value via ten-god **mechanisms** (e.g. output feeds wealth, officer nourishes seal)—**mechanism only, no career scenes**).
2. **## Structural Vulnerabilities (需注意)** — **No good/bad moralizing**—only structural weak points: missing cooling (low water) → impulsive calls; overload (clash + drain) → internal friction. Bound to \`ji_shen\` / missing elements / imbalance.
3. **## Balancing Anchors (解决方案)** — Neutral, **non-scenario** tuning: rhythm, environmental psychology, decision habits (Wood/Water/Metal tuning mechanisms). Bound to \`yong_shen\` / \`xi_shen\` + climate balance; may include direction · color · objects · facing · avoid (no superstition promises).
4. **## High-Leverage Trajectory (全力以赴方向)** — When the system is in which state (favorable god active / pattern coherent) **breakthrough comes easiest**; describe **energy state**, not events or industries.

## Data display layers (instrument readout · no life plot)

5. **## Four-Pillar Configuration** — pillars, hidden stems, ten gods, stars (**only what structured has for that pillar**); instrument readout.**Per pillar: write if present, skip if absent**; ≤2 markers per pillar; **never pad** missing shen_sha.
6. **## Decade Energy Climate Overview** — chronological \`structured.da_yun\` **climate tendencies** (dry / moist / contracting / expanding); or directional sketch if missing. **Climate only—no life plot**; no bare Ganzhi (age phrases or ⟦t:decade|…⟧).`;

const BASE_ANALYSIS_NEUTRALITY_RULES_ZH = `# 中立元报告 · 硬禁（场景化留给下游 POJU/Glyph/Match/Syncro）

这份报告是**共用中立上下文底座**（像体检报告 / MBTI 原始读数 / 仪器说明书）：**客观、无场景、无定性职业、无人生故事**。

## 禁止任何现实情节与定性
- **禁**职业/行业/经营状态/雇佣/婚育/资产/具体人际关系断言。
- **禁例:** 「你适合开咖啡馆」「hire a part-time helper」「running a food stall」「该换工作了」「适合结婚」。
- **正例:** 「你的核心能量是高频输出，执行锋芒极强，但长期蓄水能力弱——需要强**规则网格（金）**约束能量蒸发。」
- **禁**未来事件预测（新合伙/扩张/机会到来/某年会…）— 只给**能量倾向**。
- **禁**医疗与脏腑点名：健康相关改为中立的「系统过载 / 内耗 / 节律失衡」能量描述 + 作息环境类调节；**不点名器官、不给饮食医嘱**。
- 职业/关系若**必须**提及，只能作为「能量投射的中立举例」，并显式标注「**举例，非定性**」— **但优先完全不提**，把投射留给下游。

## 比喻边界
- 比喻**可以**用，但**只服务于解释能量机制**（如「缺冷却模块」「规则网格」），**不编造现实情节**（工作室、摊位、合伙人、家庭剧情等）。`;

const BASE_ANALYSIS_NEUTRALITY_RULES_EN = `# Neutral meta-report · hard bans (scenarios belong to downstream POJU/Glyph/Match/Syncro)

This is a **shared neutral context base** (like a lab report / raw MBTI readout / instrument manual): **objective, scene-free, no career typing, no life story**.

## No real-world plot or typing
- **Ban** career/industry/business status/hiring/marriage/parenting/assets/specific relationship assertions.
- **Bad:** "You should run a café," "hire a part-time helper," "running a food stall," "time to switch jobs," "ready for marriage."
- **Good:** "Your core energy is high-frequency output with strong execution edge, but long-term reservoir capacity is weak—you need a strong **rule grid (Metal)** to limit evaporation."
- **Ban** future-event predictions (new partner, expansion, opportunity arriving, "in 2027…")—**energy tendency only**.
- **Ban** medical/organ naming: health = neutral "system overload / internal friction / rhythm drift" + rhythm/environment tuning—**no organs, no diet prescriptions**.
- Career/relationship mentions, if unavoidable, must be labeled "**example only—not a typing**"—**prefer omitting entirely**; downstream handles projection.

## Metaphor boundary
- Metaphors **yes** for **energy mechanisms** ("missing cooling module," "rule grid")—**no** real-life plot (studio, stall, co-founder drama, family storyline).`;

const BASE_ANALYSIS_BINDING_RULES = `# 绑定计算结果 · 闭集 · 禁幻觉

1. **用神/喜神/忌神/强弱/格局** — 以 structured 为准；只能展开解释，**不得改判或另算**；喜忌方向不得与 structured 相反。
2. **神煞闭集 · 实例清单** — 神煞**只能逐字取自**本次 \`buildStructuredInstanceInventory\` 列出的项（引擎闭集 9 选 N：天乙贵人/禄神/飞刃/文昌/桃花/驿马/华盖/孤辰/寡宿）。**该清单为空则整篇不得出现任何神煞名**。**严禁**引擎不计算项，显式禁止：**元辰 / 六秀日 / 阴差阳错 / 阴阳差错 / 空亡 / 将星 / 劫煞 / 国印贵人 / 月德合 / 天德合 / 太极贵人 / 福星贵人 / 十恶大败 / 学堂** 等。
3. **十神/长生** — 同理，只用 structured 给出的具体条目；禁止类别统称代替或编造。
4. **data_availability.missing** — pillars_detail 或 da_yun 缺失时，该维度**只做方向性描述**，禁止编造具体干支/神煞/起运岁数。
5. **术语标记 · 三段位闭合 · 干支禁裸** — 凡命理术语一律 \`⟦t:<id>|<可见软译词>|<该处白话>⟧\` **三段位必须完整闭合**；**禁止**只写可见词不打标记、**禁止**句子在标记处中断截断。**正文任何干支组合**一律不得裸露——要么三段位标记，要么概览段完全不用干支（白话年龄段）。**禁止** \`(癸酉 phase)\`、\`during 壬申\` 半裸写法。
6. **可见词形态** — \`<可见文本>\` 用**名词短语**，**禁止**前导冠词 \`the/a/an\`（避免 "The the refined core"）；英文如 \`refined core (癸)\` 而非 \`the refined core (癸)\`。
7. **藏干/十神禁罗列** — **禁止** \`Hidden stems (Wu earth, Xin metal…)\` 英文堆砌；藏干用**一句机制白话**，必要时最多 1 个 ⟦t:…⟧。
8. **标记排版** — 标记**紧贴**软译词，**禁止**在标记前插入裸换行。
9. **金色词密度** — **每段最多 1–2 个** ⟦t:…⟧；**## 四柱命盘数据 逐柱段**尤其收敛——**每柱最多 1–2 个**核心标记，其余藏干/十神用白话带过，**禁止**逐条全标。
10. **四柱逐柱段（复发源）** — 逐柱**只描述 structured 里该柱实际有的** \`ten_god / shen_sha / life_stage / hidden_stems\`；**缺则不写**，**禁止**为填满四柱而补神煞或编造配置。
11. **禁止假设**「输出端会软翻译」——你必须在生成时直接写好标记与软译词。`;

const BASE_ANALYSIS_LAYOUT_ZH = `# 降维排版（中立元报告 · 奢侈品交付 · 必遵）

读感应像 **中立精密读数 + 人话注解**（不是人生故事）。排版像 **Apple 官网 / 顶级杂志**：**精炼、克制、留白**。

## 每个 ## 分区内部结构
1. **### 小标题** — 长分区拆成 **2–4 个** \`###\` 子块。
2. **Lead 引导块** — 每个论点以 \`**粗体引导句:** 正文\` 开启；引导句 3–8 字/词。
3. **短段** — 每段 **≤120 字**（英文 ≤80 词），**一个论点一段**，段间空一行。
4. **金句框 / 锚点** — **四维各至少 1 个** \`> **核心锚点:** …\` 或 \`> **调谐要点:** …\`；数据层各至少 1 个可记住的读数摘要。
5. **列表** — 平衡锚、调谐机制、配置要点用 \`- \` bullet。

## 篇幅与完整性
- 全文 **1100–1600 词**（中文同等篇幅）；**四维 + 两层数据展示必须齐全**——宁可略超，**不可**为压字数砍掉任何块。
- 压缩对象是**水分**（铺垫、安慰性排比、同义重复、场景化举例），不是能量诊断点。

## 分区硬约束
- **四维能量动力学四块一个都不能少**；数据展示层（四柱 / 大运气候）**必须保留**。
- 每个 ## 分区至少 **1 个** \`**粗体引导句:**\`；**能量平衡锚** 至少 **1 个** \`>\` 金句框 **或** \`- \` bullets。`;

const BASE_ANALYSIS_LAYOUT_EN = `# Layout (neutral meta-report · luxury tier · mandatory)

Read like **precise neutral readout + plain-language notes**—not a life story. Layout like **Apple.com / a top magazine**: concise, restrained, breathing room.

## Inside each ## section
1. **### subheads** — Split into **2–4** \`###\` blocks.
2. **Lead blocks** — \`**Bold lead:** body\`; label 3–8 words.
3. **Short paragraphs** — **≤80 words** each (Chinese ≤120 chars), one idea per paragraph.
4. **Pull quote / anchor** — **Each of the four dimensions** needs at least one \`> **Core anchor:** …\` or \`> **Tuning note:** …\`; data layers need a memorable readout line.
5. **Bullets** — balancing anchors, tuning mechanisms, config points use \`- \` bullets.

## Length & completeness
- **1100–1600 words** total; **all four dimensions + both data layers required**—slightly over is OK; never drop a block to hit a cap.
- Cut **fluff** (padding, reassurance loops, scenario examples)—not energy diagnostics.

## Section hard rules
- **All four energy dimensions mandatory**; data layers (pillars / decade climate) **must remain**.
- Every ## section: at least one \`**Bold lead:**\`; **Balancing Anchors** needs at least one \`>\` pull quote **or** \`- \` bullets.`;

const BASE_ANALYSIS_FEW_SHOT_ZH = `# 分区范例（复制结构 · 勿抄意象 · 禁场景）

\`\`\`markdown
## 核心底色（Core Engine Baseline · 强项）

### 驱动类型

**原始驱动:** 高频输出型 ⟦t:day_master|核心特质（丙火）|像持续燃烧的引擎，短程爆发与可见度极强⟧；structured.strength 只展开，不重判。

**价值机制:** 食神生财链路在你这套配置里，意味着「产出 → 资源回流」的闭环效率偏高——绑定 structured 十神组合，只谈机制。

> **核心锚点:** 把能量用在可验证的产出闭环上，比散点尝试更省内耗。

## 系统脆弱点（Structural Vulnerabilities · 需注意）

### 冷却不足

**结构短板:** 水元素冷却模块偏弱（structured 忌神/缺失方向）→ 决策窗口缩短，易在信息未齐时提前锁定。

> **调谐提示:** 这不是「性格缺陷」，是配置上的散热缺口——需要外部节律补位。

## 能量平衡锚（Balancing Anchors · 解决方案）

**调谐机制:** 对你有效的 ⟦t:yong_shen|用神（水）|规则网格 + 固定复盘时段，给高频输出加缓冲⟧。

- 作息：固定「冷却窗口」，重大决定不进该窗口
- 环境：偏润、低噪、可分段专注的空间
- 方位/颜色：按 structured 调候方向中性列出（禁招财承诺）

## 高杠杆发力区（High-Leverage Trajectory · 全力以赴方向）

**突破状态:** 当用神得力、官印相生链路通畅时，系统最易进入「高信噪比产出」状态——不指定行业，只描述能量条件。

## 四柱命盘数据

### 配置读数

（仅 structured 有的柱位 / 十神 / 神煞；机制角色，禁故事）

## 大运能量气候概览

### 气候时序

**二十出头:** 金气渐起，系统进入收敛校准期（**禁裸** 癸酉/壬申；用年龄段）。

**三十前后:** 燥润交替，宜强化冷却锚点，避免连续高压输出。（只讲气候，不讲换赛道/升职等剧情）
\`\`\``;

const BASE_ANALYSIS_FEW_SHOT_EN = `# Section example (copy structure · no scenarios)

\`\`\`markdown
## Core Engine Baseline (强项)

### Drive type

**Raw drive:** High-frequency output type ⟦t:day_master|core nature (丙火)|Like a steady engine—short-range bursts and visibility are strong⟧; explain structured.strength only.

**Value mechanism:** Output-to-wealth linkage in your config means a tighter "produce → resource return" loop—ten-god mechanism only, no industry.

> **Core anchor:** Channel energy into verifiable output loops—not scattered trials.

## Structural Vulnerabilities (需注意)

### Cooling gap

**Structural gap:** Weak water cooling module (structured challenging direction) → shorter decision windows, premature lock-in before data is complete.

> **Tuning note:** Not a character flaw—a heat-dissipation gap in the config.

## Balancing Anchors (解决方案)

**Tuning mechanism:** What works for you ⟦t:yong_shen|favorable element (水)|rule grid + fixed review windows to buffer high-frequency output⟧.

- Rhythm: fixed "cool-down windows"; no major calls inside them
- Environment: moist, low-noise, segmentable focus space
- Direction/color: neutral list from structured climate balance (no wealth promises)

## High-Leverage Trajectory (全力以赴方向)

**Breakthrough state:** When the favorable god is active and officer-seal linkage is clear, the system enters high signal-to-noise output easiest—energy conditions only, no industry.

## Four-Pillar Configuration

### Readout

(pillars / ten gods / stars from structured only—roles, no plot)

## Decade Energy Climate Overview

### Climate timeline

**Early twenties:** Metal tone rises—system enters calibration/contraction phase (**no bare** 癸酉/壬申; age phrases only).

**Mid-thirties:** Dry-moist alternation—reinforce cooling anchors; avoid chained high-pressure output. (climate only—no promotion/job-change plot)
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

基于以下 **structured JSON（本地排盘引擎真算结果）**，生成一份 **中立能量元报告 / 数字孪生底座**（Markdown 正文 only）。

这是 POJU / Glyph / Match / Syncro **共用的上下文底座**，经 \`formatBaseAnalysisForPrompt\` 注入下游；下游负责场景投射。**本报告像体检报告 / MBTI 原始读数 / 仪器说明书**——客观配置读数 + 人话注解，**不是**人生故事、职业定性或算命。`
      : `# Your task

From the **structured JSON (locally computed chart engine)** below, write a **neutral energy meta-report / digital-twin base** (Markdown body only).

Shared context base for **POJU / Glyph / Match / Syncro**—injected downstream via \`formatBaseAnalysisForPrompt\`; downstream handles scenario projection. Read like a **lab report / raw MBTI readout / instrument manual**—objective config + plain notes, **not** life story, career typing, or fortune-telling.`;

  const outputBlock =
    lang === "zh"
      ? `# 输出要求

1. **只输出** Markdown 正文（## 分区 + ### 小标题 + lead + 金句框 + bullets），不要 JSON，不要 \`---META---\`，不要代码块包裹全文。
2. 语言: **${langLabel}** — 全文使用这一种语言。
3. **四维 + 数据展示层必须齐全**（标题措辞可调，内涵固定）：
${BASE_ANALYSIS_OUTPUT_SECTIONS_ZH.split("\n").slice(1).join("\n")}
4. **1100–1600 词**（中文同等篇幅）— **优先保证四维与数据层完整**；宁可略超，**不可**为压字数砍掉任何块。
5. **压缩水分，不砍信息** — 删解释性铺垫、安慰性排比、同义重复、场景化举例；保留每个维度的关键能量结论与一条可操作的**中立调谐**建议（作息/环境/决策习惯，非职业/关系）。
6. 第二人称（你），现代、专业、克制；**每段 ≤120 字**；**四维各至少 1 个** \`**粗体引导句:**\` **+ 1 个** \`>\` 金句/锚点；**能量平衡锚** 另需 \`- \` bullets 亦可。
7. 挑战类**不得渲染成「灾祸/损失」恐吓**；**禁裸干支**；神煞/十神**只能来自 structured 实例清单**；**每个 ⟦t:…⟧ 三段位必须闭合**；可见词禁前导 the/a/an；逐柱段每柱 ≤2 金字。
8. **落库门禁** — 集外神煞（元辰/六秀日/阴差阳错等）、断标记、裸干支、密度超标会导致整篇被拒并重写；可自然提及 POJU / pojulife；禁 astrology / divination / psychic / horoscope。`
      : `# Output requirements

1. **Markdown body only** (## sections + ### subheads + lead + pull quotes + bullets)—no JSON, no \`---META---\`, no fenced full-document code block.
2. Language: **${langLabel}** throughout.
3. **All four dimensions + data display layers required** (wording may vary; semantics fixed):
${BASE_ANALYSIS_OUTPUT_SECTIONS_EN.split("\n").slice(1).join("\n")}
4. **1100–1600 words** (equivalent length in Chinese)—**four dimensions + data layers complete first**; slightly over is OK; never drop a block for word cap.
5. **Cut fluff, not facts** — drop padding, reassurance loops, scenario examples; keep each dimension's key energy read + one **neutral tuning** takeaway (rhythm/environment/decision habits—not career/relationship).
6. Second person (you); modern, restrained, professional; **≤80 words per paragraph**; **each of the four dimensions** needs at least one \`**Bold lead:**\` **+ one** \`>\` anchor; **Balancing Anchors** may also use \`- \` bullets.
7. Do not frame challenges as doom/scare; **no bare Ganzhi**; shen_sha/ten_gods **only from structured instance inventory**; **every ⟦t:…⟧ must be fully closed** (3 parts); visible text without leading the/a/an; ≤2 markers per pillar block.
8. **Delivery gate** — out-of-set shen_sha (元辰/六秀日/阴差阳错 etc.), broken markers, bare Ganzhi, or density overflow will reject the draft and force rewrite; POJU / pojulife OK; no astrology / divination / psychic / horoscope.`;

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
      ? `structured JSON（内部数据 — 据此写中立能量元报告；守实例闭集、术语标记、中立硬禁）:

\`\`\`json
${JSON.stringify(input.local_data.structured, null, 2)}
\`\`\`

现在开始写完整 Markdown 元报告。**降维排版**（### + **引导:** + 短段 + > 锚点 + bullets）；**1100–1600 词、四维+数据层齐全**；只读配置、不编故事；术语三段位；**禁裸干支**；神煞/十神不得超出 structured；避免语义红线词（${redLine}）。`
      : `structured JSON (internal — write neutral energy meta-report; honor closed-set, term markers, neutral hard bans):

\`\`\`json
${JSON.stringify(input.local_data.structured, null, 2)}
\`\`\`

Write the full Markdown meta-report now. **Magazine layout** (### + **Lead:** + short ¶ + > anchor + bullets); **1100–1600 words, four dimensions + data layers complete**; config readout only—no life plot; 3-part term markers; **no bare Ganzhi**; shen_sha/ten_gods within structured; avoid red-line words (${redLine}).`;

  return { system, user };
}
