import { NextResponse } from "next/server";
import { buildBaseAnalysisPrompt, parseBaseAnalysisResponseText } from "@/lib/llm/deepseek/base-analysis";
import { callLLM } from "@/lib/llm/router";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
import type { UserProfile } from "@/lib/profile/types";

export const maxDuration = 180;

function isRecord(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === "object" && !Array.isArray(x);
}

function isUserProfile(x: unknown): x is UserProfile {
  if (!isRecord(x)) return false;
  if (typeof x.id !== "string") return false;
  if (!isRecord(x.birth)) return false;
  if (typeof x.birth.year !== "number" || typeof x.birth.month !== "number" || typeof x.birth.day !== "number")
    return false;
  if (typeof x.birth.hour !== "number") return false;
  if (x.birth.gender !== "male" && x.birth.gender !== "female" && x.birth.gender !== "other") return false;
  if (!isRecord(x.bazi)) return false;
  const z = x.bazi;
  if (typeof z.yearPillar !== "string" || typeof z.monthPillar !== "string") return false;
  if (typeof z.dayPillar !== "string" || typeof z.hourPillar !== "string") return false;
  if (!isRecord(x.diagnosis)) return false;
  if (typeof x.diagnosis.dayMaster !== "string") return false;
  if (!Array.isArray(x.diagnosis.favorableElements) || !Array.isArray(x.diagnosis.challengingElements)) return false;
  if (typeof x.diagnosis.patternSummary !== "string") return false;
  if (x.source !== "shunshi" && x.source !== "fallback") return false;
  return true;
}

/**
 * Body: `{ user_profile: UserProfile }` — caller loads from IndexedDB and sends the computed chart.
 */
export async function POST(req: Request) {
  try {
    if (!isOpenRouterConfigured()) {
      return NextResponse.json(
        { ok: false, error: "OpenRouter is not configured (OPENROUTER_API_KEY)." },
        { status: 503 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as { user_profile?: unknown };
    if (!isUserProfile(body.user_profile)) {
      return NextResponse.json({ ok: false, error: "Invalid or missing user_profile" }, { status: 400 });
    }

    const profile = body.user_profile;
    const { system, user } = buildBaseAnalysisPrompt(profile);

    const result = await callLLM({
      call_type: "deep_analysis",
      system,
      messages: [{ role: "user", content: user }],
      max_tokens: 15000,
      response_format: "json",
    });

    let analysis: unknown;
    try {
      analysis = parseBaseAnalysisResponseText(result.content);
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
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Base analysis failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
