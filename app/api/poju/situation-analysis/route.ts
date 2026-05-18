import { NextResponse } from "next/server";
import { buildSituationAnalysisPrompt, parseSituationAnalysisResponseText } from "@/lib/llm/deepseek/situation-analysis";
import { callLLM } from "@/lib/llm/router";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
import { computeSituationContextFingerprint } from "@/lib/poju/situation-context-fingerprint";
import { normalizeAgentPhase, type POJUAgentState } from "@/lib/poju/agent-state";

export const maxDuration = 180;

function isRecord(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === "object" && !Array.isArray(x);
}

function isLooseAgentState(x: unknown): x is POJUAgentState {
  if (!isRecord(x)) return false;
  if (typeof x.current_phase !== "string" || !normalizeAgentPhase(x.current_phase)) return false;
  if (!isRecord(x.context_collected)) return false;
  return true;
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
      session_id?: unknown;
      original_question?: unknown;
      agent_v2?: unknown;
      context_collected?: unknown;
      base_analysis?: unknown;
      locale?: unknown;
      context_fingerprint?: unknown;
    };

    if (typeof body.session_id !== "string" || !body.session_id.trim()) {
      return NextResponse.json({ ok: false, error: "Missing session_id" }, { status: 400 });
    }
    if (typeof body.original_question !== "string") {
      return NextResponse.json({ ok: false, error: "Missing original_question" }, { status: 400 });
    }

    let agent_v2 = body.agent_v2 === null || body.agent_v2 === undefined ? null : body.agent_v2;
    if (agent_v2 !== null && !isLooseAgentState(agent_v2)) {
      agent_v2 = null;
    }

    const context_collected =
      body.context_collected && typeof body.context_collected === "object" && !Array.isArray(body.context_collected)
        ? (body.context_collected as Record<string, unknown>)
        : {};

    const fingerprint = await computeSituationContextFingerprint({
      session_id: body.session_id.trim(),
      original_question: body.original_question,
      agent_v2: agent_v2 ?? undefined,
      context_collected,
    });

    if (typeof body.context_fingerprint === "string" && body.context_fingerprint.length > 0) {
      if (body.context_fingerprint !== fingerprint) {
        return NextResponse.json(
          { ok: false, error: "context_fingerprint mismatch; client must use canonical fingerprint." },
          { status: 400 },
        );
      }
    }

    const base_analysis =
      body.base_analysis === undefined || body.base_analysis === null ? null : body.base_analysis;

    const locale = typeof body.locale === "string" ? body.locale : "en";

    const { system, user } = buildSituationAnalysisPrompt({
      base_analysis,
      agent_v2: agent_v2 ?? undefined,
      original_question: body.original_question,
      locale,
    });

    const result = await callLLM({
      call_type: "deep_analysis",
      system,
      messages: [{ role: "user", content: user }],
      max_tokens: 15000,
      response_format: "json",
    });

    let analysis: unknown;
    try {
      analysis = parseSituationAnalysisResponseText(result.content);
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
      analysis,
      model: result.actual_model,
      tokens_used: result.meta.tokens_used,
      latency_ms: result.meta.latency_ms,
      cost_usd: result.meta.cost_usd,
      fingerprint,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Situation analysis failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
