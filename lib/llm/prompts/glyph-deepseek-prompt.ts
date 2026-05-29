import {
  GLYPH_GUANYIN_100_LOTS_IDENTITY,
  GLYPH_GUANYIN_INTERPRETATION_METHOD,
  GLYPH_OUTPUT_BRANDING,
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
  return "语调：尊重签意与用户命局，双视角整合。";
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
- wind_category_blurb：礼貌说明问题暂无法按千年签法精准对焦，邀请换一句更具体的事
- 命理双视角三字段：各写 2–4 句中性说明（可泛述五风类气势 + 内观方向，不硬断）
- meaning_for_question / hidden_tension / your_moment / reflection_question / exploration.text：给出通用内观引导（聚焦、暂停、写下真正想问的一句）
- classical_voice：仍可引用签诗意象（§2.2），但不假装读懂用户问题

# 输出格式（严格 JSON，无 markdown 围栏）`;

  const outputSchema = `

{
  "wind_category_blurb": "30-50 字。介绍这个风类的整体氛围",
  "classical_voice": "50-80 字。用 Glyph 口吻点出签诗核心与典故（§2.2：诗句/意象/典故至少一种；勿写观音/菩萨/灵签/上签下签；可说 Glyph 的解曰/仙机/千年签法）",
  "命理双视角": {
    "命理看此事": "200-400 字。从八字命局看此事；**必须显式写出** base_analysis 中的：①日主天干及五行 ②当前大运 ③用神（缺失则说明仅据四柱推论）",
    "签文看此事": "200-400 字。从 Glyph 千年签法解读：§2.2 三种引用方式至少用两种；禁止 modern_translation 英文摘要抄入；禁止观音/灵签/等等第名，只用五风类",
    "两者印证或冲突": "100-200 字。印证还是冲突，对用户意味着什么"
  },
  "meaning_for_question": "180-280 字。深度解读 = 签 × 命局 × 用户具体问题",
  "hidden_tension": "60-100 字。用户可能看不到的张力或盲点",
  "your_moment": "80-120 字。当前时间能量（基于上面真实流年）+ 与签的互动",
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
2. **使用语言**: ${outputLang}（所有字符串字段用此语言，干支术语可保留）
3. **品牌**: 遵守「输出品牌」— 用户可见处只用 Glyph / 千年签法 / 古典智慧；禁止观音/菩萨/佛/南无/神明/灵签/求签/抽签及上上签/中签/下下签等等第名
4. **命理依据**: 「命理看此事」必须含 日主天干及五行 + 当前大运 + 用神 三项（见 §2.1）
5. **签文依据**: §2.2 三种引用至少两种；禁止抄写 modern_translation 英文摘要
6. **结构必备**: 命理双视角 + 签文意象 + exploration 内观练习 三者缺一不可
7. **总字数**: 中文约 1500-3000 字 / 英文约 1200-2400 词（各字符串字段合计）
8. **严格 JSON**: 不要用 \`\`\`json 包裹

# 不要做的事

- 不预测具体未来（几月几号会发生）
- 不下命运定论
- 不替用户做决定
- 不把 Glyph 写成 POJU 破局顾问或三条行动方案
- 不编造签文、典故或等第名
- 不在任何输出字段写宗教/庙签用语或传统签等级名（只用五风类）`;

  const system = stitchPromptSections(
    GLYPH_GUANYIN_100_LOTS_IDENTITY,
    GLYPH_GUANYIN_INTERPRETATION_METHOD,
    GLYPH_OUTPUT_BRANDING,
    GLYPH_LANGUAGE_RULES,
    ORIENTAL_SHARED_GUARDRAILS,
    buildCurrentDateContext(new Date(), locale),
    buildProfileContextSection(profile, base_analysis),
    buildLanguageGuidance(locale, question),
    buildNorthAmericaAdaptation(locale),
    `# 当前任务：本次 Glyph 解读

用户抽到了一支观音百签。你要结合【完整命主基础分析 JSON】+【完整签文原文（百签原文）】+【用户问题】，按上文「观音百签 · 解签法则」做一次【深度双视角解读】。`,
    signBlock,
    outputSchema,
  );

  const user = `请按解签法则生成解读 JSON。所有面向用户的文字必须使用 Glyph 品牌（千年签法/古典智慧，禁止观音/菩萨/灵签/等等第名）。命理看此事须含日主+大运+用神；签文看此事须用 §2.2 至少两种引用方式；不得抄写 modern_translation。invalid_input 时所有字段仍填中性引导，禁止空字符串。`;

  return { system, user };
}
