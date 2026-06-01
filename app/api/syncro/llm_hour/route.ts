import { NextResponse } from "next/server";

import { callLLM } from "@/lib/llm/router";
import {
  getOpenRouterDefaultModel,
  isOpenRouterConfigured,
} from "@/lib/llm/openrouter-shared";
import { parseAppLocale } from "@/lib/prompts/language-directive";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const LLM_TIMEOUT_MS = 55_000;

type LlmHourBody = {
  hour_id?: string;
  hour_label?: string;
  hour_range?: string;
  cells?: Array<{
    key: string;
    direction: string;
    current_level: string;
  }>;
  task_description?: string;
  profile_summary?: string;
  locale?: string;
};

function logLlmHourFailure(
  body: LlmHourBody,
  hourId: string,
  model: string,
  details: Record<string, unknown>,
) {
  console.error("═══ [llm_hour] LLM CALL FAILED ═══");
  console.error("Session:", "(inline request)");
  console.error("Hour:", hourId);
  for (const [k, v] of Object.entries(details)) {
    console.error(`${k}:`, v);
  }
  console.error("Model:", model);
  console.error(
    "Input tokens estimate:",
    (body.cells?.length ?? 0) * 50 + 500,
  );
  console.error("═══════════════════════════════════");
}

function logJsonParseFailed(hourId: string, content: string) {
  console.error("═══ [llm_hour] JSON PARSE FAILED ═══");
  console.error("Hour:", hourId);
  console.error("Raw content:", content.slice(0, 500));
  console.error("═══════════════════════════════════");
}

function parseHttpStatusFromError(message: string): number | null {
  const m = message.match(/openrouter_http_(\d+)/);
  return m ? Number(m[1]) : null;
}

export async function POST(req: Request) {
  const startTime = Date.now();
  const model = getOpenRouterDefaultModel();

  if (!isOpenRouterConfigured()) {
    console.error("═══ [llm_hour] LLM CALL FAILED ═══");
    console.error("Reason: OPENROUTER_API_KEY not configured");
    console.error("Model:", model);
    console.error("═══════════════════════════════════");
    return NextResponse.json(
      {
        error: "missing_openrouter",
        message: "OPENROUTER_API_KEY not configured.",
        retryable: false,
      },
      { status: 503 },
    );
  }

  let body: LlmHourBody;
  try {
    body = (await req.json()) as LlmHourBody;
  } catch {
    return NextResponse.json({ error: "invalid_json", retryable: false }, { status: 400 });
  }

  const hourId = body.hour_id?.trim();
  if (!hourId || !body.cells?.length || !body.task_description?.trim()) {
    return NextResponse.json({ error: "invalid_request", retryable: false }, { status: 400 });
  }

  const locale = parseAppLocale(body.locale ?? "en");
  const langInstruction =
    locale === "zh" ? "用简体中文输出。" : "Output in English.";

  console.log(`[llm_hour] ${hourId} start, cells=${body.cells.length}, model=${model}`);

  const system = `You are Syncro analyzer. For the given hour and 8 directions, generate practical guidance.

# User task
"${body.task_description.trim()}"

# Output JSON ONLY - no preamble, no explanation:
{
  "advice": {
    "N": {
      "short": "<50-80 chars,one-sentence direct advice>",
      "detailed": "<150-200 chars,2-3 sentences action advice>",
      "rationale": "<100-150 chars,why this for the user's task>"
    },
    "NE": { ... },
    "E": { ... },
    "SE": { ... },
    "S": { ... },
    "SW": { ... },
    "W": { ... },
    "NW": { ... }
  }
}

# Rules
${langInstruction}
- All 8 directions MUST be included
- DO NOT use: astrology, divination, fortune-telling, 占卜, 算命, 命理
- Use: pojulife / reading / analysis / 解读 / 分析`;

  const userMsg = `Hour: ${body.hour_label ?? hourId} (${body.hour_range ?? ""})

The 8 directions for this hour have these current levels (already computed):
${body.cells.map((c) => `  ${c.direction}: ${c.current_level}`).join("\n")}

Profile context: ${(body.profile_summary ?? "").slice(0, 4000)}

Generate advice for all 8 directions. Output JSON only.`;

  try {
    console.log(`[llm_hour] Using model: ${model}`);
    const llm = await callLLM({
      call_type: "syncro_batch",
      system,
      messages: [{ role: "user", content: userMsg }],
      max_tokens: 3500,
      temperature: 0.7,
      response_format: "json",
      timeout_ms: LLM_TIMEOUT_MS,
    });

    const raw = llm.content?.trim();
    if (!raw) {
      logLlmHourFailure(body, hourId, model, {
        "HTTP Status": "no_content",
        Response: "(empty LLM content)",
      });
      return NextResponse.json({ error: "no_content", retryable: true }, { status: 500 });
    }

    let parsed: { advice?: Record<string, { short?: string; detailed?: string; rationale?: string }> };
    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      logJsonParseFailed(hourId, raw);
      return NextResponse.json(
        {
          error: "parse_failed",
          detail: `LLM 输出非合法 JSON: ${raw.slice(0, 100)}`,
          retryable: true,
        },
        { status: 500 },
      );
    }

    if (!parsed.advice) {
      logLlmHourFailure(body, hourId, model, {
        "HTTP Status": "missing_advice",
        Response: raw.slice(0, 800),
      });
      return NextResponse.json({ error: "missing_advice", retryable: true }, { status: 500 });
    }

    const adviceByKey: Record<
      string,
      { short_advice: string; detailed_advice: string; rationale: string }
    > = {};

    for (const cell of body.cells) {
      const dirAdvice = parsed.advice[cell.direction];
      if (!dirAdvice) continue;
      adviceByKey[cell.key] = {
        short_advice: (dirAdvice.short ?? "").trim(),
        detailed_advice: (dirAdvice.detailed ?? "").trim(),
        rationale: (dirAdvice.rationale ?? "").trim(),
      };
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `[llm_hour] ${hourId} done in ${elapsed}ms, cells=${Object.keys(adviceByKey).length}/8, model=${llm.actual_model ?? model}`,
    );

    return NextResponse.json({
      success: true,
      hour_id: hourId,
      advice: adviceByKey,
      elapsed_ms: elapsed,
      model: llm.actual_model ?? model,
      tokens_used: llm.meta.tokens_used ?? 0,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const httpStatus = parseHttpStatusFromError(message);
    const errText = message.includes(":") ? message.split(":").slice(1).join(":").trim() : message;

    logLlmHourFailure(body, hourId, model, {
      "HTTP Status": httpStatus ?? "exception",
      Response: errText.slice(0, 800),
      Exception: message,
    });

    const retryable =
      message.includes("timeout") ||
      message.includes("llm_timeout") ||
      message.includes("429") ||
      (httpStatus !== null && (httpStatus === 429 || httpStatus >= 500));

    return NextResponse.json(
      {
        error: httpStatus ? "llm_http_error" : "exception",
        status: httpStatus,
        message,
        retryable,
      },
      { status: 500 },
    );
  }
}
