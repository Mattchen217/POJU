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
2. **奇门 / 用神方位 / 时辰天干**：_internal.key_factors / qimen_data——内化后输出 Syncro 语言。
3. **真太阳时**：窗口基于用户真实地理位置。

## 合规接法
- ✓ 就任务直答：推荐时机窗口 + 方向 + 任务视角依据（大白话）。
- ✗ 禁：报具体公历日期吉凶、承诺"必成"、写八门/奇门/用神等术语。

${SYNCRO_TASK_RESPONSE_FOCUS}`
    : `# 本批不产出 task_response（仅在最后一批汇总；本批 ${input.batch_index ?? 1}/${input.batch_total ?? 1}）。`;

  const taskBlock = `# 当前任务：Syncro 96 组合文案生成
${batchNote}

用户即将要做的事情：
"${escapedTask}"

用户当前位置：
经度 ${user_location.longitude.toFixed(4)}，纬度 ${user_location.latitude.toFixed(4)}
时区：${user_location.timezone}
${buildTrueSolarSection(input.true_solar)}

# ⭐⭐⭐ 极其重要：矩阵已经计算好了

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

# 组合数据（已计算 — 供你写文案参考）

${JSON.stringify(slimMatrix, null, 2)}

${taskResponseBlock}

# 你的工作

为 matrix 中每个 key（共 ${cellCount} 个），仅输出 short_advice / detailed_advice / rationale。

写作要求：

1. **short_advice**（30–50 字/词）
   - 直接行动指引，符合该方位 × 时辰 × **已有** current_level
   - 不重复等级英文名（Open Current 等）
   - 英文建议动词开头：Move… / Wait… / Pause…

2. **detailed_advice**（100–200 字/词）
   - 展开命理依据 + 具体行动
   - **必须引用该用户命局的具体一项**（用神所喜五行、当前大运主题、关键神煞、旺衰倾向等 — 见「用户命局背景」）
   - 可内化 _internal.qimen_data 中的门星神信号，**用户可见处用 Syncro 语言**，不写八门/奇门遁甲

3. **rationale**（100–150 字/词）
   - ⚠️ 针对用户【具体任务】解释为何此时此向适合（或不适合）去做这件事
   - **必须引用命局背景 ≥1 项**，让用户感到「这是按我的八字算的」，不是通用黄历
   - 把 _internal.key_factors 当作内心依据，**禁止**在文案中写出原始字段名（如 qimen、yong_shen_direction、day_master_direction、hour_yong_shen、task_direction）
   - **禁止**「主要因素：…」或「Key factors: …」及逗号罗列内部 key 的句式
   - 用大白话说明对用户任务的含义，不堆术语、不写八门/奇门/用神等词

   ❌ 错误：
   - 「主要因素:qimen, yong_shen_direction」
   - 「yong_shen_direction 对当前 hour pillar 有 sheng 关系」

   ✅ 正确（用户问会议谈判）：
   - 「会议谈判需要你的气场稳定且能影响对方。这个时辰和方位的组合让你既有底气，又不咄咄逼人。」

   ✅ 正确（用户问签合同）：
   - 「签合同需要清醒判断。这个组合让你头脑清晰，避开了情绪化决策的时段。」

# 关键规则

1. **本批所有 key 必须全部填充**（共 ${cellCount} 个）
2. **输出 JSON 每个 cell 仅含 3 个字段**：short_advice、detailed_advice、rationale
3. **语言**：${outputLanguage}
4. **品牌 + 四道防线**：用户可见处只用 Syncro + Current 五流 + 共振/效率语言；禁奇门/风水/吉凶/预测成功；须 I Ching 时位框架
5. **task_response 必填**（仅最后一批）：从已计算的高 level 组合中汇总推荐窗口+方向，任务视角给依据；不报日期吉凶、不承诺成功、不写奇门/用神术语。

${SYNCRO_OUTPUT_SELF_CHECK}

# 输出格式（严格 JSON）

只输出 JSON，无 markdown 围栏：

{
  ${isFinalBatch ? `"task_response": {
    "summary": "60-100 字。就用户任务直答：推荐的时机窗口 + 方向（大白话）",
    "best_windows": [
      { "window": "（时辰段）", "direction": "（方位）", "why": "80-140 字，任务视角依据" }
    ],
    "avoid": "60-100 字。要避开的时段/方向及原因"
  },` : ""}
  "matrix": {
    "zi__N": {
      "short_advice": "...",
      "detailed_advice": "...",
      "rationale": "..."
    }
  }
}`;

  const structured = normalizeBaseAnalysisInput(base_analysis).structured;
  const baziContext = buildSyncroBaziContext(structured);
  const baziContextSection = buildSyncroBaziContextSection(
    baziContext,
    structured?.pattern,
  );

  const system = stitchPromptSections(
    ...buildSyncroFullPromptSections(),
    buildCurrentDateContext(current_time, locale),
    langDirective.directive,
    buildNorthAmericaAdaptation(outputLocale),
    baziContextSection,
    taskBlock,
  );

  const user =
    outputLocale === "zh"
      ? `请为已计算好的矩阵生成 short_advice / detailed_advice / rationale 文案（本批 ${cellCount} 个 key）。
${isFinalBatch ? `并产出 task_response 顶层直答用户任务「${escapedTask}」。` : "本批不要产出 task_response。"}
不要修改 current_level。全部使用${outputLanguage}。严格 JSON，matrix 内每个 key 缺一不可。
rationale 必须紧扣用户任务「${escapedTask}」，引用「用户命局背景」至少一项，绝不写出 qimen / yong_shen_direction / day_master 等内部字段名。`
      : `Generate short_advice, detailed_advice, and rationale for the precomputed matrix (${cellCount} keys in this batch).
${isFinalBatch ? `Also produce task_response answering the user's task ("${escapedTask}").` : "Do not produce task_response in this batch."}
Do not change current_level. Write entirely in ${outputLanguage}. Strict JSON only; every key in matrix is required.
Each rationale must speak to the user's task ("${escapedTask}") in plain language—never expose internal factor keys like qimen or yong_shen_direction. Cite at least one item from the local profile background section.`;

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
