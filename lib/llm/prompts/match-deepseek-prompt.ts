/**
 * Match v5 — DeepSeek 5-section compatibility report prompt.
 * @see docs/Match_v5.0_New.md Step 6
 */

import { buildMatchCorePromptSections } from "@/lib/llm/prompts/match-base";
import {
  buildCurrentDateContext,
  buildLanguageGuidance,
  buildNorthAmericaAdaptation,
  buildProfileContextSection,
  detectLanguage,
  stitchPromptSections,
} from "@/lib/llm/prompts/oriental-counselor-base";
import type { UserProfile } from "@/lib/profile/types";

export type BuildMatchPromptInput = {
  a_profile: UserProfile | null;
  a_base_analysis: unknown;
  b_profile: UserProfile | null;
  b_base_analysis: unknown;
  relationship_description: string;
  locale: string;
};

export type BuildMatchPromptResult = {
  system: string;
  user: string;
  detected_language: string;
};

export function buildMatchPrompt(input: BuildMatchPromptInput): BuildMatchPromptResult {
  const {
    a_profile,
    a_base_analysis,
    b_profile,
    b_base_analysis,
    relationship_description,
    locale,
  } = input;

  const detectedLanguage = detectLanguage(relationship_description, locale);
  const relEscaped = relationship_description.replace(/"/g, '\\"');

  const taskBlock = `# 当前任务：Match 双命合盘报告（5 段卡片）

你要为 **两个命主** 做完整合盘分析，输出严格 JSON（5 个顶层 key）。

# 命主 A 的命盘
${buildProfileContextSection(a_profile, a_base_analysis)}

---

# 命主 B 的命盘
${buildProfileContextSection(b_profile, b_base_analysis)}

---

# 用户描述的关系

"${relEscaped}"

# 5 段工作内容（见 MATCH_OUTPUT_BRANDING）

## analysis_a
- 与此关系相关的 A 命局特质；A 在感情/合作/家庭中的天然倾向
- detail 200–400 字；须引 A 的 **日主+五行、当前大运、用神**
- key_traits 3–5 条

## analysis_b
- B 在此关系中会怎样（不是泛泛命盘介绍）
- 同样须引 B 的 **日主+五行、当前大运、用神**

## combined
- **十神互看** + **五行生克** + **合冲刑害**（至少 2 类显式写出）
- 大运同频、流年互动；映射用户描述的具体情况
- detail 400–600 字；five_elements_interaction 200–300 字；timing_dynamic 100–200 字

## conclusion
- compatibility_level：highly_compatible | compatible_with_effort | neutral | challenging | highly_challenging（按权重判定）
- summary 50–100 字；detail 200–400 字；strengths 3–5；challenges 3–5

## recommendations
- 4–6 条：title + detail 80–150 字 + category + timing（可选）
- category：communication | timing | boundary | growth | fengshui

# 输出语言（关键）

⚠️ 全部字符串字段使用：**${detectedLanguage}**
检测依据：用户关系描述（非系统 locale）

# 输出格式（严格 JSON，无 markdown 围栏）

{
  "analysis_a": {
    "title": "About A（用户语言）",
    "summary": "30-60 字快览",
    "detail": "200-400 字",
    "key_traits": ["...", "...", "..."]
  },
  "analysis_b": {
    "title": "About B",
    "summary": "...",
    "detail": "...",
    "key_traits": ["...", "...", "..."]
  },
  "combined": {
    "title": "Together",
    "summary": "30-60 字",
    "detail": "400-600 字",
    "five_elements_interaction": "200-300 字（十神+五行）",
    "timing_dynamic": "100-200 字（大运流年）"
  },
  "conclusion": {
    "title": "Conclusion",
    "compatibility_level": "highly_compatible | compatible_with_effort | neutral | challenging | highly_challenging",
    "summary": "50-100 字",
    "detail": "200-400 字",
    "strengths": ["...", "...", "..."],
    "challenges": ["...", "...", "..."]
  },
  "recommendations": {
    "title": "What to Do",
    "summary": "50-100 字",
    "actions": [
      {
        "category": "communication",
        "title": "20-30 字",
        "detail": "80-150 字",
        "timing": "可选"
      }
    ]
  }
}

# 关键规则

1. 你是 **Match 合盘顾问**，不是 POJU 破局顾问（无 ═══ ANALYSIS ═══ 分段）
2. 具体引用两人命盘元素；禁止空泛「你们很合适」
3. 建议可执行；不预测具体日期；不下定论
4. 总字数约 1500–2500（用户语言）
5. 只输出 JSON，无解释文字`;

  const system = stitchPromptSections(
    ...buildMatchCorePromptSections(),
    buildCurrentDateContext(new Date(), locale),
    buildLanguageGuidance(locale, relationship_description),
    buildNorthAmericaAdaptation(locale),
    taskBlock,
  );

  const user = `请基于两位命主的命盘 + 关系描述，按 Match 合盘法则生成完整 5 段 JSON。须含十神/合冲分析；compatibility_level 五选一；全文使用 ${detectedLanguage}。`;

  return {
    system,
    user,
    detected_language: detectedLanguage,
  };
}
