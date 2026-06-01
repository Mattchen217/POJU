import { NextResponse } from "next/server";

import { callLLM } from "@/lib/llm/router";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
import { parseAppLocale } from "@/lib/prompts/language-directive";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

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

export async function POST(req: Request) {
  const startTime = Date.now();

  if (!isOpenRouterConfigured()) {
    return NextResponse.json(
      { error: "missing_openrouter", message: "OPENROUTER_API_KEY not configured." },
      { status: 503 },
    );
  }

  let body: LlmHourBody;
  try {
    body = (await req.json()) as LlmHourBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const hourId = body.hour_id?.trim();
  if (!hourId || !body.cells?.length || !body.task_description?.trim()) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const locale = parseAppLocale(body.locale ?? "en");
  const langInstruction =
    locale === "zh" ? "用简体中文输出。" : "Output in English.";

  console.log(`[llm_hour] ${hourId} start, cells=${body.cells.length}`);

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
    const llm = await callLLM({
      call_type: "syncro_batch",
      system,
      messages: [{ role: "user", content: userMsg }],
      max_tokens: 3500,
      temperature: 0.7,
      response_format: "json",
      timeout_ms: 55_000,
    });

    const raw = llm.content?.trim();
    if (!raw) {
      console.error(`[llm_hour] ${hourId} no content`);
      return NextResponse.json({ error: "no_content" }, { status: 500 });
    }

    let parsed: { advice?: Record<string, { short?: string; detailed?: string; rationale?: string }> };
    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      console.error(`[llm_hour] ${hourId} JSON parse failed:`, raw.slice(0, 200));
      return NextResponse.json({ error: "parse_failed" }, { status: 500 });
    }

    if (!parsed.advice) {
      return NextResponse.json({ error: "missing_advice" }, { status: 500 });
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
      `[llm_hour] ${hourId} done in ${elapsed}ms, cells=${Object.keys(adviceByKey).length}/8`,
    );

    return NextResponse.json({
      success: true,
      hour_id: hourId,
      advice: adviceByKey,
      elapsed_ms: elapsed,
      model: llm.actual_model,
      tokens_used: llm.meta.tokens_used ?? 0,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[llm_hour] ${hourId} exception:`, message);
    return NextResponse.json({ error: "exception", message }, { status: 500 });
  }
}
