import { getOpenRouterDefaultModel } from "@/lib/llm/openrouter-shared";
import {
  cacheLlmInput,
  cacheLlmOutput,
  clearStream,
  getCachedOutput,
  appendToStream,
} from "@/lib/syncro/syncro-kv";
import { cellsForHourFromContext } from "@/lib/syncro/generate-syncro-hour-with-retry";
import { pairLabel } from "@/lib/syncro/syncro-hour-pairs";
import { hourPeriodDisplayName, HOUR_PERIOD_RANGES } from "@/lib/syncro/hour-period-ranges";
import type { SyncroLlmContext } from "@/lib/syncro/syncro-llm-context-storage";
import {
  SyncroLlmHttpError,
  SyncroParseError,
  type SyncroHourAdviceCell,
  type SyncroLlmHourCallbacks,
  type SyncroLlmHourResult,
} from "@/lib/syncro/syncro-llm-core";

export { SyncroLlmHttpError, SyncroParseError };
import type { HourPeriod } from "@/lib/syncro/types";

export type SyncroLlmHourBlock = {
  hour_id: HourPeriod;
  hour_label: string;
  hour_range: string;
  cells: Array<{
    key: string;
    direction: string;
    current_level: string;
    key_hints?: string[];
  }>;
};

export type SyncroLlmHoursInput = {
  session_id: string;
  hours: SyncroLlmHourBlock[];
  task_description: string;
  profile_summary: string;
  locale: string;
};

export type SyncroLlmHoursResult = {
  advice: Record<string, SyncroHourAdviceCell>;
  raw_content: string;
  from_cache: boolean;
};

type DirectionAdvice = {
  short?: string;
  detailed?: string;
  rationale?: string;
};

function openRouterHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
  };
  const referer = process.env.OPENROUTER_HTTP_REFERER?.trim();
  const title = process.env.OPENROUTER_APP_TITLE?.trim();
  if (referer) headers["HTTP-Referer"] = referer;
  else headers["HTTP-Referer"] = "https://pojulife.com";
  if (title) headers["X-Title"] = title;
  else headers["X-Title"] = "pojulife";
  return headers;
}

function buildOpenRouterBody(
  model: string,
  system: string,
  user: string,
  includeReasoning: boolean,
): Record<string, unknown> {
  return {
    model,
    stream: true,
    ...(includeReasoning ? { reasoning: { effort: "high" } } : {}),
    response_format: { type: "json_object" },
    provider: {
      order: ["atlas-cloud", "alibaba", "venice"],
      allow_fallbacks: true,
    },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
}

function extractReasoningDelta(delta: Record<string, unknown> | undefined): string {
  if (!delta) return "";
  if (typeof delta.reasoning_content === "string") return delta.reasoning_content;
  if (typeof delta.reasoning === "string") return delta.reasoning;
  const details = delta.reasoning_details;
  if (Array.isArray(details)) {
    return details
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const o = item as Record<string, unknown>;
          if (typeof o.text === "string") return o.text;
          if (typeof o.content === "string") return o.content;
        }
        return "";
      })
      .join("");
  }
  return "";
}

