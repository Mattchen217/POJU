import { NextResponse } from "next/server";
import { pojuCacheSessionId } from "@/lib/llm/cache-session-id";
import {
  extractActionsFromDelivery,
  resolveDeliveryMode,
} from "@/lib/llm/pro/final-delivery";
import { runDeliveryReport } from "@/lib/llm/pro/delivery/run-delivery-report";
import { enrichLlmDebugPhaseTransition } from "@/lib/llm/llm-debug";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
import type { BreakthroughCore, POJUAgentState } from "@/lib/poju/agent-state";
import { normalizeAgentPhase } from "@/lib/poju/agent-state";
import { getServerUser } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import { assertAndConsumePass, isPassEnforceEnabled } from "@/lib/passes/consume-pass";

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
  if (typeof x.situation_conclusion !== "string") return false;
  if (!Array.isArray(x.modern_action_frames)) return false;
  if (!isRecord(x.key_crossroads)) return false;
  if (!isRecord(x.energy_retune_frame)) return false;
  if (!isRecord(x.rhythm_frame)) return false;
  if (!Array.isArray(x.self_check_signals)) return false;
  return true;
}

/**
 * Body: `{ agent_v2, locale, base_analysis?, breakthrough_core, covered_agenda?, recent_user_messages? }`
 * Phase 4: multi-task finalize → narrative∥evidence → merge (6-section dual-layer).
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
      /** QA: re-run delivery without consuming another pass. */
      regenerate?: unknown;
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
    const covered_agenda = Array.isArray(body.covered_agenda)
      ? body.covered_agenda
          .filter((e): e is { label: string; answer?: string } => isRecord(e) && typeof e.label === "string")
          .map((e) => ({
            label: e.label,
            answer: typeof e.answer === "string" ? e.answer : undefined,
          }))
      : [];

    const sessionIdRaw =
      typeof body.session_id === "string" && body.session_id.trim() ? body.session_id.trim() : "";

    const skipPass = body.regenerate === true;

    if (!skipPass && isPassEnforceEnabled("pivot") && isSupabaseConfigured()) {
      const user = await getServerUser();
      if (!user?.id) {
        return NextResponse.json(
          { ok: false, error: "pass_login_required", reason: "unauthorized" },
          { status: 401 },
        );
      }
      const refId = sessionIdRaw || `pivot-delivery-${user.id}-${Date.now()}`;
      const consumed = await assertAndConsumePass({
        userId: user.id,
        product: "pivot",
        refId,
        description: "Pivot full delivery",
      });
      if (!consumed.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: "pass_required",
            reason: consumed.reason ?? "insufficient_balance",
            balance_after: consumed.balanceAfter ?? 0,
          },
          { status: 402 },
        );
      }
    }

    const t0 = Date.now();
    const sessionId = sessionIdRaw ? pojuCacheSessionId(sessionIdRaw) : undefined;

    const report = await runDeliveryReport({
      breakthrough_core,
      covered_agenda,
      agent_v2: body.agent_v2,
      locale,
      delivery_mode,
      base_analysis: body.base_analysis ?? null,
      session_id: sessionId,
    });

    if (!report.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `delivery_${report.stage}_failed`,
          reason: report.reason,
          timings: report.timings,
        },
        { status: 502 },
      );
    }

    const actions = extractActionsFromDelivery(report.full_text, null);
    const latency_ms = Date.now() - t0;
    const llm_debug = enrichLlmDebugPhaseTransition(
      {
        phase: "final_delivery",
        requested_effort: "xhigh",
        max_tokens: 16_000,
        reasoning_budget: 0,
        model: report.model,
        prompt_tokens: 0,
        cached_tokens: 0,
        cache_ratio: 0,
        completion_tokens: 0,
        reasoning_tokens: 0,
        reasoning_used_ratio: 0,
        latency_ms,
        attempt: 1,
        retried: false,
        fell_back: false,
      },
      {
        phase_from: body.agent_v2.current_phase,
        phase_to: "delivered",
        call_type: "main_delivery",
      },
    );

    return NextResponse.json({
      ok: true,
      full_text: report.full_text,
      actions,
      model: report.model,
      tokens_used: report.tokens_used,
      latency_ms,
      cost_usd: 0,
      llm_debug,
      timings: report.timings,
    });
  } catch (e) {
    console.error("[final-delivery]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "final-delivery failed" },
      { status: 500 },
    );
  }
}
