import { buildSyncroOutputDefenseSections } from "@/lib/llm/prompts/syncro-base";
import { stitchPromptSections } from "@/lib/llm/prompts/oriental-counselor-base";
import {
  getSyncroLanguageDirective,
  parseAppLocale,
  resolveSyncroOutputLocale,
  type AppLocale,
} from "@/lib/prompts/language-directive";

import { buildSyncroProfileIsolationBlock } from "@/lib/syncro/syncro-profile-summary";

export type SyncroBatchPromptCell = {
  direction: string;
  current_level: string;
  key_hints?: string[];
};

export type SyncroBatchPromptHour = {
  hour_id: string;
  hour_label: string;
  hour_range: string;
  cells: SyncroBatchPromptCell[];
};

export type BuildSyncroBatchPromptInput = {
  hours: SyncroBatchPromptHour[];
  task_description: string;
  profile_summary: string;
  locale: string;
};

export type SyncroBatchPromptResult = {
  system: string;
  user: string;
  outputLocale: AppLocale;
  outputLanguage: string;
};

function formatDateForLocale(outputLocale: AppLocale): string {
  const now = new Date();
  if (outputLocale === "zh") {
    return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  }
  return now.toISOString().split("T")[0]!;
}

function buildHoursSections(hours: SyncroBatchPromptHour[], isZhOutput: boolean): string {
  const hintsLabel = isZhOutput ? "关键信号" : "key signals";
  return hours
    .map((hour) => {
      const cellsDesc = hour.cells
        .map((c) => {
          const hints = c.key_hints?.length ? ` · ${hintsLabel}: ${c.key_hints.join(isZhOutput ? "、" : ", ")}` : "";
          return `    ${c.direction}: ${c.current_level}${hints}`;
        })
        .join("\n");
      return `【${hour.hour_label} ${hour.hour_range} · hour_id=${hour.hour_id}】\n${cellsDesc}`;
    })
    .join("\n\n");
}

function resolveOutputMeta(locale: string, taskDescription: string) {
  const appLocale = parseAppLocale(locale);
  const outputLocale = resolveSyncroOutputLocale(appLocale, taskDescription);
  const langDirective = getSyncroLanguageDirective(appLocale, taskDescription);
  return {
    appLocale,
    outputLocale,
    outputLanguage: langDirective.outputLanguage,
    langDirective: langDirective.directive,
    isZhOutput: outputLocale === "zh",
  };
}

/** Batch path (advice_by_hour JSON) — language + four defense lines. */
export function buildSyncroBatchPromptForHours(
  input: BuildSyncroBatchPromptInput,
): SyncroBatchPromptResult {
  const { outputLocale, outputLanguage, langDirective, isZhOutput } = resolveOutputMeta(
    input.locale,
    input.task_description,
  );
  const dateStr = formatDateForLocale(outputLocale);
  const hoursSections = buildHoursSections(input.hours, isZhOutput);
  const hourIds = input.hours.map((h) => h.hour_id).join(", ");
  const hourIdList = input.hours.map((h) => `"${h.hour_id}"`).join(isZhOutput ? "、" : ", ");
  const cellCount = input.hours.reduce((n, h) => n + h.cells.length, 0);
  const defenseBlock = stitchPromptSections(...buildSyncroOutputDefenseSections());
  const profileIsolation = buildSyncroProfileIsolationBlock(outputLanguage, isZhOutput);

  const coreRules = isZhOutput
    ? `你是 pojulife Syncro 资深分析师。本次 LLM 调用【仅】生成以下 ${input.hours.length} 个时辰（hour_id 必须完全一致）:${hourIdList}。共 ${cellCount} 个方位。

用户任务:"${input.task_description}"
命局结构(内部分析):${input.profile_summary}
日期:${dateStr}

各时辰方位状态(严禁改 current_level):
${hoursSections}

每个时辰 8 方位各 3 字段:short(15-25字)、detailed(100-150字)、rationale(80-120字,必须紧扣用户任务,至少一次提到 Syncro)。

严格 JSON:
{
  "advice_by_hour": {
    "${input.hours[0]?.hour_id ?? "zi"}": {
      "N": { "short": "...", "detailed": "...", "rationale": "..." },
      "NE": { ... }, "E": { ... }, "SE": { ... }, "S": { ... }, "SW": { ... }, "W": { ... }, "NW": { ... }
    }${input.hours[1] ? `,\n    "${input.hours[1].hour_id}": { ... 8 directions ... }` : ""}
  }
}

必须包含 hour_id: ${hourIds} 的全部时辰,每时辰 8 方向。
advice_by_hour 的键必须且只能是上述 hour_id 字符串（与【hour_id=】完全一致,禁止申/午/Wu 等别名或其他时辰）。只输出 JSON。`
    : `You are a pojulife Syncro analyst. This call generates ONLY these hour_id values: ${hourIdList}. (${cellCount} direction cells.)

Task: "${input.task_description}"
Profile (internal structural data): ${input.profile_summary}
Date: ${dateStr}

Precomputed states (DO NOT modify current_level):
${hoursSections}

Per direction: short(40-60 chars), detailed(220-300 chars), rationale(180-260 chars — tie to the user's task; mention Syncro at least once).

Strict JSON:
{
  "advice_by_hour": {
    "<hour_id>": { "N": { "short", "detailed", "rationale" }, ... 8 directions }
  }
}

Include all hour_ids: ${hourIds}. advice_by_hour keys MUST match those hour_id strings exactly (no aliases). JSON only.`;

  const system = `${coreRules}

${langDirective}

${profileIsolation}

${defenseBlock}`;

  const user = isZhOutput
    ? `请为上述 ${input.hours.length} 个时辰生成文案,严格 JSON,按 advice_by_hour 结构。全部使用 ${outputLanguage}。`
    : `Generate for all listed hours. Strict JSON with advice_by_hour. Write entirely in ${outputLanguage}.`;

  return { system, user, outputLocale, outputLanguage };
}

