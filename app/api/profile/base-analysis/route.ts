import { NextResponse } from "next/server";
import { saveBaseAnalysisAudit } from "@/lib/dev/base-analysis-audit";
import { parseBaseAnalysisAuditBody } from "@/lib/dev/parse-base-analysis-audit-body";
import {
  BASE_ANALYSIS_MAX_TOKENS,
  baseAnalysisReasoningEffort,
} from "@/lib/llm/base-analysis-reasoning";
import { buildBaseAnalysisPrompt, parseBaseAnalysisResponseText } from "@/lib/llm/deepseek/base-analysis";
import { callLLM } from "@/lib/llm/router";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";

export const maxDuration = 300;
export const runtime = "nodejs";

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

    const body = (await req.json().catch(() => ({}))) as unknown;
    const parsed = parseBaseAnalysisAuditBody(body);
    if (!parsed) {
      return NextResponse.json({ ok: false, error: "Invalid or missing user_profile" }, { status: 400 });
    }
    const { user_profile: profile, stored_profile_id, display_name } = parsed;
    const loc = profile.birth?.birth_location;
    if (!loc?.longitude || loc.use_defaults) {
      return NextResponse.json(
        { ok: false, error: "birth_location_required", message: "Profile chart must include birth city coordinates." },
        { status: 400 },
      );
    }
    const { system, user } = buildBaseAnalysisPrompt(profile);

    const llmStart = Date.now();
    console.log("[base-analysis] LLM call start", {
      profile_id: stored_profile_id ?? profile.id,
      thinking: baseAnalysisReasoningEffort(),
      max_tokens: BASE_ANALYSIS_MAX_TOKENS,
    });

    const result = await callLLM({
      call_type: "deep_analysis",
      system,
      messages: [{ role: "user", content: user }],
      max_tokens: BASE_ANALYSIS_MAX_TOKENS,
      thinking_effort: baseAnalysisReasoningEffort(),
      response_format: "json",
    });

    console.log("[base-analysis] LLM call end", {
      duration_ms: Date.now() - llmStart,
      tokens: result.meta.tokens_used,
      model: result.actual_model,
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

    let auditId: string | null = null;
    try {
      const audit = await saveBaseAnalysisAudit({
        user_profile: profile,
        prompts: { system, user },
        analysis,
        model: result.actual_model,
        tokens_used: result.meta.tokens_used,
        stored_profile_id,
        display_name,
        latency_ms: result.meta.latency_ms,
        cost_usd: result.meta.cost_usd,
        raw_model_text: result.content,
      });
      auditId = audit?.id ?? null;
    } catch (auditErr) {
      console.warn("[base-analysis] Audit save skipped:", auditErr);
    }

    return NextResponse.json({
      ok: true,
      analysis,
      model: result.actual_model,
      tokens_used: result.meta.tokens_used,
      latency_ms: result.meta.latency_ms,
      cost_usd: result.meta.cost_usd,
      audit_id: auditId,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Base analysis failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
