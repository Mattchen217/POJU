import { after, NextResponse } from "next/server";

import {
  resolveDeliveryMode,
} from "@/lib/llm/pro/final-delivery";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
import type { BreakthroughCore, POJUAgentState } from "@/lib/poju/agent-state";
import { normalizeAgentPhase } from "@/lib/poju/agent-state";
import { getServerUser } from "@/lib/auth/supabase-server";
import { isSupabaseConfigured } from "@/lib/auth/supabase";
import { assertAndConsumePass, isPassEnforceEnabled } from "@/lib/passes/consume-pass";
import { runFinalDeliveryJob } from "@/lib/poju/final-delivery-job-runner";
import {
  acquireXhighSessionLock,
  createXhighJob,
  findLatestXhighJobForSession,
  getXhighJob,
  releaseXhighSessionLock,
} from "@/lib/poju/xhigh-job-store";
import {
  isFinalDeliveryJobInput,
  isFinalDeliveryJobResult,
  type FinalDeliveryJobInput,
  type PojuXhighJob,
} from "@/lib/poju/xhigh-job-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** If a running job has not progressed this long, allow a fresh job. */
const STALE_RUNNING_MS = 3 * 60 * 1000;

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

function jobStatusResponse(job: PojuXhighJob) {
  if (job.status === "completed" && isFinalDeliveryJobResult(job.result)) {
    return NextResponse.json({
      ok: true,
      job_id: job.job_id,
      status: job.status,
      full_text: job.result.full_text,
      actions: job.result.actions,
      model: job.result.model ?? job.model,
      tokens_used: job.result.tokens_used ?? job.tokens_used ?? 0,
      llm_debug: job.result.llm_debug ?? job.llm_debug,
      timings: job.result.timings,
      cost_usd: 0,
    });
  }
  if (job.status === "failed") {
    return NextResponse.json({
      ok: false,
      job_id: job.job_id,
      status: job.status,
      retryable: job.retryable ?? true,
      reason: job.failure_reason ?? "transport_error",
      error: job.error ?? "final delivery job failed",
    });
  }
  return NextResponse.json({
    ok: true,
    job_id: job.job_id,
    status: job.status,
    accumulated_content: job.accumulated_content,
  });
}

function scheduleFinalDeliveryJob(job_id: string, session_id: string): void {
  after(async () => {
    try {
      await runFinalDeliveryJob(job_id);
    } catch (e) {
      console.error("[final-delivery] background job failed:", e);
    } finally {
      await releaseXhighSessionLock("final_delivery", session_id);
    }
  });
}

/**
 * Phase 4 delivery — async xhigh job (same durability pattern as segment2).
 * POST creates/resumes a job; `after()` runs the multi-task pipeline even if the client leaves.
 * Poll GET /api/poju/final-delivery/status?job_id=… or POST with resume_job_id.
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
      regenerate?: unknown;
      resume_job_id?: unknown;
      /** When true, only look up latest job for session (no create). */
      resume_latest?: unknown;
    };

    if (typeof body.resume_job_id === "string" && body.resume_job_id.trim()) {
      const job = await getXhighJob(body.resume_job_id.trim());
      if (!job || job.phase !== "final_delivery") {
        return NextResponse.json({ ok: false, error: "job_not_found" }, { status: 404 });
      }
      return jobStatusResponse(job);
    }

    const sessionIdRaw =
      typeof body.session_id === "string" && body.session_id.trim() ? body.session_id.trim() : "";
    if (!sessionIdRaw) {
      return NextResponse.json({ ok: false, error: "Missing session_id" }, { status: 400 });
    }

    if (body.resume_latest === true) {
      const latest = await findLatestXhighJobForSession("final_delivery", sessionIdRaw);
      if (!latest) {
        return NextResponse.json({ ok: false, error: "no_job", status: "none" }, { status: 404 });
      }
      return jobStatusResponse(latest);
    }

    if (!isLooseAgentState(body.agent_v2)) {
      return NextResponse.json({ ok: false, error: "Invalid or missing agent_v2" }, { status: 400 });
    }

    const delivery_mode = resolveDeliveryMode({
      delivery_mode:
        body.delivery_mode === "degraded" || body.delivery_mode === "full"
          ? body.delivery_mode
          : null,
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
          .filter(
            (e): e is { label: string; answer?: string } =>
              isRecord(e) && typeof e.label === "string",
          )
          .map((e) => ({
            label: e.label,
            answer: typeof e.answer === "string" ? e.answer : undefined,
          }))
      : [];

    const regenerate = body.regenerate === true;

    // Resume in-flight job for this session (unless explicit regenerate forces a new one).
    if (!regenerate) {
      const latest = await findLatestXhighJobForSession("final_delivery", sessionIdRaw);
      if (latest) {
        const stale =
          (latest.status === "running" || latest.status === "pending") &&
          Date.now() - latest.updated_at > STALE_RUNNING_MS;
        if (!stale && (latest.status === "pending" || latest.status === "running")) {
          return jobStatusResponse(latest);
        }
        if (latest.status === "completed" && isFinalDeliveryJobResult(latest.result)) {
          return jobStatusResponse(latest);
        }
      }
    }

    const skipPass = regenerate;
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

    const locked = await acquireXhighSessionLock("final_delivery", sessionIdRaw);
    if (!locked) {
      const latest = await findLatestXhighJobForSession("final_delivery", sessionIdRaw);
      if (latest) return jobStatusResponse(latest);
      return NextResponse.json(
        { ok: false, error: "delivery_job_busy", retryable: true },
        { status: 409 },
      );
    }

    const jobInput: FinalDeliveryJobInput = {
      kind: "final_delivery",
      session_id: sessionIdRaw,
      locale,
      agent_v2: body.agent_v2,
      breakthrough_core,
      covered_agenda,
      base_analysis: body.base_analysis ?? null,
      delivery_mode,
      regenerate,
    };

    const job = await createXhighJob({
      phase: "final_delivery",
      session_id: sessionIdRaw,
      locale,
      job_input: jobInput,
    });

    if (!isFinalDeliveryJobInput(job.input)) {
      await releaseXhighSessionLock("final_delivery", sessionIdRaw);
      return NextResponse.json({ ok: false, error: "job_create_failed" }, { status: 500 });
    }

    scheduleFinalDeliveryJob(job.job_id, sessionIdRaw);
    console.info("[final-delivery] job created", { job_id: job.job_id, regenerate });

    return NextResponse.json({
      ok: true,
      job_id: job.job_id,
      status: job.status,
    });
  } catch (e) {
    console.error("[final-delivery]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "final-delivery failed" },
      { status: 500 },
    );
  }
}
