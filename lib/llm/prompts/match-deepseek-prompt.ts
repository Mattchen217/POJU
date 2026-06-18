/**
 * Match v5.1 — DeepSeek 5-section report prompt (local matrix + LLM copy).
 * @see docs/Match_Calculation_Engine.md Step 5
 */

import type { ResonanceMatrix } from "@/lib/match/calculate-compatibility";
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
  compatibilityMatrix: ResonanceMatrix;
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
  const level = compatibilityMatrix.synergy_type;

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

# ⭐⭐⭐ 本次报告必须回答的核心问题

用户这次来，核心想知道的是：**"${relEscaped}"**
- conclusion.question_response **第一句必须复述这个问题并正面回应**。
- **回应必须有合婚技术依据**：内部先按日主互动 / 配偶宫(日支六合六冲) / 用神互补 / 神煞共振 / 大运流年同步**真算**，再把术语翻译成能量语言输出——像合婚先生那样「先算、有据」，不许凭感觉泛讲。
- 各段须围绕核心问题服务，但**遵守板块分工**（MATCH_OUTPUT_BRANDING）：combined 讲机制、conclusion 讲判断、recommendations 讲行动 —— **严禁回头重述**。
- 全文遵守 **MATCH_VOICE_CONTRACT**（A/B/combined 第三人称；conclusion/recommendations 用"你们"指整对，绝不把单方叫"你"）。
- 用 §"用户提问必须被正面回应" 的合规接法（技术依据 → 能量可行性 → 时机窗口 → 主动权），**不铁口日期、不下吉凶决断**。

# ⭐⭐⭐ 极其重要:协同类型已经计算好了

后台已基于 6 个能量维度精确计算了两个 profile 的系统动力学（JSON 矩阵见下）。

# ⛔ 严格禁止（用户可见 JSON 输出）

你【绝不能】:
  ✗ 修改 synergy_type(已计算)
  ✗ 修改 resonance_index
  ✗ 重新判断协同类型
  ✗ 输出"我觉得他们协同更高"等推翻计算的话
  ✗ **裸写排盘/合婚术语**：Liu He / 六合 / Xing / Hai / Chong / stem / branch / pillar / 干支名 / charts
  ✗ **超自然承诺**：招财/催运/避邪/lucky direction/Amulet/Wealth activation

你只需要:
  ✓ 把【矩阵计算结果】翻译为【五行能量 + synergy/tension/friction 用户语言】
  ✓ 把 key_insights 展开为具体叙述（用 natural affinity / friction，不用合冲刑害裸写）
  ✓ 基于用户描述的关系,给出针对性的建议

# 已计算的系统动力学矩阵（内部分析用 — 用户可见 JSON 须翻译术语）

\`\`\`json
${JSON.stringify(compatibilityMatrix, null, 2)}
\`\`\`

# 你的工作:生成 5 段完整报告

## 1. analysis_a(关于 A)
- 200-400 字详细
- 突出与此关系相关的 profile 特质（core nature / life cycle / balancing element）
- A 在此关系中的天然倾向
- 3-5 条关键特质(key_traits)
- **第三人称**指代 A（他/她/TA）；**禁「你」**；不讲 B、不讲互动结果

## 2. analysis_b(关于 B)
- 同结构,针对 B
- **第三人称**指代 B；**禁「你」**；不讲 A、不讲互动结果

## 3. combined(合盘 · 机制层)
- 400-600 字详细
- 内化 day_master_interaction + branch_interactions — **输出**用 affinity / tension / friction / Five Elements synergy
- 五行互动 200-300 字（Wood feeds Water 等 — **可保留**）
- 时机协同 100-200 字（life cycle / pacing — 用能量节律/阶段描述，**禁**干支纪年/公历年作时间锚点）
- 至少一处 **《易经》** 互补/变化之道
- **第三人称** + "两人/这段关系"；**禁「你」**；不下总评、不复述 A/B 画像

## 4. conclusion(结论 · 判断层)
- **question_response：100–180 字，开头复述用户问题；必须引用 ≥2 项合婚技术依据（日主互动/配偶宫/用神互补/神煞/大运流年，已翻译为能量语言），给出「合的成色 + 关键变量 + 时机窗口 + 主动权」；禁铁口日期与宜婚不宜婚**
- synergy_type 必须用【已计算的 synergy_type】(绝不修改!)
- 简短结论 50-100 字
- 详细 200-400 字 — **只做定性收口，严禁复述 combined 的能量互动过程**
- 优势 3-5 条(展开 key_insights.strengths) — 凝练条目，非 combined 散文复述
- 挑战 3-5 条(展开 key_insights.challenges)
- **「你们」**称呼整对；涉及单人仍第三人称；**禁把 A 或 B 单独称「你」**
- **禁** 宜婚/不宜婚/大吉/大凶

## 5. recommendations(建议 · 行动层)
- 4-6 条具体可执行 — **直接给做法，不重述前面分析**
- 类别:communication / timing / boundary / growth / environment（三步洗白：spatial harmony + 动作 + 环境心理学；鱼缸/植物/材质可保留；禁招财/催运）
- 每条:title + detail (80-150 字) + timing
- 涉及单人用第三人称（"他可以…""她则…"）；行动主体可用"你们"；timing **禁**干支纪年/公历年锚定

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
    "question_response": "（先复述用户问题；再引≥2 项合婚技术依据给出明确回应；100–180 字；合规接法）",
    "synergy_type": "${level}",
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

1. **synergy_type 必须用 "${level}"**
   (从已计算的 synergy_type 复制,绝不修改)

2. **引用计算结果 — 只输出能量语言**:
   - day_master_interaction → core nature synergy / tension（禁 type 字段名裸写）
   - branch_interactions → natural affinity / friction patterns（禁 合冲刑害 / pillar 层级）
   - yong_shen_match → balancing element complement
   - 不把分数原文贴给用户

3. **建议必须可执行** — 避免空泛「多沟通」

4. **不预测具体未来事件**；**不下定论"你们一定…/绝不…"**

5. **纪年护栏**：timing / your_moment 类表述禁钉到干支纪年或公历年（✗「丙午年夏季」✗「2027 年」作时间窗口）；只用能量节律 / life cycle 阶段 / 季节心境

6. **人称**：遵守 MATCH_VOICE_CONTRACT — analysis/combined 第三人称；conclusion/recommendations「你们」指整对，绝不把单方叫「你」

7. **板块零重复**：conclusion 不重讲 combined 机制；recommendations 不重述分析

8. **产品指代**：this Match + synergy / systemic dynamics 框架

# 严格 JSON,无 markdown 围栏`,
  );

  const user = `请基于已计算好的系统动力学矩阵 + 关系描述,生成完整 5 段报告 JSON。
本次用户的核心问题是:"${relEscaped}" —— conclusion.question_response 必须正面回应它(合规接法,不铁口日期)。
遵守 MATCH_VOICE_CONTRACT（第三人称 vs 你们）与板块分工（combined 机制 → conclusion 判断 → recommendations 行动，严禁重述）。
不修改 synergy_type(必须用 "${level}")。
${detectedLanguage}。
严格 JSON。`;

  return {
    system,
    user,
    detected_language: detectedLanguage,
  };
}
