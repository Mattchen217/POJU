import { after, NextResponse } from "next/server";

import type { BreakthroughCore } from "@/lib/poju/agent-state";
import {
  acquireXhighSessionLock,
  createXhighJob,
  findLatestXhighJobForSession,
  getXhighJob,
  releaseXhighSessionLock,
} from "@/lib/poju/xhigh-job-store";
import { runSegment2AgendaBridgeJob } from "@/lib/poju/xhigh-job-runner";
import { isSegment2JobResult } from "@/lib/poju/xhigh-job-types";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

const STALE_RUNNING_MS = 2 * 60 * 1000;
const PHASE = "segment2_agenda_bridge" as const;

function isBreakthroughCore(x: unknown): x is BreakthroughCore {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o.situation_conclusion !== "string" || !o.situation_conclusion.trim()) {
    return false;
  }
  const frames = Array.isArray(o.modern_action_frames) ? o.modern_action_frames : [];
  const hasPrimary =
    o.primary_path != null && typeof o.primary_path === "object" && !Array.isArray(o.primary_path);
  // Layer4 cores may emphasize primary/backup; still accept classic frames-only payloads.
  return frames.length >= 1 || hasPrimary;
}

function jobStatusResponse(job: NonNullable<Awaited<ReturnType<typeof getXhighJob>>>) {
  if (job.status === "completed" && isSegment2JobResult(job.result)) {
    return NextResponse.json({
      ok: true,
      job_id: job.job_id,
      status: job.status,
      phase: job.phase,
      investigation_agenda: job.result.investigation_agenda ?? [],
      first_question:
        job.result.first_question ?? job.result.breakthrough_core?.first_question ?? "",
      options: job.result.options,
      breakthrough_core: job.result.breakthrough_core,
      model: job.model,
      tokens_used: job.tokens_used,
      llm_debug: job.llm_debug,
    });
  }
  // Completed but unreadable result — do not return bare completed (client would false-fail).
  if (job.status === "completed") {
    return NextResponse.json({
      ok: false,
      job_id: job.job_id,
      status: "failed",
      phase: job.phase,
      retryable: true,
      reason: "completed_without_result",
      error: job.error ?? "agenda bridge completed without result",
    });
  }
  if (job.status === "failed") {
    return NextResponse.json({
      ok: false,
      job_id: job.job_id,
      status: job.status,
      phase: job.phase,
      retryable: job.retryable ?? true,
      reason: job.failure_reason ?? "provider_busy",
      error: job.error ?? "agenda bridge job failed",
    });
  }
  return NextResponse.json({
    ok: true,
    job_id: job.job_id,
    status: job.status,
    phase: job.phase,
    accumulated_content: job.accumulated_content,
  });
}

function scheduleAgendaJob(job_id: string, session_id: string): void {
  after(async () => {
    try {
      await runSegment2AgendaBridgeJob(job_id);
    } catch (e) {
      console.error("[breakthrough-core/agenda] background job failed:", e);
    } finally {
      await releaseXhighSessionLock(PHASE, session_id);
    }
  });
}

/** Call B — agenda + 承上启下 first_question. Separate invocation from Call A. */
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
      locale?: unknown;
      original_question?: unknown;
      question_category?: unknown;
      breakthrough_core?: unknown;
      segment1_understanding?: unknown;
      resume_job_id?: unknown;
    };

    if (typeof body.resume_job_id === "string" && body.resume_job_id.trim()) {
      const job = await getXhighJob(body.resume_job_id.trim());
      if (!job) {
        return NextResponse.json({ ok: false, error: "job_not_found" }, { status: 404 });
      }
      return jobStatusResponse(job);
    }

    if (typeof body.session_id !== "string" || !body.session_id.trim()) {
      return NextResponse.json({ ok: false, error: "Missing session_id" }, { status: 400 });
    }
    if (!isBreakthroughCore(body.breakthrough_core)) {
      return NextResponse.json(
        { ok: false, error: "Missing breakthrough_core from Call A" },
        { status: 400 },
      );
    }

    const locale = typeof body.locale === "string" ? body.locale : "en";
    const sessionId = body.session_id.trim();
    const original_question =
      typeof body.original_question === "string" ? body.original_question : "";
    const question_category =
      typeof body.question_category === "string" ? body.question_category : null;
    const segment1_understanding =
      typeof body.segment1_understanding === "string" ? body.segment1_understanding : "";

    const latest = await findLatestXhighJobForSession(PHASE, sessionId);
    if (latest) {
      const ageMs = Date.now() - latest.updated_at;
      const staleRunning =
        (latest.status === "pending" || latest.status === "running") && ageMs > STALE_RUNNING_MS;
      if (latest.status === "pending" || (latest.status === "running" && !staleRunning)) {
        if (latest.status === "pending") scheduleAgendaJob(latest.job_id, sessionId);
        return jobStatusResponse(latest);
      }
    }

    const locked = await acquireXhighSessionLock(PHASE, sessionId);
    if (!locked) {
      const retry = await findLatestXhighJobForSession(PHASE, sessionId);
      if (retry) return jobStatusResponse(retry);
      return NextResponse.json({ ok: false, error: "agenda_job_in_progress" }, { status: 409 });
    }

    let job;
    try {
      job = await createXhighJob({
        phase: PHASE,
        session_id: sessionId,
        locale,
        job_input: {
          session_id: sessionId,
          locale,
          original_question,
          question_category,
          breakthrough_core: body.breakthrough_core,
          ...(segment1_understanding.trim()
            ? { segment1_understanding: segment1_understanding.trim() }
            : {}),
        },
      });
    } catch (e) {
      await releaseXhighSessionLock(PHASE, sessionId);
      throw e;
    }

    console.info("[breakthrough-core/agenda] created Call B job", { job_id: job.job_id, sessionId });
    scheduleAgendaJob(job.job_id, sessionId);

    return NextResponse.json({
      ok: true,
      job_id: job.job_id,
      status: job.status,
      phase: PHASE,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Agenda bridge failed";
    console.warn("[breakthrough-core/agenda] request failed:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
