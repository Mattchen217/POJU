import {
  GLYPH_EXPLORATION_GUIDANCE,
  GLYPH_GUANYIN_100_LOTS_IDENTITY,
  GLYPH_GUANYIN_INTERPRETATION_METHOD,
  GLYPH_LAYOUT_CONTRACT,
  GLYPH_OUTPUT_BRANDING,
  GLYPH_OUTPUT_FRAMING,
  GLYPH_OUTPUT_DEFENSE_TERMS,
  GLYPH_OUTPUT_DEFENSE_NARRATIVE,
  GLYPH_OUTPUT_ICHING_FRAMEWORK,
  GLYPH_OUTPUT_WORDING,
  GLYPH_OUTPUT_DEFENSE_PREDICTION,
  GLYPH_OUTPUT_SELF_CHECK,
  GLYPH_LANGUAGE_RULES,
  ORIENTAL_SHARED_GUARDRAILS,
} from "@/lib/llm/prompts/glyph-guanyin-base";
import {
  buildCurrentDateContext,
  buildLanguageGuidance,
  buildNorthAmericaAdaptation,
  buildProfileContextSection,
  detectLanguage,
  stitchPromptSections,
} from "@/lib/llm/prompts/oriental-counselor-base";
import { buildDualLayerDeliveryPromptBlock } from "@/lib/llm/prompts/dual-layer-delivery";
import { buildTermMarkingPromptBlock } from "@/lib/llm/sanitize/compliance-terms";
import { normalizeBaseAnalysisInput } from "@/lib/llm/prompts/base-analysis-context";
import { stitchSingleProfileRelationClosedSet } from "@/lib/llm/prompts/relation-closed-set-context";
import {
  buildPlainspeakVoiceSections,
  PLAINSPEAK_STYLE_EXAMPLE_GLYPH,
} from "@/lib/llm/prompts/plainspeak-voice";
import { READING_LAYOUT_CONTRACT } from "@/lib/llm/prompts/reading-layout";
import { buildDeliveryGrammarPolishBlock } from "@/lib/llm/prompts/delivery-grammar-polish";
import type { UserProfile } from "@/lib/profile/types";

export type GlyphPromptSign = {
  id: number;
  name: string;
  wind_category: string;
  classical_text: string;
  modern_translation: string;
  key_themes: string[];
};

export type BuildGlyphReadingPromptInput = {
  profile: UserProfile | null;
  base_analysis: unknown;
  question: string;
  glyph: GlyphPromptSign;
  locale: string;
};

function windCategoryToneBlock(windCategory: string): string {
  const lower = windCategory.toLowerCase();
  if (lower.includes("divine") || lower.includes("tailwind")) {
    return "语调：庆祝感，几乎敬畏；这是顺风、对齐的信号。";
  }
  if (lower.includes("fair") || lower.includes("sky")) {
    return "语调：平静鼓励，路已开，但仍需用户迈出一步。";
  }
  if (lower.includes("still") || lower.includes("water")) {
    return "语调：沉静、不急；在暂停里成形，不催促。";
  }
  if (lower.includes("cross")) {
    return "语调：诚实正视横风；力量在交叉，不在硬推。";
  }
  if (lower.includes("storm") || lower.includes("eye")) {
    return "语调：出人意料的深度；外乱内静，回到中心。";
  }
  return "语调：尊重原型隐喻与用户性格画像，双视角整合。";
}

