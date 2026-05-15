import { NextResponse } from "next/server";
import {
  buildFinalDeliveryPrompt,
  extractActionsFromDelivery,
} from "@/lib/llm/pro/final-delivery";
import { callLLM } from "@/lib/llm/router";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
import type { POJUAgentState } from "@/lib/poju/agent-state";

function isRecord(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === "object" && !Array.isArray(x);
}

function isLooseAgentState(x: unknown): x is POJUAgentState {
  if (!isRecord(x)) return false;
  const phases: POJUAgentState["current_phase"][] = [
    "greeting",
    "awaiting_profile",
    "collecting_context",
    "awaiting_confirmation",
    "delivered",
    "tracking",
  ];
  if (typeof x.current_phase !== "string" || !phases.includes(x.current_phase as POJUAgentState["current_phase"]))
    return false;
  if (typeof x.original_question !== "string") return false;
  if (!isRecord(x.context_collected)) return false;
  return true;
}

/**
 * Body: `{ agent_v2, locale, base_analysis?, situation_analysis, recent_user_messages? }`
 */
export async function POST(req: Request) {
  try {
    if (!isOpenRouterConfigured()) {
      return NextResponse.json(
        { ok: false, error: "OpenRouter is not configured (OPENROUTER_API_KEY)." },
        { status: 503 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      agent_v2?: unknown;
      locale?: unknown;
      base_analysis?: unknown;
      situation_analysis?: unknown;
      recent_user_messages?: unknown;
    };

    if (!isLooseAgentState(body.agent_v2)) {
      return NextResponse.json({ ok: false, error: "Invalid or missing agent_v2" }, { status: 400 });
    }
    if (body.situation_analysis === undefined || body.situation_analysis === null) {
      return NextResponse.json({ ok: false, error: "Missing situation_analysis" }, { status: 400 });
    }

    const locale = typeof body.locale === "string" ? body.locale : "en";
    const base_analysis = body.base_analysis === undefined || body.base_analysis === null ? null : body.base_analysis;
    const recent_user_messages = Array.isArray(body.recent_user_messages)
      ? body.recent_user_messages.filter((m): m is string => typeof m === "string" && m.trim().length > 0)
      : [];

    const { system, user } = buildFinalDeliveryPrompt({
      base_analysis,
      situation_analysis: body.situation_analysis,
      agent_v2: body.agent_v2,
      locale,
      recent_user_messages,
    });

    const t0 = Date.now();
    const result = await callLLM({
      call_type: "poju_final_delivery",
      system,
      messages: [{ role: "user", content: user }],
      max_tokens: 8000,
      thinking_effort: "high",
      response_format: "text",
    });

    const text = result.content.trim();
    const actions = extractActionsFromDelivery(text, body.situation_analysis);
    const latency_ms = Date.now() - t0;

    return NextResponse.json({
      ok: true,
      full_text: text,
      actions,
      model: result.actual_model,
      tokens_used: result.meta.tokens_used,
      latency_ms,
      cost_usd: 0,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "final_delivery_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
