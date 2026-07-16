/**
 * Syncro v5.1 — LLM prompt for 96-combination copy only (levels precomputed locally).
 * @see docs/Syncro_Calculation_Engine.md Step 6
 */

import {
  buildSyncroFullPromptSections,
  SYNCRO_OUTPUT_SELF_CHECK,
  SYNCRO_TASK_RESPONSE_FOCUS,
} from "@/lib/llm/prompts/syncro-base";
import {
  buildCurrentDateContext,
  buildNorthAmericaAdaptation,
  stitchPromptSections,
} from "@/lib/llm/prompts/oriental-counselor-base";
import { normalizeBaseAnalysisInput } from "@/lib/llm/prompts/base-analysis-context";
import { stitchSingleProfileRelationClosedSet } from "@/lib/llm/prompts/relation-closed-set-context";
import {
  buildSyncroBaziContext,
  buildSyncroBaziContextSection,
} from "@/lib/syncro/build-syncro-bazi-context";
import {
  getSyncroLanguageDirective,
  parseAppLocale,
  resolveSyncroOutputLocale,
} from "@/lib/prompts/language-directive";
import type { MatrixCell, SyncroMatrixMetadata } from "@/lib/syncro/calculate-matrix";
import type { CurrentLevel } from "@/lib/syncro/current-system";
import { buildDualLayerDeliveryPromptBlock } from "@/lib/llm/prompts/dual-layer-delivery";
import { buildTermMarkingPromptBlock } from "@/lib/llm/sanitize/compliance-terms";
import type { UserProfile } from "@/lib/profile/types";

/** Slim payload for LLM — levels locked, no empty advice fields. */
export function slimMatrixForLlm(
  matrix: Record<string, MatrixCell>,
): Record<string, unknown> {
  const slim: Record<string, unknown> = {};
  for (const [key, cell] of Object.entries(matrix)) {
    slim[key] = {
      hour_period: cell.hour_period,
      direction_id: cell.direction_id,
      current_level: cell.current_level,
      total_score: cell._internal.total_score,
      key_factors: cell._internal.key_factors,
      qimen_data: cell._internal.qimen_data,
    };
  }
  return slim;
}

export type BuildSyncroPromptInput = {
  profile: UserProfile | null;
  base_analysis: unknown;
  task_description: string;
  user_location: { latitude: number; longitude: number; timezone: string };
  locale: string;
  current_time?: Date;
  /** Precomputed cells — includes current_level and _internal; LLM fills copy only */
  matrix: Record<string, MatrixCell>;
  true_solar?: SyncroMatrixMetadata;
  batch_index?: number;
  batch_total?: number;
  /** Full 96-cell matrix — required for task_response on the final batch. */
  full_matrix?: Record<string, MatrixCell>;
};

const LEVEL_RANK: Record<CurrentLevel, number> = {
  open_current: 5,
  following_current: 4,
  stillwater: 3,
  crosscurrent: 2,
  undertow: 1,
};

/** Summarize top precomputed cells for task_response (internal prompt only). */
export function buildTopWindowsMatrixSummary(
  matrix: Record<string, MatrixCell>,
  topN = 15,
): string {
  return Object.entries(matrix)
    .map(([key, cell]) => ({
      key,
      level: cell.current_level,
      score: cell._internal.total_score,
      rank: LEVEL_RANK[cell.current_level] ?? 0,
    }))
    .sort((a, b) => b.rank - a.rank || b.score - a.score)
    .slice(0, topN)
    .map((row) => `${row.key}: ${row.level} (score ${row.score})`)
    .join("\n");
}