export function buildGlyphReadingPrompt(input: BuildGlyphReadingPromptInput): {
  system: string;
  user: string;
} {
  const { profile, base_analysis, question, glyph, locale } = input;
  const outputLang = detectLanguage(question, locale);

  const structured = normalizeBaseAnalysisInput(base_analysis).structured ?? null;
  const relationClosedSetBlock = structured
    ? stitchSingleProfileRelationClosedSet(structured, { questionText: question })
    : "";

  const dateContext = buildCurrentDateContext(new Date(), locale);
  const questionEscaped = question.replace(/"/g, '\\"');

  const signBlock = `# 用户的问题
"${questionEscaped}"

# 抽到的签（观音百签 · 完整数据）

签号: ${glyph.id}
签名/典故: ${glyph.name}
五风类（现代气势标签）: ${glyph.wind_category}
关键主题: ${glyph.key_themes.join("、")}

## 签文英文摘要（⚠️ 仅模型内部理解 — 禁止抄写入 JSON 输出）
${glyph.modern_translation}

⚠️ 上述英文摘要仅供你理解签意；**不得**将其文字抄写或轻改后写入任何 JSON 字段。用户可见解读必须来自下方「签文完整原文」+ 你的现代语言（见解签法则 §2.2、§2.3）。

## 签文完整原文（第一依据 — 解签必须引用 §2.2 三种方式中的至少两种）
─────────────────────────────────────────
${glyph.classical_text}
─────────────────────────────────────────

${windCategoryToneBlock(glyph.wind_category)}

# ⭐ 必须正面回应用户的问题（最高优先级）

用户抽签时带着一个具体问题："${questionEscaped}"。
你**必须**在 question_response 里先复述它，再给出精炼直答——不许把它泛化成"放下执念"之类的空话。
其余板块（含 synthesis）**不得再复述问题**，见 GLYPH_LAYOUT_CONTRACT。

## 回应必须取据于（内部推演 → 合规输出）
1. **签象第一依据**：抽到的签（${glyph.name}）的签文原文 + 五风类气势（${glyph.wind_category}）
2. **命盘依据**：base_analysis 的人格架构 / 当前大运 / 用神 — 输出须 ⟦t:id|软译词 (干支)⟧ 标记
3. **《易经》依据**：时位 / 变化 / 阴阳之道
→ 给出对用户问题的**原型层面明确表态**：不是"会不会、何时"，而是"这面镜子照出你该看清的是什么、此刻的势在助你还是在拦你、下一步的方向感"。

## 合规接法（原型反思语域，不算命）
- ✓ 「就你问的『此事』，这支 Glyph 照出的是【意象】——结合你的 ⟦t:day_master|core nature (乙木)⟧（或中文版 ⟦t:day_master|本元（乙木）⟧），此刻的势更利于【方向】而非【方向】」。
- ✓ 「Glyph 象与你当前的 ⟦t:decade|life phase (癸酉)⟧ 都指向：真正的关口不在『何时发生』，而在你是否先完成【内在动作】」。
- ✓ （应对所有「时间/确定性」问题的通用公式）：如果用户问「什么时候/能不能/结果如何」，**必须正面回应其对确定性的焦虑，但须将“绝对时空点”转化为“能量天气的周期节律”**。
  - 通用直答框架：
    1. 【锚定当下】：根据 base_analysis 中当前的流年/大运对该问题（如财运/事业/感情）的实际作用，明确定义当下的阶段属性（如：阻力期、清理期、蓄能期、或盲目扩张期）。
    2. 【指向未来窗口】：通过命盘推演，明确指出**下一个对该诉求最有利的能量反转或回补的节律节点**（例如：随后的某五行交替年、大运交接处、或干支气机回暖期）。
    3. 【绑定行动条】：告诉用户，在下一个机会窗口到来前，当下需要完成的“内在动作/准备工作”是什么。
  - 这种逻辑适用于感情（情感回暖窗）、事业（能量爆发期）、财运（财富筑巢期）等所有主题。
- ✗ 禁：答具体「何时/几月」、断言未来事件、下吉凶、替用户决定；禁裸写 Day Master/Yi Wood/energy blueprint（须术语表+标记）。

# 输入质量

若用户问题明显为乱码/无意义/过短无主题： 
- 设 \`"invalid_input": true\`
- **所有字符串字段仍须填写**，用中性引导文案（禁止留空字符串 ""）
- wind_category_blurb：礼貌说明问题暂无法精准对焦，邀请换一句更具体的事
- 命理双视角三字段：各写 2–4 句中性说明（可泛述五风类气势 + 内观方向，不硬断）
- synthesis / hidden_tension / your_moment / reflection_question：给出通用反思引导（聚焦、暂停、写下真正想问的一句）
- exploration.text：仍须具体 Solo 微练习，但形态从 GLYPH_EXPLORATION_GUIDANCE 中选，禁止默认静坐+书写套路
- classical_voice：用抽象叙事原型描述意象，**禁止**引用输入原文诗句或历史人物名；**100% 使用交付语言**（英文交付禁整句中文，除 ⟦t:…⟧ 内干支锚点）；禁写中文定位句如「你触发的这个原型隐喻…」

# 输出格式（严格 JSON，无 markdown 围栏）
⚠️ 生成前执行 GLYPH_OUTPUT_SELF_CHECK + OUTPUT FRAMING 白榜：所有字符串字段守六条红线、零禁词、零预测。`;

  const outputSchema = `

${GLYPH_LAYOUT_CONTRACT}

{
  "question_response": "120-200 字【答案先行·唯一复述处】。第一句复述用户问题，随后 2-4 句给出镜子照出的方向。命盘依据须含 ⟦t:day_master|…⟧ 或 ⟦t:decade|…⟧ 标记（keep_cn 含中文干支）。例（EN）：your ⟦t:day_master|core nature (乙木)⟧ …",
  "wind_category_blurb": "60-110 字。这个风类的整体氛围（不提问题；六条红线；命理词须标记）",
  "classical_voice": "220-360 字。签的意象与《易经》时位（不提问题；archetypal metaphor 开篇一次；用 Glyph 指代；**意象化转述签诗，禁逐字引原文**；**全文交付语言，英文禁整句中文**）",
  "命理双视角": {
    "命理看此事": "480-820 字（中文）/ 480-820 词（英文）【依据·命盘，不复述问题】。须逐项展开 ⟦t:day_master|…⟧、⟦t:decade|…⟧、⟦t:year|…⟧、⟦t:yong_shen|…⟧（禁止裸写 Day Master/大运/用神/Yi Wood）。例：your ⟦t:day_master|core nature (乙木)⟧ … current ⟦t:decade|life phase (癸酉)⟧ …",
    "签文看此事": "480-820 字（中文）/ 480-820 词（英文）【依据·签象，不复述问题】。Glyph 文原型意象**意象化转述**（禁逐字签诗原文；禁 sign/lot）",
    "两者印证或冲突": "240-420 字。两面镜子如何印证或形成张力（不复述问题；六条红线；术语须标记）"
  },
  "synthesis": "460-760 字【深度整合·严禁复述问题、严禁重复 question_response】。把命盘×签象×问题拧成一个更深的洞见；命理词须 ⟦t:id|…⟧ 标记。",
  "hidden_tension": "160-280 字。盲点或暗流（当下视角；术语须标记）",
  "your_moment": "180-320 字。当前 ⟦t:year|year's energy (… )⟧ 或 ⟦t:decade|life phase (… )⟧ 节律。**【特殊指令】若用户提出 '何时/能不能' 等时间或确定性关切，此处必须正面给出能量维度的‘时间天气预报’**：请对比分析【当前流年/大运的能量限制与沉淀意义】与【未来即将发生五行交替、运势转换的下一个关键趋势窗口】。用运势的‘蓄能期’与‘高概率释放窗口’来代替死板日期，给用户明确的阶段感与时间方向感（禁报绝对日期、禁断言事件必发生）。",
  "exploration": {
    "text": "120-200 字微练习（见 exploration 专节）：何时+场景+动作链+尽量有产出物；形态多样，禁止默认「安静坐下闭眼+纸上书写」",
    "timeframe": "today | tonight | within_24h | this_week",
    "duration_estimate": "X minutes",
    "is_solo": true
  },
  "reflection_question": "70-120 字反思问句（邀请非命令）",
  "invalid_input": false,
  "_meta": {
    "glyph_id": ${glyph.id},
    "glyph_name": "${glyph.name.replace(/"/g, '\\"')}",
    "wind_category": "${glyph.wind_category.replace(/"/g, '\\"')}",
    "output_language": "${outputLang}"
  }
}

# 严格要求

1. **全部字段填充**（JSON 不能缺字段；**禁止空字符串**；invalid_input 时也用中性引导填满）
2. **使用语言**: ${outputLang}（跟随用户实际输入语言）
3. **OUTPUT POLICY + 术语标记 + 叙事抽象 + 预测规避 + 《易经》框架**: 命理术语须术语表 soft 词 + ⟦t:id|…⟧ 标记（keep_cn 保留中文干支）；叙事意象化；预测规避；I Ching 哲学透镜（非占卜）
4. **人格依据**: 「命理看此事」须体现 ⟦t:day_master|…⟧、⟦t:decade|…⟧、⟦t:yong_shen|…⟧ 等标记化术语（禁裸写/Yi Wood/energy blueprint）
5. **隐喻依据**: 签文看此事 / classical_voice **意象化转述**签意；**禁逐字引签诗原文**；禁止展开历史人物故事情节
6. **结构必备**: 命理双视角 + 原型隐喻意象 + exploration 微练习 三者缺一不可；exploration 须遵守 GLYPH_EXPLORATION_GUIDANCE（多样形态，忌模板化静坐书写）
7. **总字数**: 中文约 3400-5400 字 / 英文约 2800-4600 词（各字符串字段合计；宁详不短，但不得违反各字段上限）
8. **question_response**：必须第一句就正面回应用户问题，不打太极、不假大空（若 invalid_input 为 true，则绝对优先按“输入质量”规范执行中性引导，不启动下方时间或性格判准）。
   【关键判准】：
   - 若用户核心诉求涉及 '何时/能不能/会不会/成不成' 等时间与确定性结果问题，第一句应定调为“时机并不在外部的死板日历上，而在你能量天气的转换节点与内在温度中”（请将其自动翻译为当前的交付语言 ${outputLang} 输出），随后明确指出当前的能量限制与即将到来的交替窗口趋势。
   - 若用户问的是性格、关系状态、或应对策略等非时间问题，则拒绝硬套时间话术，直接一针见血照出其核心现状、互动模式与潜在盲点。
   无论哪种情况，均须保持原型反思、禁止做出宿命论预测。
9. **板块零重复**：复述用户问题只在 question_response 出现一次；synthesis 必须深化、严禁复述问题或重复 question_response。命理术语须 ⟦t:id|…⟧ 标记；全篇守六条红线。
10. **严格 JSON**: 不要用 \`\`\`json 包裹

# 不要做的事

- 不预测具体未来（几月几号会发生 / 何时再婚 / 即将遇到）
- 不下命运定论
- 不替用户做决定
- 不把 Glyph 写成 POJU 破局顾问或三条行动方案
- 不编造原文没有的意象或等级名
- 不在任何输出字符串写禁词（签/sign/lot/观音/占卜等 OUTPUT FRAMING 白榜词）

${GLYPH_OUTPUT_SELF_CHECK}`;

  const system = stitchPromptSections(
    GLYPH_GUANYIN_100_LOTS_IDENTITY,
    GLYPH_GUANYIN_INTERPRETATION_METHOD,
    GLYPH_EXPLORATION_GUIDANCE,
    ...buildPlainspeakVoiceSections(PLAINSPEAK_STYLE_EXAMPLE_GLYPH),
    READING_LAYOUT_CONTRACT,
    GLYPH_OUTPUT_FRAMING,
    GLYPH_OUTPUT_DEFENSE_TERMS,
    buildDualLayerDeliveryPromptBlock(outputLang),
    buildTermMarkingPromptBlock(outputLang),
    GLYPH_OUTPUT_DEFENSE_NARRATIVE,
    GLYPH_OUTPUT_ICHING_FRAMEWORK,
    GLYPH_OUTPUT_WORDING,
    GLYPH_OUTPUT_DEFENSE_PREDICTION,
    GLYPH_OUTPUT_BRANDING,
    GLYPH_LANGUAGE_RULES,
    ORIENTAL_SHARED_GUARDRAILS,
    buildProfileContextSection(profile, base_analysis),
    relationClosedSetBlock,
    `# 当前任务：Glyph 深度解读

结合【能量底座 Layer1：structured + core_judgments】+【完整签文原文（仅内部分析用）】+【user 消息中的用户问题与签象数据】，按上文解签法则做一次【深度双视角解读】。
开口口径以 core_judgments.identity_anchor 为准；**禁止**改判 structured。
输出 JSON 字符串必须 100% 遵守 OUTPUT POLICY + GLYPH_LAYOUT_CONTRACT + Glyph 措辞统一（禁签/sign/lot）。`,
    buildDeliveryGrammarPolishBlock(outputLang),
  );

  const user = stitchPromptSections(
    dateContext,
    buildLanguageGuidance(locale, question),
    buildNorthAmericaAdaptation(locale),
    signBlock,
    outputSchema,
    `请按解签法则生成解读 JSON（签 #${glyph.id} · ${glyph.name}）。

⛔ 输出合规（最高优先级）: OUTPUT POLICY + 术语标记表 + GLYPH_LAYOUT_CONTRACT + Glyph 措辞
  · 指代: 统一 Glyph / Glyph 文 / the Glyph text；禁签/sign/lot；archetypal metaphor 仅开篇一次
  · 术语: **必须** ⟦t:id|软译 (干支)|该处白话⟧ 三段位标记 — 禁裸 Day Master/日主/大运/Yi Wood/energy blueprint
  · 正文: 大白话 + 比喻入句 + 先归因外境再给掌控（见 PLAINSPEAK）+ **降维排版**（小标题/短段/金句框，见 READING_LAYOUT）
  · 防线2: **意象化转述**签文；禁逐字签诗原文 / 禁历史人物故事情节
  · 防线3: 禁 will meet / going to + 未来事件 → present readiness / 现在时
  · 板块: question_response 唯一直答+复述；synthesis 深化、严禁复述问题或重复 question_response
  · 《易经》: 自然融入 I Ching 变化之道/时位/阴阳（非起卦占卜）
✓ 语言: 跟随用户实际输入（${outputLang}）。
✓ 内容: 命理看此事须引 structured 全量（日主/十神/格局/大运/用神/神煞 ≥3 不同 id）；不得抄写 modern_translation。
✓ 写每段前执行 GLYPH_OUTPUT_SELF_CHECK。invalid_input 时所有字段仍填中性引导，禁止空字符串。
✓ exploration：按 GLYPH_EXPLORATION_GUIDANCE 选 **一种** 练习形态，勿次次「安静地方+闭眼+纸上写」。`,
  );

  return { system, user };
}
