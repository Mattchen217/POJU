/**
 * Syncro v5.1 — LLM prompt for 96-combination copy only (levels precomputed locally).
 * @see docs/Syncro_Calculation_Engine.md Step 6
 */

import { buildSyncroCorePromptSections } from "@/lib/llm/prompts/syncro-base";
import {
  buildCurrentDateContext,
  buildNorthAmericaAdaptation,
  buildProfileContextSection,
  stitchPromptSections,
} from "@/lib/llm/prompts/oriental-counselor-base";
import {
  getSyncroLanguageDirective,
  parseAppLocale,
  resolveSyncroOutputLocale,
} from "@/lib/prompts/language-directive";
import type { MatrixCell, SyncroMatrixMetadata } from "@/lib/syncro/calculate-matrix";
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
};

export function buildSyncroPrompt(input: BuildSyncroPromptInput): {
  system: string;
  user: string;
} {
  const {
    profile,
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
  1. 奇门遁甲盘信号（35%）— 八门 / 八神 / 九星 / 三奇六仪 / 空亡
  2. 用神方位匹配（25%）
  3. 时辰天干 vs 用神（20%）
  4. 日主 vs 方位（10%）
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

# 你的工作

为 matrix 中每个 key（共 ${cellCount} 个），仅输出 short_advice / detailed_advice / rationale。

写作要求：

1. **short_advice**（30–50 字/词）
   - 直接行动指引，符合该方位 × 时辰 × **已有** current_level
   - 不重复等级英文名（Open Current 等）
   - 英文建议动词开头：Move… / Wait… / Pause…

2. **detailed_advice**（100–200 字/词）
   - 展开命理依据 + 具体行动
   - 引用用户命局（日主 / 用神 / 大运至少一项）
   - 可内化 _internal.qimen_data 中的门星神信号，**用户可见处用 Syncro 语言**，不写八门/奇门遁甲

3. **rationale**（100–200 字/词）
   - 解释为何是该 current_level（等级已固定）
   - 引用 _internal.key_factors 中的主导因素
   - 把得分逻辑译成命理语言；**勿写 +28.5 等数字**
   - 可用「水势汇聚」「三方助力」「主吉星当头」等表述

# 关键规则

1. **本批所有 key 必须全部填充**（共 ${cellCount} 个）
2. **输出 JSON 每个 cell 仅含 3 个字段**：short_advice、detailed_advice、rationale
3. **语言**：${outputLanguage}
4. **品牌**：用户可见处只用 Syncro + Current 等级名；禁 POJU / Glyph / Match；禁吉凶词

# 输出格式（严格 JSON）

只输出 JSON，无 markdown 围栏：

{
  "matrix": {
    "zi__N": {
      "short_advice": "...",
      "detailed_advice": "...",
      "rationale": "..."
    }
  }
}`;

  const system = stitchPromptSections(
    ...buildSyncroCorePromptSections(),
    buildCurrentDateContext(current_time, locale),
    langDirective.directive,
    buildNorthAmericaAdaptation(outputLocale),
    buildProfileContextSection(profile, base_analysis),
    taskBlock,
  );

  const user =
    outputLocale === "zh"
      ? `请为已计算好的矩阵生成 short_advice / detailed_advice / rationale 文案（本批 ${cellCount} 个 key）。
不要修改 current_level。全部使用${outputLanguage}。严格 JSON，matrix 内每个 key 缺一不可。`
      : `Generate short_advice, detailed_advice, and rationale for the precomputed matrix (${cellCount} keys in this batch).
Do not change current_level. Write entirely in ${outputLanguage}. Strict JSON only; every key in matrix is required.`;

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