export function buildSyncroPrompt(input: BuildSyncroPromptInput): {
  system: string;
  user: string;
} {
  const {
    base_analysis,
    task_description,
    user_location,
    locale,
    matrix,
  } = input;
  const current_time = input.current_time ?? new Date();
  const appLocale = parseAppLocale(locale);
  const outputLocale = resolveSyncroOutputLocale(appLocale, task_description);
  const langDirective = getSyncroLanguageDirective(appLocale, task_description);
  const outputLanguage = langDirective.outputLanguage;
  const escapedTask = task_description.replace(/"/g, '\\"');
  const cellCount = Object.keys(matrix).length;
  const slimMatrix = slimMatrixForLlm(matrix);
  const batchNote =
    input.batch_total && input.batch_total > 1
      ? `\n本批为第 ${input.batch_index ?? 1}/${input.batch_total} 批，仅处理下列 ${cellCount} 个 key。\n`
      : "";
  const isFinalBatch =
    !input.batch_total || input.batch_total <= 1 || input.batch_index === input.batch_total;
  const fullMatrix = input.full_matrix ?? matrix;
  const topWindowsSummary = buildTopWindowsMatrixSummary(fullMatrix);

  const taskResponseBlock = isFinalBatch
    ? `# ⭐ 必须为用户的任务给出顶层直答 task_response（最高优先级）

用户要做的事："${escapedTask}"。除了 matrix 文案，你必须额外产出一个 **task_response** 顶层对象，直接回答"我这件事该何时、朝哪个方向"。

## 取据于（内部已计算 → 合规输出）
1. **已计算的 current_level**：从全矩阵高 level 组合中挑选——绝不另判等级。参考：
${topWindowsSummary}
2. **奇门 / 用神方位 / 时辰天干**：_internal.key_factors / qimen_data——内化后，在 rationale 用 **SSOT qimen 软译术语**（\`qm_*\` slug 打标）说明「这个方位/时段为什么对你有利」。
3. **真太阳时**：窗口基于用户真实地理位置。

## 合规接法
- ✓ 就任务直答：推荐时机窗口 + 方向 + 任务视角依据。
- ✗ 禁：报具体公历日期吉凶、承诺"必成"、写奇门/遁甲/用神等**原名**（用官方软译 + 打标）。

${SYNCRO_TASK_RESPONSE_FOCUS}`
    : `# 本批不产出 task_response（仅在最后一批汇总；本批 ${input.batch_index ?? 1}/${input.batch_total ?? 1}）。`;

  const dateContext = buildCurrentDateContext(current_time, locale);

  const syncroRulesBlock = `# ⭐⭐⭐ 极其重要：矩阵已经计算好了

后台已基于完整命理模型（奇门遁甲盘 + 用神方位 + 时辰天干 + 日主 + 任务偏好）精确计算每个组合的 **current_level**。

5 个维度（已加权）：
  1. 奇门遁甲盘信号（30%）— 八门 / 八神 / 九星 / 三奇六仪 / 空亡
  2. 用神 + 喜忌方位匹配（25%）
  3. 时辰天干 vs 用神（20%）
  4. 日主 + 旺衰微调 vs 方位（15%）
  5. 任务匹配方位含义（10%）

# ⛔ 严格禁止

你【绝不能】：
  ✗ 修改任何 current_level（已是计算结果）
  ✗ 重新判断哪个组合是 open_current
  ✗ 质疑等级的准确性
  ✗ 在输出 JSON 中包含 current_level、hour_start_iso、_internal 等字段

你只需要：
  ✓ 为每个组合写 short_advice（30–50 字/词）
  ✓ 为每个组合写 detailed_advice（100–200 字/词）
  ✓ 为每个组合写 rationale（100–200 字/词）

# 你的工作

为 matrix 中每个 key，仅输出 short_advice / detailed_advice / rationale。

写作要求：

1. **short_advice**（30–50 字/词）· 正文层
   - 直接行动指引，符合该方位 × 时辰 × **已有** current_level
   - **零标记**、纯白话；不重复等级英文名
   - 英文建议动词开头：Move… / Wait… / Pause…

2. **detailed_advice**（100–200 字/词）· 正文层扩展
   - 具体行动展开；**零标记**
   - **必须引用该用户命局的具体一项**（见「用户命局背景」）

3. **rationale**（100–150 字/词）· **依据与推理**（UI 折叠）
   - 针对用户【具体任务】解释为何此时此向适合（或不适合）
   - **必须引用命局背景 ≥1 项** + 可打 2–3 个 SSOT 术语：\`⟦t:qm_*|贴题白话⟧\` / bazi slug
   - 把 _internal.key_factors / qimen_data 当作内心依据；**禁止**写出原始字段名
   - 软译词不用写（系统填入）；禁奇门/遁甲/用神**原名**与吉凶预测

   ❌ 「主要因素:qimen, yong_shen_direction」
   ✅ 「这个时段你的气场更稳——⟦t:qm_kai_men|谈判开口更容易被听见⟧，适合推进你要的那次会议。」

# 关键规则

1. **本批所有 key 必须全部填充**
2. **输出 JSON 每个 cell 仅含 3 个字段**：short_advice、detailed_advice、rationale
3. **品牌 + 四道防线**：短建议用白话；依据块用 SSOT 官方术语（非原名）；禁风水/吉凶/预测成功
4. **task_response 必填**（仅最后一批）：汇总推荐窗口+方向；不报日期吉凶、不承诺成功。

${SYNCRO_OUTPUT_SELF_CHECK}

# 输出格式（严格 JSON）

只输出 JSON，无 markdown 围栏：

{
  "task_response": { "summary": "...", "best_windows": [...], "avoid": "..." },
  "matrix": {
    "zi__N": {
      "short_advice": "...",
      "detailed_advice": "...",
      "rationale": "..."
    }
  }
}`;

  const taskBlock = `# 当前任务：Syncro 96 组合文案生成
${batchNote}

用户即将要做的事情：
"${escapedTask}"

用户当前位置：
经度 ${user_location.longitude.toFixed(4)}，纬度 ${user_location.latitude.toFixed(4)}
时区：${user_location.timezone}
${buildTrueSolarSection(input.true_solar)}

# 组合数据（已计算 — 供你写文案参考）

${JSON.stringify(slimMatrix, null, 2)}

${taskResponseBlock}

本批共 ${cellCount} 个 key。输出语言：${outputLanguage}。`;

  const structured = normalizeBaseAnalysisInput(base_analysis).structured;
  const baziContext = buildSyncroBaziContext(structured);
  const baziContextSection = buildSyncroBaziContextSection(
    baziContext,
    structured?.pattern,
  );
  const relationClosedSetBlock = structured
    ? stitchSingleProfileRelationClosedSet(structured, { questionText: task_description })
    : "";

  const system = stitchPromptSections(
    ...buildSyncroFullPromptSections(),
    buildDualLayerDeliveryPromptBlock(outputLocale),
    buildTermMarkingPromptBlock(outputLocale),
    baziContextSection,
    relationClosedSetBlock,
    syncroRulesBlock,
  );

  const user = stitchPromptSections(
    dateContext,
    langDirective.directive,
    buildNorthAmericaAdaptation(outputLocale),
    taskBlock,
    outputLocale === "zh"
      ? `请为已计算好的矩阵生成 short_advice / detailed_advice / rationale 文案（本批 ${cellCount} 个 key）。
${isFinalBatch ? `并产出 task_response 顶层直答用户任务「${escapedTask}」。` : "本批不要产出 task_response。"}
不要修改 current_level。全部使用${outputLanguage}。严格 JSON，matrix 内每个 key 缺一不可。
rationale 必须紧扣用户任务「${escapedTask}」，引用「用户命局背景」至少一项，绝不写出 qimen / yong_shen_direction / day_master 等内部字段名。`
      : `Generate short_advice, detailed_advice, and rationale for the precomputed matrix (${cellCount} keys in this batch).
${isFinalBatch ? `Also produce task_response answering the user's task ("${escapedTask}").` : "Do not produce task_response in this batch."}
Do not change current_level. Write entirely in ${outputLanguage}. Strict JSON only; every key in matrix is required.
Each rationale must speak to the user's task ("${escapedTask}") in plain language—never expose internal factor keys like qimen or yong_shen_direction. Cite at least one item from the local profile background section.`,
  );

  return { system, user };
}

function buildTrueSolarSection(meta: SyncroMatrixMetadata | undefined): string {
  if (!meta) return "";

  const sign = meta.diffMinutes > 0 ? "+" : "";
  return `
# ⭐ 真太阳时背景

用户位置：经度 ${meta.longitude.toFixed(4)}°，纬度 ${meta.latitude.toFixed(4)}°
用户本地时间：${meta.localTime}
真太阳时：${meta.trueSolarTime}
真太阳时与本地时间差：${sign}${meta.diffMinutes} 分钟（经度 ${meta.longitudeDiffMinutes}，时差方程 ${meta.eqOfTimeMinutes}）

矩阵中的【时辰】已基于真太阳时计算，不是本地时区平均时。

若在 rationale 中解释时辰，可写：
「基于你所在位置的真太阳时（相对本地时间 ${sign}${meta.diffMinutes} 分钟）…」
或简化为：「本时辰基于你的真实地理位置计算…」
`;
}
