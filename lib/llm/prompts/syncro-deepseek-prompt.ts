/**
 * Syncro v5 — DeepSeek 96-combination matrix prompt.
 * @see docs/Syncro_v5.0_Refactor.md Step 8
 */

import {
  buildSyncroCorePromptSections,
} from "@/lib/llm/prompts/syncro-base";
import {
  buildCurrentDateContext,
  buildLanguageGuidance,
  buildNorthAmericaAdaptation,
  buildProfileContextSection,
  detectLanguage,
  stitchPromptSections,
} from "@/lib/llm/prompts/oriental-counselor-base";
import { CURRENT_LEVELS, DIRECTIONS, type DirectionId } from "@/lib/syncro/current-system";
import { generateNext12HourPeriodSlots } from "@/lib/syncro/hour-period-slots";
import { HOUR_PERIODS, type HourPeriod } from "@/lib/syncro/types";
import type { UserProfile } from "@/lib/profile/types";

export type BuildSyncroPromptInput = {
  profile: UserProfile | null;
  base_analysis: unknown;
  task_description: string;
  user_location: { latitude: number; longitude: number; timezone: string };
  locale: string;
  current_time: Date;
};

const DIRECTION_IDS = Object.keys(DIRECTIONS) as DirectionId[];
const CURRENT_LEVEL_IDS = Object.keys(CURRENT_LEVELS);

export function buildSyncroPrompt(input: BuildSyncroPromptInput): {
  system: string;
  user: string;
} {
  const { profile, base_analysis, task_description, user_location, locale, current_time } = input;
  const hourPeriodsList = generateNext12HourPeriodSlots(current_time);
  const outputLang = detectLanguage(task_description, locale);
  const isZh = outputLang.includes("Chinese") || locale.startsWith("zh");

  const exampleKey = `${hourPeriodsList[0]?.hour_period ?? "mao"}__N`;

  const periodsBlock = hourPeriodsList
    .map(
      (p, i) =>
        `${i + 1}. ${isZh ? p.hour_period_name_zh : p.hour_period_name_en} (${p.hour_period}) — ${p.start_time} → ${p.end_time}`,
    )
    .join("\n");

  const currentLevelsBlock = CURRENT_LEVEL_IDS.map((id) => {
    const info = CURRENT_LEVELS[id as keyof typeof CURRENT_LEVELS];
    return `- ${id}: ${info.name_en} / ${info.name_zh}`;
  }).join("\n");

  const taskBlock = `# 当前任务：Syncro 方位 × 时辰矩阵（24 小时陪伴窗口）

用户即将要做的事：
"${task_description.replace(/"/g, '\\"')}"

用户当前位置：
经度 ${user_location.longitude.toFixed(4)}，纬度 ${user_location.latitude.toFixed(4)}
时区：${user_location.timezone}

# 接下来 12 个时辰（用户本地时间，从当前时辰起连续 12 段）

${periodsBlock}

# Current 5 等级（对用户输出仅用此体系 — 禁止吉凶词）

${currentLevelsBlock}

# 你的工作

为以上 12 个时辰 × 8 个方位 = **96** 个组合，每个都给出：

1. **current_level**（严格使用上面 5 个 id 之一）
2. **short_advice**（30–50 字${isZh ? "中文" : "英文"}）— 直接行动指引，扣住用户任务；不重复等级英文名
3. **detailed_advice**（100–200 字）— 展开时机+方位+命局（须引日主/大运/用神至少一项）；具体行动
4. **rationale**（100–200 字）— 天时地利人和为何合成该 Current；可用 Syncro 语言内化奇门推演，禁止写八门/奇门遁甲

# 输出格式（严格 JSON）

只输出一个 JSON 对象，无 markdown 围栏：

{
  "matrix": {
    "${exampleKey}": {
      "current_level": "open_current",
      "short_advice": "...",
      "detailed_advice": "...",
      "rationale": "..."
    }
  }
}

# 关键规则

1. **8 方位 ID** 仅限：${DIRECTION_IDS.join(", ")}
2. **12 时辰 ID** 仅限：${Object.keys(HOUR_PERIODS).join(", ")}
3. **key 格式**：\`{hour_period}__{direction_id}\`（例：mao__SE、wu__N）
4. **必须输出全部 96 个 key**，缺一不可
5. **不均匀分布**：按奇门时空推演 + 命局，禁止平均分配或全 open_current
6. **命局关联**：detailed_advice / rationale 须体现日主、大运、用神
7. **语言**：${outputLang}（short/detailed/rationale 全部同一语言）
8. **品牌**：遵守 Syncro 输出品牌 — 禁奇门术语、禁吉凶词、禁 POJU/Glyph/Match`;

  const system = stitchPromptSections(
    ...buildSyncroCorePromptSections(),
    buildCurrentDateContext(current_time, locale),
    buildLanguageGuidance(locale, task_description),
    buildNorthAmericaAdaptation(locale),
    buildProfileContextSection(profile, base_analysis),
    taskBlock,
  );

  const user = isZh
    ? "请按 Syncro 时空顾问法则生成完整 96 组合 JSON（matrix 内 96 个 key）。Current 等级 + 奇门内化推演，用户可见处只用 Syncro 语言。"
    : "Generate the complete 96-combination JSON (96 keys in matrix). Use Current levels only; apply Qimen logic internally, Syncro branding in all user-visible strings.";

  return { system, user };
}
