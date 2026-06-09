/**
 * Match v5.1 — DeepSeek 5-section report prompt (local matrix + LLM copy).
 * @see docs/Match_Calculation_Engine.md Step 5
 */

import type { CompatibilityMatrix } from "@/lib/match/calculate-compatibility";
import { buildMatchCorePromptSections } from "@/lib/llm/prompts/match-base";
import {
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
    (a_profile as { base_analysis?: unknown } | null)?.base_analysis;
  const bBaseAnalysis =
    b_base_analysis ??
    (b_profile as { base_analysis?: unknown } | null)?.base_analysis;

  const relEscaped = relationship_description.replace(/"/g, '\\"');
  const level = compatibilityMatrix.overall_level;

  const system = stitchPromptSections(
    ...buildMatchCorePromptSections(),
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

后台已基于 6 个能量维度精确计算了两个 profile 的 compatibility（JSON 矩阵见下）。

# ⛔ 严格禁止（用户可见 JSON 输出）

你【绝不能】:
  ✗ 修改 overall_level(已计算)
  ✗ 修改 weighted_total_score
  ✗ 重新判断契合度
  ✗ 输出"我觉得他们契合度更高"等推翻计算的话
  ✗ **裸写排盘/合婚术语**：Liu He / 六合 / Xing / Hai / Chong / stem / branch / pillar / 干支名 / charts
  ✗ **超自然承诺**：招财/催运/避邪/lucky direction/Amulet/Wealth activation

你只需要:
  ✓ 把【矩阵计算结果】翻译为【五行能量 + synergy/tension/friction 用户语言】
  ✓ 把 key_insights 展开为具体叙述（用 natural affinity / friction，不用合冲刑害裸写）
  ✓ 基于用户描述的关系,给出针对性的建议

# 已计算的契合度矩阵（内部分析用 — 用户可见 JSON 须翻译术语）

\`\`\`json
${JSON.stringify(compatibilityMatrix, null, 2)}
\`\`\`

# 你的工作:生成 5 段完整报告

## 1. analysis_a(关于 A)
- 200-400 字详细
- 突出与此关系相关的 profile 特质（core nature / life cycle / balancing element）
- A 在此关系中的天然倾向
- 3-5 条关键特质(key_traits)
- **禁** pillar / stem / branch / chart 裸写

## 2. analysis_b(关于 B)
- 同结构,针对 B

## 3. combined(合盘)
- 400-600 字详细
- 内化 day_master_interaction + branch_interactions — **输出**用 affinity / tension / friction / Five Elements synergy
- 五行互动 200-300 字（Wood feeds Water 等 — **可保留**）
- 时机协同 100-200 字（life cycle / pacing — **禁** 大运/流年/pillar 裸写）
- 至少一处 **《易经》** 互补/变化之道

## 4. conclusion(结论)
- compatibility_level 必须用【已计算的 overall_level】(绝不修改!)
- 简短结论 50-100 字
- 详细 200-400 字
- 优势 3-5 条(展开 key_insights.strengths)
- 挑战 3-5 条(展开 key_insights.challenges)
- **禁** 宜婚/不宜婚/大吉/大凶

## 5. recommendations(建议)
- 4-6 条具体可执行
- 类别:communication / timing / boundary / growth / environment（三步洗白：spatial harmony + 动作 + 环境心理学；鱼缸/植物/材质可保留；禁招财/催运）
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

2. **引用计算结果 — 只输出能量语言**:
   - day_master_interaction → core nature synergy / tension（禁 type 字段名裸写）
   - branch_interactions → natural affinity / friction patterns（禁 合冲刑害 / pillar 层级）
   - yong_shen_match → balancing element complement
   - 不把分数原文贴给用户

3. **建议必须可执行** — 避免空泛「多沟通」

4. **不预测具体未来事件**；**不下定论"你们一定…/绝不…"**

5. **产品指代**：this Match + compatibility/synergy 框架

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
