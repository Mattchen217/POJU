import { NextResponse } from "next/server";
import { pojuCacheSessionId } from "@/lib/llm/cache-session-id";
import {
  buildFinalDeliveryPrompt,
  extractActionsFromDelivery,
  resolveDeliveryMode,
} from "@/lib/llm/pro/final-delivery";
import { callLLM } from "@/lib/llm/router";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
import { sanitizeDeliveryText } from "@/lib/llm/sanitize/compliance-terms";
import { polishDeliveryGrammar } from "@/lib/llm/sanitize/delivery-grammar-polish";
import type { BreakthroughCore, POJUAgentState } from "@/lib/poju/agent-state";
import { normalizeAgentPhase } from "@/lib/poju/agent-state";

export const maxDuration = 300;

function isRecord(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === "object" && !Array.isArray(x);
}

function isLooseAgentState(x: unknown): x is POJUAgentState {
  if (!isRecord(x)) return false;
  if (typeof x.current_phase !== "string" || !normalizeAgentPhase(x.current_phase)) return false;
  if (typeof x.original_question !== "string") return false;
  if (!isRecord(x.context_collected)) return false;
  return true;
}

function isBreakthroughCore(x: unknown): x is BreakthroughCore {
  if (!isRecord(x)) return false;
  if (typeof x.relationship_conclusion !== "string") return false;
  if (!Array.isArray(x.breakthrough_directions)) return false;
  return true;
}

/**
 * Body: `{ agent_v2, locale, base_analysis?, breakthrough_core, covered_agenda?, recent_user_messages? }`
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
      session_id?: unknown;
      agent_v2?: unknown;
      locale?: unknown;
      base_analysis?: unknown;
      breakthrough_core?: unknown;
      covered_agenda?: unknown;
      recent_user_messages?: unknown;
      delivery_mode?: unknown;
    };

    if (!isLooseAgentState(body.agent_v2)) {
      return NextResponse.json({ ok: false, error: "Invalid or missing agent_v2" }, { status: 400 });
    }

    const delivery_mode = resolveDeliveryMode({
      delivery_mode:
        body.delivery_mode === "degraded" || body.delivery_mode === "full" ? body.delivery_mode : null,
      agent_v2: body.agent_v2,
    });

    const breakthrough_core =
      body.breakthrough_core === undefined || body.breakthrough_core === null
        ? null
        : isBreakthroughCore(body.breakthrough_core)
          ? body.breakthrough_core
          : null;

    if (delivery_mode === "full" && !breakthrough_core) {
      return NextResponse.json({ ok: false, error: "Missing breakthrough_core" }, { status: 400 });
    }

    const locale = typeof body.locale === "string" ? body.locale : "en";
    const base_analysis = body.base_analysis === undefined || body.base_analysis === null ? null : body.base_analysis;
    const recent_user_messages = Array.isArray(body.recent_user_messages)
      ? body.recent_user_messages.filter((m): m is string => typeof m === "string" && m.trim().length > 0)
      : [];
    const covered_agenda = Array.isArray(body.covered_agenda)
      ? body.covered_agenda
          .filter((e): e is { label: string; answer?: string } => isRecord(e) && typeof e.label === "string")
          .map((e) => ({
            label: e.label,
            answer: typeof e.answer === "string" ? e.answer : undefined,
          }))
      : [];

    const { system, user } = buildFinalDeliveryPrompt({
      base_analysis,
      breakthrough_core,
      covered_agenda,
      agent_v2: body.agent_v2,
      locale,
      recent_user_messages,
      delivery_mode,
    });

    const t0 = Date.now();
    const sessionId =
      typeof body.session_id === "string" && body.session_id.trim()
        ? pojuCacheSessionId(body.session_id.trim())
        : undefined;

    const result = await callLLM({
      call_type: "main_delivery",
      system,
      messages: [{ role: "user", content: user }],
      max_tokens: 16_000,
      thinking_effort: "xhigh",
      timeout_ms: 180_000,
      response_format: "text",
      session_id: sessionId,
      temperature: 0.55,
    });

    const polished = polishDeliveryGrammar(result.content.trim(), locale);
    const text = sanitizeDeliveryText(polished.text, locale);

    const actions = extractActionsFromDelivery(text, null);
    const latency_ms = result.meta.latency_ms || Date.now() - t0;

    return NextResponse.json({
      ok: true,
      full_text: text,
      actions,
      model: result.actual_model,
      tokens_used: result.meta.tokens_used,
      latency_ms,
      cost_usd: result.meta.cost_usd,
      delivery_mode,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "final_delivery_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
