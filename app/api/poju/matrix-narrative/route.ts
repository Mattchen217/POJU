import { NextResponse } from "next/server";
import { getBaziChart } from "shunshi-bazi-core";

import {
  buildMatrixNarrativeInput,
  buildMatrixNarrativeUserMessage,
  MATRIX_NARRATIVE_SYSTEM_PROMPT,
  parseMatrixNarrativeResponseText,
} from "@/lib/llm/prompts/matrix-narrative-prompt";
import { callLLM } from "@/lib/llm/router";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import { shunshiParamsFromBirthInfo } from "@/lib/profile/birth-info-utils";

export const maxDuration = 60;

function isMatrixPayload(x: unknown): x is PojuMatrixPayload {
  if (!x || typeof x !== "object") return false;
  const p = x as PojuMatrixPayload;
  return Boolean(p.user_profile?.birth && p.structured && p.wuxing_scores);
}

export async function POST(req: Request) {
  try {
    if (!isOpenRouterConfigured()) {
      return NextResponse.json(
        { ok: false, error: "OpenRouter is not configured (OPENROUTER_API_KEY)." },
        { status: 503 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      matrix_payload?: unknown;
      locale?: unknown;
    };

    if (!isMatrixPayload(body.matrix_payload)) {
      return NextResponse.json({ ok: false, error: "Invalid matrix_payload" }, { status: 400 });
    }

    const locale = typeof body.locale === "string" ? body.locale : "en";
    const payload = body.matrix_payload;

    const params = shunshiParamsFromBirthInfo(payload.user_profile.birth);
    const chart = getBaziChart({
      year: params.year,
      month: params.month,
      day: params.day,
      hour: params.hour,
      minute: params.minute,
      gender: params.gender,
      city: params.city,
      latitude: params.latitude,
      longitude: params.longitude,
      standardMeridian: params.standardMeridian,
      useTrueSolarTime: true,
      sect: 1,
    });

    const narrativeInput = buildMatrixNarrativeInput(payload, chart, locale);
    const userMessage = buildMatrixNarrativeUserMessage(narrativeInput);

    const result = await callLLM({
      call_type: "matrix_narrative",
      system: MATRIX_NARRATIVE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
      max_tokens: 1800,
      thinking_effort: "off",
      response_format: "json",
      temperature: 0.65,
      timeout_ms: 45_000,
    });

    let narrative;
    try {
      narrative = parseMatrixNarrativeResponseText(result.content);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "Model output is not valid JSON",
          preview: result.content.slice(0, 400),
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      narrative,
      model: result.actual_model,
      tokens_used: result.meta.tokens_used,
      latency_ms: result.meta.latency_ms,
      cost_usd: result.meta.cost_usd,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Matrix narrative failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
