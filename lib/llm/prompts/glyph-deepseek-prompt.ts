import {
  GLYPH_EXPLORATION_GUIDANCE,
  GLYPH_GUANYIN_100_LOTS_IDENTITY,
  GLYPH_GUANYIN_INTERPRETATION_METHOD,
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

  const signBlock = `# 用户的问题
"${question.replace(/"/g, '\\"')}"

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

# ⭐ 必须正面回应用户的问题，且回应须有签象依据（最高优先级）

用户抽签时带着一个具体问题："${question.replace(/"/g, '\\"')}"。
你**必须**在 question_response 里先复述它，再正面回应——不许把它泛化成"放下执念"之类的空话。

## 回应必须取据于（内部推演 → 合规输出）
1. **签象第一依据**：抽到的签（${glyph.name}）的签文原文 + 五风类气势（${glyph.wind_category}）——这签对"这个问题"照出的核心意象是什么。
2. **命盘依据**：base_analysis 的人格架构 / 当前 life cycle / 认知资源偏好——此人面对这件事的天然倾向与盲点。
3. **《易经》依据**：时位 / 变化 / 阴阳之道——此刻在"进退之间"处于哪一爻位。
→ 三者交叉，给出对用户问题的**原型层面明确表态**：不是"会不会、何时"，而是"这面镜子照出你该看清的是什么、此刻的势在助你还是在拦你、下一步的方向感"。

## 合规接法（原型反思语域，不算命）
- ✓ 「就你问的『此事』，这支签照出的是【意象】——结合你性格里【特质】，此刻的势更利于【方向】而非【方向】」。
- ✓ 「签象与你当前的 life cycle 都指向：真正的关口不在『何时发生』，而在你是否先完成【内在动作】」。
- ✗ 禁：答具体「何时/几月」、断言未来事件、下吉凶、替用户决定。

## 底线
- question_response 至少引用 **签象依据 + 命盘依据** 各一处（已翻译为 Glyph 措辞，禁干支/签诗原文/sign/lot）。
- 必须正面、明确，不打太极；但保持"镜子/原型反思"而非"预言"。

# 输入质量

若用户问题明显为乱码/无意义/过短无主题：
- 设 \`"invalid_input": true\`
- **所有字符串字段仍须填写**，用中性引导文案（禁止留空字符串 ""）
- wind_category_blurb：礼貌说明问题暂无法精准对焦，邀请换一句更具体的事
- 命理双视角三字段：各写 2–4 句中性说明（可泛述五风类气势 + 内观方向，不硬断）
- meaning_for_question / hidden_tension / your_moment / reflection_question：给出通用反思引导（聚焦、暂停、写下真正想问的一句）
- exploration.text：仍须具体 Solo 微练习，但形态从 GLYPH_EXPLORATION_GUIDANCE 中选，禁止默认静坐+书写套路
- classical_voice：用抽象叙事原型描述意象，**禁止**引用输入原文诗句或历史人物名

# 输出格式（严格 JSON，无 markdown 围栏）
⚠️ 生成前执行「三道自检」+ OUTPUT FRAMING 白榜：所有字符串字段零禁词、零术语、零预测。`;

  const outputSchema = `

{
  "wind_category_blurb": "40-70 字。介绍这个风类的整体氛围（白榜用语，禁止吉/凶/auspicious/ominous）",
  "classical_voice": "120-200 字。开篇可一次点出 archetypal metaphor，其后用 Glyph/Glyph 文；抽象意象（A 意象化：不逐字引原文）；自然融入《易经》/ I Ching",
  "question_response": "140-220 字。开头复述用户问题；依据『签象 + 命盘』正面给出原型层面的明确回应（照出什么 / 当前势的方向感 / 下一步着力点）；禁答何时、禁预测、禁吉凶；用 Glyph 措辞",
  "命理双视角": {
    "命理看此事": "280-500 字。从行为蓝图 / 人格架构看此事；须体现 structured 三项；禁日主/大运/用神/干支；用 Glyph 指代，禁签/sign/lot",
    "签文看此事": "280-500 字。从 Glyph 文解读：抽象情境主题 + 经典东方叙事原型（A 意象化，禁逐字原文/人名）；全文用 Glyph/Glyph 文，禁 sign/lot",
    "两者印证或冲突": "140-260 字。印证还是冲突（白榜用语，禁未来预测；用 Glyph 指代）"
  },
  "meaning_for_question": "280-450 字。深度解读 = Glyph × 性格画像 × 用户具体问题（禁答「何时」，禁断言未来；用 Glyph 非 sign）",
  "hidden_tension": "100-160 字。用户可能看不到的张力或盲点（当下视角）",
  "your_moment": "120-180 字。当前年度周期内的当下能量 + 与原型隐喻的互动（禁写流年/预测即将发生）",
  "exploration": {
    "text": "100-160 字。Solo 微练习（见 exploration 专节）：何时+场景+动作链+尽量有产出物；形态多样，禁止默认「安静坐下闭眼+纸上书写」",
    "timeframe": "today | tonight | within_24h | this_week",
    "duration_estimate": "X minutes",
    "is_solo": true
  },
  "reflection_question": "60-90 字。一个深思的问题（邀请，不是命令）",
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
2. **使用语言**: ${outputLang}（跟随用户实际输入语言；输出禁干支/十神/命理术语）
3. **OUTPUT FRAMING + 三道防线 + 《易经》框架**: 术语翻译 + 叙事抽象 + 预测规避 + I Ching 哲学透镜（非占卜）；允许原型隐喻/行为蓝图/系统性情境模式
4. **人格依据**: 「命理看此事」须体现人格架构 + 10年生命周期 + 认知资源偏好（防线1翻译，禁写日主/大运/用神）
5. **隐喻依据**: 抽象情境主题 + 经典东方叙事原型；禁止签诗原文/历史人物/签字样
6. **结构必备**: 命理双视角 + 原型隐喻意象 + exploration 微练习 三者缺一不可；exploration 须遵守 GLYPH_EXPLORATION_GUIDANCE（多样形态，忌模板化静坐书写）
7. **总字数**: 中文约 2200-4000 字 / 英文约 1800-3200 词（各字符串字段合计；宁详略短，但不得违反各字段上限）
8. **question_response**：必须正面回应用户问题，至少引用签象依据 + 命盘依据各一处；明确不打太极，但保持原型反思、不预测。
9. **严格 JSON**: 不要用 \`\`\`json 包裹

# 不要做的事

- 不预测具体未来（几月几号会发生 / 何时再婚 / 即将遇到）
- 不下命运定论
- 不替用户做决定
- 不把 Glyph 写成 POJU 破局顾问或三条行动方案
- 不编造原文没有的意象或等级名
- 不在任何输出字符串写禁词 / 干支 / 签诗原文 / 历史人物名

${GLYPH_OUTPUT_SELF_CHECK}`;

  const system = stitchPromptSections(
    GLYPH_GUANYIN_100_LOTS_IDENTITY,
    GLYPH_GUANYIN_INTERPRETATION_METHOD,
    GLYPH_EXPLORATION_GUIDANCE,
    GLYPH_OUTPUT_FRAMING,
    GLYPH_OUTPUT_DEFENSE_TERMS,
    GLYPH_OUTPUT_DEFENSE_NARRATIVE,
    GLYPH_OUTPUT_ICHING_FRAMEWORK,
    GLYPH_OUTPUT_WORDING,
    GLYPH_OUTPUT_DEFENSE_PREDICTION,
    GLYPH_OUTPUT_BRANDING,
    GLYPH_LANGUAGE_RULES,
    ORIENTAL_SHARED_GUARDRAILS,
    buildCurrentDateContext(new Date(), locale),
    buildProfileContextSection(profile, base_analysis),
    buildLanguageGuidance(locale, question),
    buildNorthAmericaAdaptation(locale),
    `# 当前任务：本次 Glyph 解读

用户触发了一个原型隐喻（内部对应观音百签 #${glyph.id}）。你要结合【命主 base_analysis structured + display_text】+【完整签文原文（仅内部分析用）】+【用户问题】，按上文解签法则做一次【深度双视角解读】。
输出 JSON 字符串必须 100% 遵守 OUTPUT FRAMING + 三道防线 + 《易经》框架 + Glyph 措辞统一（禁签/sign/lot）。`,
    signBlock,
    outputSchema,
  );

  const user = `请按解签法则生成解读 JSON。

⛔ 输出合规（最高优先级）: OUTPUT FRAMING + 三道防线 + 《易经》框架 + Glyph 措辞
  · 指代: 统一 Glyph / Glyph 文 / the Glyph text；禁签/sign/lot；archetypal metaphor 仅开篇一次
  · 防线1: 禁干支/十神/日主/大运/用神 → 心理学/系统动力学翻译
  · 防线2: A 意象化（不逐字引原文）/ 禁历史人物 / 禁 sign/lot
  · 防线3: 禁 will meet / going to + 未来事件 → present readiness / 现在时
  · 《易经》: 自然融入 I Ching 变化之道/时位/阴阳（非起卦占卜）
✓ 语言: 跟随用户实际输入（${outputLang}）。
✓ 内容: 命理看此事须体现人格架构+10年周期+认知偏好（翻译表述）；隐喻解读用抽象原型；不得抄写 modern_translation。
✓ 写每段前执行三道自检。invalid_input 时所有字段仍填中性引导，禁止空字符串。
✓ exploration：按 GLYPH_EXPLORATION_GUIDANCE 选 **一种** 练习形态，勿次次「安静地方+闭眼+纸上写」。`;

  return { system, user };
}
