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
import { resetDeliverySegmentTransportFailCounts, loadAllDeliverySegmentReady } from "@/lib/llm/pro/delivery/delivery-stage-store";
import {
  acquireXhighSessionLock,
  createXhighJob,
  failXhighJob,
  findLatestXhighJobForSession,
  getXhighJob,
  releaseXhighSessionLock,
  updateXhighJobStatus,
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

/**
 * Only allow a new job when the previous non-terminal job is already dead
 * (status route will STOP it). Do not spawn a parallel chain on clock alone.
 */
const STALE_RUNNING_MS = 45_000;

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

async function jobStatusResponse(job: PojuXhighJob) {
  if (job.status === "completed" && isFinalDeliveryJobResult(job.result)) {
    return NextResponse.json({
      ok: true,
      job_id: job.job_id,
      status: job.status,
      current_stage: "completed",
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
    const retryable = job.retryable === true || job.failure_reason === "interrupted";
    const ready = await loadAllDeliverySegmentReady(job.job_id);
    const streamed_segments = ready.map((s) => ({
      key: s.key,
      heading: s.heading,
      body: s.body_markdown,
      evidence: s.evidence_markdown,
      interleaved: s.interleaved_markdown ?? "",
      evidence_ready: s.evidence_ready,
      page_schema: s.page_schema ?? undefined,
    }));
    return NextResponse.json({
      ok: false,
      job_id: job.job_id,
      status: job.status,
      current_stage: job.current_stage ?? null,
      retryable,
      interrupted: retryable && job.failure_reason === "interrupted",
      reason: job.failure_reason ?? "transport_error",
      error: job.error ?? "final delivery job failed",
      streamed_segments: streamed_segments.length ? streamed_segments : undefined,
    });
  }
  return NextResponse.json({
    ok: true,
    job_id: job.job_id,
    status: job.status,
    current_stage: job.current_stage ?? "finalize",
    accumulated_content: job.accumulated_content,
  });
}

function scheduleFinalDeliveryJob(job_id: string, session_id: string): void {
  after(async () => {
    try {
      // Runs first incomplete stage, then self-schedules the rest via /continue.
      // Lock is released when assemble completes or a stage fails 鈥?not here.
      await runFinalDeliveryJob(job_id);
    } catch (e) {
      console.error("[final-delivery] background job failed:", e);
      await releaseXhighSessionLock("final_delivery", session_id);
    }
  });
}

/**
 * Phase 4 delivery 鈥?async xhigh job (same durability pattern as segment2).
 * POST creates/resumes a job; `after()` runs the multi-task pipeline even if the client leaves.
 * Poll GET /api/poju/final-delivery/status?job_id=鈥?or POST with resume_job_id.
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
      /** User Continue after interrupted segment transport pause. */
      continue_interrupted?: unknown;
      job_id?: unknown;
    };

    if (body.continue_interrupted === true) {
      const jobId =
        (typeof body.job_id === "string" && body.job_id.trim()) ||
        (typeof body.resume_job_id === "string" && body.resume_job_id.trim()) ||
        "";
      if (!jobId) {
        return NextResponse.json({ ok: false, error: "missing job_id" }, { status: 400 });
      }
      const job = await getXhighJob(jobId);
      if (!job || job.phase !== "final_delivery") {
        return NextResponse.json({ ok: false, error: "job_not_found" }, { status: 404 });
      }
      const { loadAllDeliverySegmentReady } = await import(
        "@/lib/llm/pro/delivery/delivery-stage-store"
      );
      const readyCount = (await loadAllDeliverySegmentReady(job.job_id).catch(() => [])).length;
      const resumable =
        job.status === "failed" &&
        (job.retryable === true ||
          job.failure_reason === "interrupted" ||
          readyCount > 0);
      if (!resumable && job.status !== "pending" && job.status !== "running") {
        return NextResponse.json(
          { ok: false, error: "job_not_resumable", status: job.status, ready_count: readyCount },
          { status: 409 },
        );
      }
      const sessionId = isFinalDeliveryJobInput(job.input)
        ? job.input.session_id
        : job.session_id;
      const stageRaw = job.current_stage ?? "segments";
      const resumeStage =
        stageRaw === "finalize" || stageRaw === "assemble" || stageRaw === "segments"
          ? stageRaw
          : "segments";

      await resetDeliverySegmentTransportFailCounts(job.job_id).catch(() => undefined);
      await releaseXhighSessionLock("final_delivery", sessionId).catch(() => undefined);
      const locked = await acquireXhighSessionLock("final_delivery", sessionId);
      if (!locked && job.status !== "running" && job.status !== "pending") {
        return NextResponse.json(
          { ok: false, error: "session_lock_busy" },
          { status: 409 },
        );
      }
      await updateXhighJobStatus(job.job_id, "running", {
        current_stage: resumeStage,
        accumulated_content: `user_continue:${resumeStage}`,
      });
      after(async () => {
        try {
          const { runFinalDeliveryStage } = await import(
            "@/lib/poju/final-delivery-stage-runner"
          );
          await runFinalDeliveryStage(job.job_id, resumeStage as "finalize" | "segments" | "assemble");
        } catch (e) {
          console.error("[final-delivery] continue_interrupted after failed:", e);
          await releaseXhighSessionLock("final_delivery", sessionId).catch(() => undefined);
        }
      });
      return NextResponse.json({
        ok: true,
        job_id: job.job_id,
        status: "running",
        current_stage: resumeStage,
        resumed: true,
      });
    }

    if (typeof body.resume_job_id === "string" && body.resume_job_id.trim()) {
      const job = await getXhighJob(body.resume_job_id.trim());
      if (!job || job.phase !== "final_delivery") {
        return NextResponse.json({ ok: false, error: "job_not_found" }, { status: 404 });
      }
      return await jobStatusResponse(job);
    }

    const sessionIdRaw =
      typeof body.session_id === "string" && body.session_id.trim() ? body.session_id.trim() : "";
    if (!sessionIdRaw) {
      return NextResponse.json({ ok: false, error: "Missing session_id" }, { status: 400 });
    }

    if (body.resume_latest === true) {
      const latest = await findLatestXhighJobForSession("final_delivery", sessionIdRaw);
      if (!latest) {
        // 200 (not 404): empty resume is a normal probe, not a broken route — keeps Vercel logs clean.
        return NextResponse.json({ ok: true, status: "none", job_id: null });
      }
      return await jobStatusResponse(latest);
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
          // Do not re-fire work 鈥?client keeps polling; status STOPs if truly dead.
          return await jobStatusResponse(latest);
        }
        if (latest.status === "completed" && isFinalDeliveryJobResult(latest.result)) {
          return await jobStatusResponse(latest);
        }
      }
    } else {
      // Regenerate: explicitly STOP any non-terminal job, then create a new chain.
      const latest = await findLatestXhighJobForSession("final_delivery", sessionIdRaw);
      if (latest && (latest.status === "pending" || latest.status === "running")) {
        await failXhighJob(latest.job_id, "STOP: superseded by regenerate", {
          retryable: false,
          failure_reason: "stale_running",
          current_stage: latest.current_stage,
          accumulated_content: "failed:superseded_by_regenerate",
        }).catch(() => undefined);
        await releaseXhighSessionLock("final_delivery", sessionIdRaw).catch(() => undefined);
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
      // Never return an old job as if regenerate succeeded.
      return NextResponse.json(
        { ok: false, error: "delivery_job_busy", retryable: false },
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