function buildPromptForHours(input: SyncroLlmHoursInput): { system: string; user: string } {
  const isZh = input.locale === "zh";
  const now = new Date();
  const dateStr = isZh
    ? `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
    : now.toISOString().split("T")[0];

  const hoursSections = input.hours
    .map((hour) => {
      const cellsDesc = hour.cells
        .map((c) => {
          const hints = c.key_hints?.length ? ` · 关键信号: ${c.key_hints.join("、")}` : "";
          return `    ${c.direction}: ${c.current_level}${hints}`;
        })
        .join("\n");
      return `【${hour.hour_label} ${hour.hour_range} · hour_id=${hour.hour_id}】\n${cellsDesc}`;
    })
    .join("\n\n");

  const hourIds = input.hours.map((h) => h.hour_id).join(", ");

  const rulesZh = `你是 pojulife Syncro 资深分析师。本次需为【${input.hours.length} 个时辰、共 ${input.hours.reduce((n, h) => n + h.cells.length, 0)} 个方位】生成文案。

用户任务:"${input.task_description}"
命局摘要:${input.profile_summary}
日期:${dateStr}

各时辰方位状态(严禁改 current_level):
${hoursSections}

每个时辰 8 方位各 3 字段:short(15-25字)、detailed(100-150字)、rationale(80-120字,必须紧扣用户任务)。
语言跟随用户任务实际语言,不看 locale。
禁用:占卜/算命/奇门/八字/用神等术语;用 Syncro/解读/分析。

严格 JSON:
{
  "advice_by_hour": {
    "${input.hours[0]?.hour_id ?? "zi"}": {
      "N": { "short": "...", "detailed": "...", "rationale": "..." },
      "NE": { ... }, "E": { ... }, "SE": { ... }, "S": { ... }, "SW": { ... }, "W": { ... }, "NW": { ... }
    }${input.hours[1] ? `,\n    "${input.hours[1].hour_id}": { ... 8 directions ... }` : ""}
  }
}

必须包含 hour_id: ${hourIds} 的全部时辰,每时辰 8 方向。只输出 JSON。`;

  const rulesEn = `You are a pojulife Syncro analyst. Generate copy for ${input.hours.length} hours (${input.hours.reduce((n, h) => n + h.cells.length, 0)} direction cells).

Task: "${input.task_description}"
Profile: ${input.profile_summary}
Date: ${dateStr}

Precomputed states:
${hoursSections}

Per direction: short(40-60 chars), detailed(220-300), rationale(180-260, tie to task).
Output language must match the task language.

Strict JSON:
{
  "advice_by_hour": {
    "<hour_id>": { "N": { "short", "detailed", "rationale" }, ... 8 directions }
  }
}

Include all hour_ids: ${hourIds}. JSON only.`;

  const system = isZh ? rulesZh : rulesEn;
  const user = isZh
    ? `请为上述 ${input.hours.length} 个时辰生成文案,严格 JSON,按 advice_by_hour 结构。`
    : `Generate for all listed hours. Strict JSON with advice_by_hour.`;

  return { system, user };
}

function parseAdviceByHourJson(
  accumContent: string,
  input: SyncroLlmHoursInput,
): Record<string, SyncroHourAdviceCell> {
  const parsed = JSON.parse(accumContent) as {
    advice_by_hour?: Record<string, Record<string, DirectionAdvice>>;
  };
  const byHour = parsed.advice_by_hour;
  if (!byHour) {
    throw new SyncroParseError(accumContent, "missing advice_by_hour field");
  }

  const adviceByKey: Record<string, SyncroHourAdviceCell> = {};

  for (const hour of input.hours) {
    const dirMap = byHour[hour.hour_id];
    if (!dirMap) continue;
    for (const cell of hour.cells) {
      const dirAdvice = dirMap[cell.direction];
      if (!dirAdvice) continue;
      adviceByKey[cell.key] = {
        short_advice: (dirAdvice.short ?? "").trim(),
        detailed_advice: (dirAdvice.detailed ?? "").trim(),
        rationale: (dirAdvice.rationale ?? "").trim(),
      };
    }
  }

  if (Object.keys(adviceByKey).length === 0) {
    throw new SyncroParseError(accumContent, "no cell advice parsed");
  }

  return adviceByKey;
}

async function splitAndCachePerHour(
  sessionId: string,
  input: SyncroLlmHoursInput,
  adviceByKey: Record<string, SyncroHourAdviceCell>,
): Promise<void> {
  for (const hour of input.hours) {
    const hourAdvice: Record<string, SyncroHourAdviceCell> = {};
    for (const cell of hour.cells) {
      const patch = adviceByKey[cell.key];
      if (patch) hourAdvice[cell.key] = patch;
    }
    if (Object.keys(hourAdvice).length > 0) {
      await cacheLlmOutput(sessionId, hour.hour_id, hourAdvice);
      await clearStream(sessionId, hour.hour_id);
    }
  }
}

async function streamOpenRouter(
  logLabel: string,
  sessionId: string,
  streamKey: string,
  system: string,
  user: string,
  model: string,
  callbacks?: SyncroLlmHourCallbacks,
  signal?: AbortSignal,
): Promise<string> {
  const openRouterUrl = "https://openrouter.ai/api/v1/chat/completions";

  callbacks?.onConnecting?.();
  console.log(`[syncro-llm-batch] ${logLabel} start fetch, model=${model}`);

  let llmRes = await fetch(openRouterUrl, {
    method: "POST",
    headers: openRouterHeaders(),
    body: JSON.stringify(buildOpenRouterBody(model, system, user, true)),
    signal,
  });

  if (!llmRes.ok && llmRes.status >= 400 && llmRes.status < 500) {
    llmRes = await fetch(openRouterUrl, {
      method: "POST",
      headers: openRouterHeaders(),
      body: JSON.stringify(buildOpenRouterBody(model, system, user, false)),
      signal,
    });
  }

  if (!llmRes.ok || !llmRes.body) {
    const errText = await llmRes.text().catch(() => "unknown");
    throw new SyncroLlmHttpError(
      llmRes.status,
      errText.slice(0, 200),
      llmRes.status === 429 || llmRes.status >= 500,
    );
  }

  const reader = llmRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumContent = "";
  let inReasoning = false;
  let writingPhaseSent = false;

  callbacks?.onReasoning?.();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]" || !payload) continue;

      try {
        const parsed = JSON.parse(payload) as Record<string, unknown>;
        const choice = (parsed.choices as Array<Record<string, unknown>> | undefined)?.[0];
        const delta = choice?.delta as Record<string, unknown> | undefined;
        if (!delta) continue;

        const reasoningText = extractReasoningDelta(delta);
        if (reasoningText) {
          inReasoning = true;
          callbacks?.onReasoningChunk?.(reasoningText);
        }

        if (typeof delta.content === "string" && delta.content) {
          if (inReasoning) {
            inReasoning = false;
            if (!writingPhaseSent) {
              callbacks?.onWriting?.();
              writingPhaseSent = true;
            }
          } else if (!writingPhaseSent) {
            callbacks?.onWriting?.();
            writingPhaseSent = true;
          }
          accumContent += delta.content;
          callbacks?.onContentChunk?.(delta.content);
          void appendToStream(sessionId, streamKey, delta.content).catch(() => {});
        }
      } catch {
        // skip bad sse line
      }
    }
  }

  console.log(`[syncro-llm-batch] ${logLabel} done, content len=${accumContent.length}`);
  return accumContent;
}

/** Generate advice for 1–2 hours in one LLM call (16 cells max). */
export async function generateSyncroHoursAdvice(
  input: SyncroLlmHoursInput,
  callbacks?: SyncroLlmHourCallbacks,
  signal?: AbortSignal,
): Promise<SyncroLlmHoursResult> {
  const merged: Record<string, SyncroHourAdviceCell> = {};
  let allCached = true;

  for (const hour of input.hours) {
    const cached = await getCachedOutput(input.session_id, hour.hour_id);
    if (!cached) {
      allCached = false;
      break;
    }
    Object.assign(merged, cached);
  }

  if (allCached && Object.keys(merged).length > 0) {
    console.log(`[syncro-llm-batch] ${pairLabel(input.hours.map((h) => h.hour_id))} cache hit`);
    return { advice: merged, raw_content: "", from_cache: true };
  }

  const { system, user } = buildPromptForHours(input);
  const model = getOpenRouterDefaultModel();
  const label = pairLabel(input.hours.map((h) => h.hour_id));

  await cacheLlmInput(input.session_id, label, { system, user, model });

  const accumContent = await streamOpenRouter(
    label,
    input.session_id,
    label,
    system,
    user,
    model,
    callbacks,
    signal,
  );

  const adviceByKey = parseAdviceByHourJson(accumContent, input);
  await splitAndCachePerHour(input.session_id, input, adviceByKey);

  return {
    advice: adviceByKey,
    raw_content: accumContent,
    from_cache: false,
  };
}

export function buildSyncroLlmHoursInput(
  sessionId: string,
  hourIds: HourPeriod[],
  ctx: SyncroLlmContext,
): SyncroLlmHoursInput {
  const locale = ctx.locale;
  return {
    session_id: sessionId,
    hours: hourIds.map((hourId) => ({
      hour_id: hourId,
      hour_label: hourPeriodDisplayName(hourId, locale),
      hour_range: HOUR_PERIOD_RANGES[hourId],
      cells: cellsForHourFromContext(ctx, hourId).map((cell) => {
        const local = ctx.local_matrix[cell.key];
        const hints = local?._internal?.key_factors;
        return {
          ...cell,
          key_hints: hints?.length ? hints : undefined,
        };
      }),
    })),
    task_description: ctx.task_description,
    profile_summary:
      typeof ctx.base_analysis === "string"
        ? ctx.base_analysis.slice(0, 4000)
        : (() => {
            try {
              return JSON.stringify(ctx.base_analysis).slice(0, 4000);
            } catch {
              return ctx.task_description;
            }
          })(),
    locale,
  };
}

/** Single-hour wrapper (stream_hour API). */
export async function generateSyncroHourAdviceFromBatch(
  single: import("@/lib/syncro/syncro-llm-core").SyncroLlmHourInput,
  callbacks?: SyncroLlmHourCallbacks,
  signal?: AbortSignal,
): Promise<SyncroLlmHourResult> {
  const result = await generateSyncroHoursAdvice(
    {
      session_id: single.session_id,
      hours: [
        {
          hour_id: single.hour_id as HourPeriod,
          hour_label: single.hour_label,
          hour_range: single.hour_range,
          cells: single.cells,
        },
      ],
      task_description: single.task_description,
      profile_summary: single.profile_summary,
      locale: single.locale,
    },
    callbacks,
    signal,
  );
  return result;
}
