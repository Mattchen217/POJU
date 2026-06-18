import { getOpenRouterDefaultModel } from "@/lib/llm/openrouter-shared";
import {
  buildSyncroBatchPromptForHours,
  resolveSyncroBatchOutputLocale,
} from "@/lib/syncro/syncro-batch-prompt";
import { buildTopWindowsMatrixSummary } from "@/lib/llm/prompts/syncro-deepseek-prompt";
import { parseSyncroTaskResponse } from "@/lib/llm/services/syncro-reading-service";
import { buildSyncroProfileSummary } from "@/lib/syncro/syncro-profile-summary";
import { sanitizeSyncroHourAdvice } from "@/lib/syncro/sanitize-output";
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
import type { HourPeriod, SyncroTaskResponse } from "@/lib/syncro/types";

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
  include_task_response?: boolean;
  local_matrix?: SyncroLlmContext["local_matrix"];
};

export type SyncroLlmHoursResult = {
  advice: Record<string, SyncroHourAdviceCell>;
  task_response?: SyncroTaskResponse;
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

function buildPromptForHours(input: SyncroLlmHoursInput): ReturnType<typeof buildSyncroBatchPromptForHours> {
  return buildSyncroBatchPromptForHours({
    hours: input.hours,
    task_description: input.task_description,
    profile_summary: input.profile_summary,
    locale: input.locale,
    include_task_response: input.include_task_response,
    full_matrix_summary:
      input.include_task_response && input.local_matrix
        ? buildTopWindowsMatrixSummary(input.local_matrix)
        : undefined,
  });
}

async function splitAndCachePerHour(
  sessionId: string,
  outputLocale: string,
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
      await cacheLlmOutput(sessionId, outputLocale, hour.hour_id, hourAdvice);
      await clearStream(sessionId, hour.hour_id);
    }
  }
}

function normalizeAdviceByHour(
  raw: Record<string, Record<string, DirectionAdvice>>,
  input: SyncroLlmHoursInput,
): Record<string, Record<string, DirectionAdvice>> {
  const expectedIds = input.hours.map((h) => h.hour_id);
  const normalized: Record<string, Record<string, DirectionAdvice>> = {};

  for (const hour of input.hours) {
    if (raw[hour.hour_id]) {
      normalized[hour.hour_id] = raw[hour.hour_id]!;
      continue;
    }
    const lower = hour.hour_id.toLowerCase();
    const matchKey = Object.keys(raw).find((k) => k.toLowerCase() === lower);
    if (matchKey) normalized[hour.hour_id] = raw[matchKey]!;
  }

  const missing = expectedIds.filter((id) => !normalized[id]);
  if (missing.length > 0) {
    const returned = Object.keys(raw);
    if (returned.length === expectedIds.length) {
      console.warn(
        `[syncro-llm-batch] hour_id positional fallback: expected [${expectedIds.join(", ")}], got keys [${returned.join(", ")}]`,
      );
      for (let i = 0; i < expectedIds.length; i++) {
        normalized[expectedIds[i]!] = raw[returned[i]!]!;
      }
      return normalized;
    }
    console.error(
      `[syncro-llm-batch] hour_id mismatch: expected [${expectedIds.join(", ")}], got [${returned.join(", ")}]`,
    );
    throw new SyncroParseError(
      JSON.stringify({ expected: expectedIds, returned }),
      `hour_id mismatch: expected ${expectedIds.join(",")}, got ${returned.join(",")}`,
    );
  }

  return normalized;
}

function parseAdviceByHourJson(
  accumContent: string,
  input: SyncroLlmHoursInput,
): { adviceByKey: Record<string, SyncroHourAdviceCell>; task_response?: SyncroTaskResponse } {
  const parsed = JSON.parse(accumContent) as {
    advice_by_hour?: Record<string, Record<string, DirectionAdvice>>;
    task_response?: unknown;
  };
  const byHourRaw = parsed.advice_by_hour;
  if (!byHourRaw) {
    throw new SyncroParseError(accumContent, "missing advice_by_hour field");
  }

  const byHour = normalizeAdviceByHour(byHourRaw, input);
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

  for (const hour of input.hours) {
    const need = hour.cells.length;
    const got = hour.cells.filter((c) => adviceByKey[c.key]?.short_advice?.trim()).length;
    if (got < need) {
      throw new SyncroParseError(
        accumContent,
        `incomplete hour ${hour.hour_id}: ${got}/${need} cells`,
      );
    }
  }

  if (Object.keys(adviceByKey).length === 0) {
    throw new SyncroParseError(accumContent, "no cell advice parsed");
  }

  console.log(
    `[syncro-llm-batch] parsed hours=[${input.hours.map((h) => h.hour_id).join(", ")}] cells=${Object.keys(adviceByKey).length}`,
  );

  return {
    adviceByKey,
    task_response: parseSyncroTaskResponse(parsed.task_response),
  };
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
  const outputLocale = resolveSyncroBatchOutputLocale(input.locale, input.task_description);
  const merged: Record<string, SyncroHourAdviceCell> = {};
  let allCached = true;

  for (const hour of input.hours) {
    const cached = await getCachedOutput(input.session_id, outputLocale, hour.hour_id);
    if (!cached) {
      allCached = false;
      break;
    }
    Object.assign(merged, cached);
  }

  if (allCached && Object.keys(merged).length > 0) {
    console.log(`[syncro-llm-batch] ${pairLabel(input.hours.map((h) => h.hour_id))} cache hit (${outputLocale})`);
    sanitizeSyncroHourAdvice(merged, outputLocale);
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

  const { adviceByKey, task_response } = parseAdviceByHourJson(accumContent, input);
  sanitizeSyncroHourAdvice(adviceByKey, outputLocale);
  await splitAndCachePerHour(input.session_id, outputLocale, input, adviceByKey);

  return {
    advice: adviceByKey,
    task_response,
    raw_content: accumContent,
    from_cache: false,
  };
}

export function buildSyncroLlmHoursInput(
  sessionId: string,
  hourIds: HourPeriod[],
  ctx: SyncroLlmContext,
  options?: { include_task_response?: boolean },
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
    profile_summary: buildSyncroProfileSummary(ctx.base_analysis, ctx.task_description),
    locale,
    include_task_response: options?.include_task_response,
    local_matrix: options?.include_task_response ? ctx.local_matrix : undefined,
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
