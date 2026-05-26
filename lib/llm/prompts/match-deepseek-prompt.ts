/**
 * Match v5.1 — DeepSeek 5-section report prompt (local matrix + LLM copy).
 * @see docs/Match_Calculation_Engine.md Step 5
 */

import type { CompatibilityMatrix } from "@/lib/match/calculate-compatibility";
import {
  MATCH_BAZI_HEPAN_IDENTITY,
  MATCH_OUTPUT_BRANDING,
} from "@/lib/llm/prompts/match-base";
import {
  ORIENTAL_COUNSELOR_BASE,
  buildCurrentDateContext,
  buildProfileContextSection,
  detectLanguage,
  stitchPromptSections,
} from "@/lib/llm/prompts/oriental-counselor-base";
import type { UserProfile } from "@/lib/profile/types";

export type BuildMatchPromptInput = {
  a_profile: UserProfile | null;
  a_base_analysis?: unknown;
  b_profile: UserProfile | null;
  b_base_analysis?: unknown;
  relationship_description: string;
  locale: string;
  compatibilityMatrix: CompatibilityMatrix;
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
    compatibilityMatrix,
  } = input;

  const detectedLanguage = detectLanguage(relationship_description, locale);
  const aBaseAnalysis =
    a_base_analysis ??
    (a_profile as { base_analysis?: { content?: unknown } } | null)?.base_analysis?.content;
  const bBaseAnalysis =
    b_base_analysis ??
    (b_profile as { base_analysis?: { content?: unknown } } | null)?.base_analysis?.content;

  const relEscaped = relationship_description.replace(/"/g, '\\"');
  const level = compatibilityMatrix.overall_level;

  const system = stitchPromptSections(
    MATCH_BAZI_HEPAN_IDENTITY,
    MATCH_OUTPUT_BRANDING,
    ORIENTAL_COUNSELOR_BASE,
    buildCurrentDateContext(new Date(), locale),

    `# 命主 A 的完整命盘
${buildProfileContextSection(a_profile, aBaseAnalysis)}

---

# 命主 B 的完整命盘
${buildProfileContextSection(b_profile, bBaseAnalysis)}

---

# 用户描述的关系

"${relEscaped}"

# ⭐⭐⭐ 极其重要:契合度已经计算好了

后台已经基于 6 个命理维度精确计算了两个命盘的契合度:

1. 日主互动(权重 20%)
2. 用神匹配(权重 20%)
3. 地支合冲刑害(权重 20%)
4. 配偶星(权重 15%)
5. 神煞共振(权重 10%)
6. 大运同步度(权重 15%)

# ⛔ 严格禁止

你【绝不能】:
  ✗ 修改 overall_level(已计算)
  ✗ 修改 weighted_total_score
  ✗ 重新判断契合度
  ✗ 输出"我觉得他们契合度更高"等推翻计算的话

你只需要:
  ✓ 把【数学计算结果】翻译为【命理语言 + 用户友好的报告】
  ✓ 把 key_insights 中的标签展开为具体的内容
  ✓ 基于用户描述的关系,给出针对性的建议

# 已计算的契合度矩阵

\`\`\`json
${JSON.stringify(compatibilityMatrix, null, 2)}
\`\`\`

# 你的工作:生成 5 段完整报告

## 1. analysis_a(关于 A)
- 200-400 字详细
- 突出与此关系相关的命局特质
- A 在感情/合作/家庭中的天然倾向
- 3-5 条关键特质(key_traits)

## 2. analysis_b(关于 B)
- 同结构,针对 B

## 3. combined(合盘)
- 400-600 字详细
- 必须引用上面的 day_master_interaction(类型 + 描述)
- 必须引用 branch_interactions(合冲刑害)
- 必须引用 yong_shen_match
- 五行十神互动 200-300 字
- 时机协同 100-200 字

## 4. conclusion(结论)
- compatibility_level 必须用【已计算的 overall_level】(绝不修改!)
- 简短结论 50-100 字
- 详细 200-400 字
- 优势 3-5 条(展开 key_insights.strengths)
- 挑战 3-5 条(展开 key_insights.challenges)

## 5. recommendations(建议)
- 4-6 条具体可执行
- 类别:communication / timing / boundary / growth / fengshui
- 每条:title + detail (80-150 字) + timing

# 输出语言

⚠️ 极其重要:全部输出用【${detectedLanguage}】

# 输出格式(严格 JSON)

{
  "analysis_a": {
    "title": "...(用户语言)",
    "summary": "30-60 字",
    "detail": "200-400 字",
    "key_traits": ["...", "...", "...", "...", "..."]
  },
  "analysis_b": { "...": "同结构" },
  "combined": {
    "title": "...",
    "summary": "...",
    "detail": "...",
    "five_elements_interaction": "200-300 字",
    "timing_dynamic": "100-200 字"
  },
  "conclusion": {
    "title": "...",
    "compatibility_level": "${level}",
    "summary": "...",
    "detail": "...",
    "strengths": ["...", "...", "..."],
    "challenges": ["...", "...", "..."]
  },
  "recommendations": {
    "title": "...",
    "summary": "...",
    "actions": [
      { "category": "...", "title": "...", "detail": "...", "timing": "..." }
    ]
  }
}

# 关键规则

1. **compatibility_level 必须用 "${level}"**
   (从已计算的 overall_level 复制,绝不修改)

2. **必须引用计算结果**:
   - 提到具体的 day_master_interaction.type
   - 提到 branch_interactions 中的合冲刑害
   - 把数字翻译成命理语言(不直接说"得分 +45.3")

3. **建议必须可执行** — 避免空泛「多沟通」

4. **不预测具体未来事件**；**不下定论"你们一定…/绝不…"**

# 严格 JSON,无 markdown 围栏`,
  );

  const user = `请基于已计算好的契合度矩阵 + 关系描述,生成完整 5 段报告 JSON。
不修改 compatibility_level(必须用 "${level}")。
${detectedLanguage}。
严格 JSON。`;

  return {
    system,
    user,
    detected_language: detectedLanguage,
  };
}
