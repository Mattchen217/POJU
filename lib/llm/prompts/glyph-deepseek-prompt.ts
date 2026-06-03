import {
  GLYPH_GUANYIN_100_LOTS_IDENTITY,
  GLYPH_GUANYIN_INTERPRETATION_METHOD,
  GLYPH_OUTPUT_BRANDING,
  GLYPH_OUTPUT_FRAMING,
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

# 输入质量

若用户问题明显为乱码/无意义/过短无主题：
- 设 \`"invalid_input": true\`
- **所有字符串字段仍须填写**，用中性引导文案（禁止留空字符串 ""）
- wind_category_blurb：礼貌说明问题暂无法精准对焦，邀请换一句更具体的事
- 命理双视角三字段：各写 2–4 句中性说明（可泛述五风类气势 + 内观方向，不硬断）
- meaning_for_question / hidden_tension / your_moment / reflection_question / exploration.text：给出通用内观引导（聚焦、暂停、写下真正想问的一句）
- classical_voice：仍可引用输入原文意象（§2.2），但不假装读懂用户问题

# 输出格式（严格 JSON，无 markdown 围栏）
⚠️ 生成前再次核对 OUTPUT FRAMING 白榜：所有字符串字段零禁词。`;

  const outputSchema = `

{
  "wind_category_blurb": "30-50 字。介绍这个风类的整体氛围（白榜用语，禁止吉/凶/auspicious/ominous）",
  "classical_voice": "50-80 字。用 Glyph 口吻点出原型隐喻核心与典故（§2.2：诗句/意象/典故至少一种；禁止 OUTPUT FRAMING 所列全部禁词；用「原型隐喻」「系统性情境模式」）",
  "命理双视角": {
    "命理看此事": "200-400 字。从性格结构/行为蓝图看此事；**必须显式写出** base_analysis structured 中的：①日主天干及五行 ②当前大运 ③用神（缺失则说明仅据四柱推论）；输出禁写「命理/算命/占卜」等禁词",
    "签文看此事": "200-400 字。从 Glyph 原型隐喻解读：§2.2 三种引用方式至少用两种；禁止 modern_translation 英文摘要抄入；禁止 OUTPUT FRAMING 全部禁词，只用五风类描述气势",
    "两者印证或冲突": "100-200 字。印证还是冲突，对用户意味着什么（白榜用语）"
  },
  "meaning_for_question": "180-280 字。深度解读 = 原型隐喻 × 性格画像 × 用户具体问题",
  "hidden_tension": "60-100 字。用户可能看不到的张力或盲点",
  "your_moment": "80-120 字。当前时间能量（基于上面真实流年）+ 与原型隐喻的互动",
  "exploration": {
    "text": "60-90 字。一个具体的内观练习。Solo。具体到时间/场地/做什么",
    "timeframe": "today | tonight | within_24h | this_week",
    "duration_estimate": "X minutes",
    "is_solo": true
  },
  "reflection_question": "40-60 字。一个深思的问题（邀请，不是命令）",
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
2. **使用语言**: ${outputLang}（跟随用户实际输入语言；所有字符串字段用此语言，干支术语可保留）
3. **OUTPUT FRAMING**: JSON 所有字符串字段遵守白榜——禁止签/观音/占卜/命理/吉/凶/oracle/fortune 等（见上文完整列表）；允许原型隐喻/行为蓝图/系统性情境模式
4. **命理依据**: 「命理看此事」须含 日主+大运+用神 三项（见 §2.1）；字段**内容**用性格结构/行为蓝图表述，禁写「命理」二字
5. **隐喻依据**: §2.2 三种引用至少两种；禁止抄写 modern_translation 英文摘要
6. **结构必备**: 命理双视角 + 原型隐喻意象 + exploration 内观练习 三者缺一不可
7. **总字数**: 中文约 1500-3000 字 / 英文约 1200-2400 词（各字符串字段合计）
8. **严格 JSON**: 不要用 \`\`\`json 包裹

# 不要做的事

- 不预测具体未来（几月几号会发生）
- 不下命运定论
- 不替用户做决定
- 不把 Glyph 写成 POJU 破局顾问或三条行动方案
- 不编造原文没有的意象、典故或等级名
- 不在任何输出字符串写 OUTPUT FRAMING 禁止词（零宗教/零占卜用语；气势只用五风类）`;

  const system = stitchPromptSections(
    GLYPH_GUANYIN_100_LOTS_IDENTITY,
    GLYPH_GUANYIN_INTERPRETATION_METHOD,
    GLYPH_OUTPUT_FRAMING,
    GLYPH_OUTPUT_BRANDING,
    GLYPH_LANGUAGE_RULES,
    ORIENTAL_SHARED_GUARDRAILS,
    buildCurrentDateContext(new Date(), locale),
    buildProfileContextSection(profile, base_analysis),
    buildLanguageGuidance(locale, question),
    buildNorthAmericaAdaptation(locale),
    `# 当前任务：本次 Glyph 解读

用户触发了一个原型隐喻（内部对应观音百签 #${glyph.id}）。你要结合【命主 base_analysis structured + display_text】+【完整签文原文（仅内部分析用）】+【用户问题】，按上文解签法则做一次【深度双视角解读】。
输出 JSON 字符串必须 100% 遵守 OUTPUT FRAMING 白榜。`,
    signBlock,
    outputSchema,
  );

  const user = `请按解签法则生成解读 JSON。

⛔ 输出合规（最高优先级）: 所有字符串字段遵守 OUTPUT FRAMING 白榜——禁止签/观音/占卜/命理/吉/凶/oracle/fortune 等；用「原型隐喻」「行为蓝图」「系统性情境模式」。
✓ 语言: 跟随用户实际输入（${outputLang}）。
✓ 内容: 命理看此事须含日主+大运+用神；隐喻解读须用 §2.2 至少两种引用；不得抄写 modern_translation。
✓ invalid_input 时所有字段仍填中性引导，禁止空字符串。`;

  return { system, user };
}
