import { NextResponse } from "next/server";
import { getBaziChart } from "shunshi-bazi-core";

import { matrixNarrativeCacheSessionId } from "@/lib/llm/cache-session-id";
import {
  buildMatrixNarrativeInput,
  buildMatrixNarrativeUserMessage,
  getMatrixNarrativeSystemPrompt,
  parseMatrixNarrativeResponseText,
  type MatrixNarrativeProduct,
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

function parseProduct(x: unknown): MatrixNarrativeProduct {
  if (x === "glyph" || x === "match" || x === "syncro" || x === "poju") return x;
  return "poju";
}

function chartForPayload(payload: PojuMatrixPayload) {
  const params = shunshiParamsFromBirthInfo(payload.user_profile.birth);
  return getBaziChart({
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
      matrix_payload_b?: unknown;
      locale?: unknown;
      product?: unknown;
    };

    if (!isMatrixPayload(body.matrix_payload)) {
      return NextResponse.json({ ok: false, error: "Invalid matrix_payload" }, { status: 400 });
    }

    const locale = typeof body.locale === "string" ? body.locale : "en";
    const product = parseProduct(body.product);
    const payload = body.matrix_payload;

    if (product === "match" && !isMatrixPayload(body.matrix_payload_b)) {
      return NextResponse.json({ ok: false, error: "match requires matrix_payload_b" }, { status: 400 });
    }

    const chartA = chartForPayload(payload);
    const narrativeInputA = buildMatrixNarrativeInput(payload, chartA, locale);

    let userMessage: string;
    if (product === "match" && isMatrixPayload(body.matrix_payload_b)) {
      const chartB = chartForPayload(body.matrix_payload_b);
      const narrativeInputB = buildMatrixNarrativeInput(body.matrix_payload_b, chartB, locale);
      userMessage = buildMatrixNarrativeUserMessage(narrativeInputA, {
        product: "match",
        inputB: narrativeInputB,
      });
    } else {
      userMessage = buildMatrixNarrativeUserMessage(narrativeInputA, { product });
    }

    const result = await callLLM({
      call_type: "matrix_narrative",
      system: getMatrixNarrativeSystemPrompt(product),
      messages: [{ role: "user", content: userMessage }],
      max_tokens: product === "match" ? 2800 : 2400,
      thinking_effort: "off",
      response_format: "json",
      temperature: 0.65,
      timeout_ms: 45_000,
      session_id: matrixNarrativeCacheSessionId(product, locale),
    });

    let narrative;
    try {
      narrative = parseMatrixNarrativeResponseText(result.content, product);
    } catch (parseError) {
      const rawPreview = result.content.replace(/\s+/g, " ").trim().slice(0, 400);
      console.warn(
        "[matrix-narrative] parse failed",
        JSON.stringify({
          product,
          finish_reason: result.meta.finish_reason ?? "—",
          output_tokens: result.meta.completion_tokens ?? null,
          raw_preview: rawPreview,
          error: parseError instanceof Error ? parseError.message : "parse failed",
        }),
      );
      return NextResponse.json(
        {
          ok: false,
          error: "Model output is not valid JSON",
          preview: result.content.slice(0, 400),
          finish_reason: result.meta.finish_reason ?? null,
          output_tokens: result.meta.completion_tokens ?? null,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      narrative,
      product,
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