/** Single-hour retry path (advice JSON) — same language + defense stack. */
export function buildSyncroSingleHourRetryPrompt(input: {
  task_description: string;
  profile_summary: string;
  locale: string;
  hour_label: string;
  hour_range: string;
  cells: Array<{ direction: string; current_level: string }>;
}): SyncroBatchPromptResult {
  const { outputLocale, outputLanguage, langDirective, isZhOutput } = resolveOutputMeta(
    input.locale,
    input.task_description,
  );
  const defenseBlock = stitchPromptSections(...buildSyncroOutputDefenseSections());
  const profileIsolation = buildSyncroProfileIsolationBlock(outputLanguage, isZhOutput);

  const charHint = isZhOutput
    ? "short(15-25字)、detailed(100-150字)、rationale(80-120字,紧扣用户任务,至少一次提到 Syncro)"
    : "short(40-60 chars), detailed(220-300 chars), rationale(180-260 chars — tie to task; mention Syncro at least once)";

  const coreRules = isZhOutput
    ? `你是 pojulife Syncro 资深分析师。为给定时辰的 8 个方位生成实用指导。

用户任务:"${input.task_description.trim()}"
命局结构(内部分析):${input.profile_summary}

严格 JSON（只输出 JSON）:
{
  "advice": {
    "N": { "short": "...", "detailed": "...", "rationale": "..." },
    ... 8 directions NE/E/SE/S/SW/W/NW ...
  }
}

每方位 ${charHint}。8 个方向必须全部生成。`
    : `You are a pojulife Syncro analyst. Generate practical guidance for 8 directions of one hour.

Task: "${input.task_description.trim()}"
Profile (internal structural data): ${input.profile_summary}

Strict JSON ONLY:
{
  "advice": {
    "N": { "short", "detailed", "rationale" },
    ... all 8 directions ...
  }
}

Per direction: ${charHint}. All 8 directions required.`;

  const system = `${coreRules}

${langDirective}

${profileIsolation}

${defenseBlock}`;

  const userMsg = isZhOutput
    ? `时辰:${input.hour_label} (${input.hour_range})

8 方位 current_level(已算好,不可改):
${input.cells.map((c) => `  ${c.direction}: ${c.current_level}`).join("\n")}

为全部 8 方位生成文案。只输出 JSON。全部使用 ${outputLanguage}。`
    : `Hour: ${input.hour_label} (${input.hour_range})

Precomputed current_level (DO NOT change):
${input.cells.map((c) => `  ${c.direction}: ${c.current_level}`).join("\n")}

Generate all 8 directions. JSON only. Write entirely in ${outputLanguage}.`;

  return { system, user: userMsg, outputLocale, outputLanguage };
}

export function resolveSyncroBatchOutputLocale(locale: string, taskDescription: string): AppLocale {
  return resolveSyncroOutputLocale(parseAppLocale(locale), taskDescription);
}
