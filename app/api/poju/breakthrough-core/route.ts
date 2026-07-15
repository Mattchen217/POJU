import { after, NextResponse } from "next/server";

import { normalizeAgentPhase, type POJUAgentState } from "@/lib/poju/agent-state";
import {
  acquireXhighSessionLock,
  createXhighJob,
  findLatestXhighJobForSession,
  getXhighJob,
  releaseXhighSessionLock,
} from "@/lib/poju/xhigh-job-store";
import { runSegment2BreakthroughCoreJob } from "@/lib/poju/xhigh-job-runner";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";

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
  if (!isRecord(x.context_collected)) return false;
  return true;
}

function resolveProfileId(body: {
  selected_stored_profile_id?: unknown;
  agent_v2?: POJUAgentState | null;
}): string | null {
  if (typeof body.selected_stored_profile_id === "string" && body.selected_stored_profile_id.trim()) {
    return body.selected_stored_profile_id.trim();
  }
  const fromAgent = body.agent_v2?.selected_profile_id;
  if (typeof fromAgent === "string" && fromAgent.trim() && fromAgent !== "active_user_profile") {
    return fromAgent.trim();
  }
  return null;
}

function jobStatusResponse(job: NonNullable<Awaited<ReturnType<typeof getXhighJob>>>) {
  if (job.status === "completed" && job.result) {
    return NextResponse.json({
      ok: true,
      job_id: job.job_id,
      status: job.status,
      breakthrough_core: job.result.breakthrough_core,
      investigation_agenda: job.result.investigation_agenda,
      model: job.model,
      tokens_used: job.tokens_used,
      llm_debug: job.llm_debug,
    });
  }
  if (job.status === "failed") {
    return NextResponse.json({
      ok: false,
      job_id: job.job_id,
      status: job.status,
      retryable: job.retryable ?? true,
      reason: job.failure_reason ?? "provider_busy",
      error: job.error ?? "segment2 job failed",
    });
  }
  return NextResponse.json({
    ok: true,
    job_id: job.job_id,
    status: job.status,
    accumulated_content: job.accumulated_content,
  });
}

function scheduleSegment2Job(job_id: string, session_id: string): void {
  after(async () => {
    try {
      await runSegment2BreakthroughCoreJob(job_id);
    } catch (e) {
      console.error("[breakthrough-core] background job failed:", e);
    } finally {
      await releaseXhighSessionLock("segment2_breakthrough_core", session_id);
    }
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
      session_id?: unknown;
      original_question?: unknown;
      agent_v2?: unknown;
      base_analysis?: unknown;
      locale?: unknown;
      selected_stored_profile_id?: unknown;
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
    if (typeof body.original_question !== "string") {
      return NextResponse.json({ ok: false, error: "Missing original_question" }, { status: 400 });
    }

    let agent_v2 = body.agent_v2 === null || body.agent_v2 === undefined ? null : body.agent_v2;
    if (agent_v2 !== null && !isLooseAgentState(agent_v2)) {
      agent_v2 = null;
    }

    const base_analysis =
      body.base_analysis === undefined || body.base_analysis === null ? null : body.base_analysis;

    if (base_analysis == null) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "[breakthrough-core] 能量底座缺失，无法锚定深测算（必锚 structured）。selected_stored_profile_id=" +
            String(body.selected_stored_profile_id ?? "null"),
        },
        { status: 422 },
      );
    }

    const locale = typeof body.locale === "string" ? body.locale : "en";
    const sessionId = body.session_id.trim();
    const profileId = resolveProfileId({ selected_stored_profile_id: body.selected_stored_profile_id, agent_v2 });

    const latest = await findLatestXhighJobForSession("segment2_breakthrough_core", sessionId);
    if (latest) {
      const ageMs = Date.now() - latest.updated_at;
      const staleRunning =
        (latest.status === "pending" || latest.status === "running") && ageMs > STALE_RUNNING_MS;
      if (latest.status === "pending" || (latest.status === "running" && !staleRunning)) {
        if (latest.status === "pending") {
          scheduleSegment2Job(latest.job_id, sessionId);
        }
        return jobStatusResponse(latest);
      }
    }

    const locked = await acquireXhighSessionLock("segment2_breakthrough_core", sessionId);
    if (!locked) {
      const retry = await findLatestXhighJobForSession("segment2_breakthrough_core", sessionId);
      if (retry) return jobStatusResponse(retry);
      return NextResponse.json({ ok: false, error: "segment2_job_in_progress" }, { status: 409 });
    }

    let job;
    try {
      job = await createXhighJob({
        phase: "segment2_breakthrough_core",
        session_id: sessionId,
        locale,
        job_input: {
          session_id: sessionId,
          original_question: body.original_question,
          locale,
          profile_id: profileId,
          agent_v2,
          base_analysis,
        },
      });
    } catch (e) {
      await releaseXhighSessionLock("segment2_breakthrough_core", sessionId);
      throw e;
    }

    console.info("[breakthrough-core] created async xhigh job", { job_id: job.job_id, sessionId });
    scheduleSegment2Job(job.job_id, sessionId);

    return NextResponse.json({
      ok: true,
      job_id: job.job_id,
      status: job.status,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Breakthrough core failed";
    console.warn("[breakthrough-core] request failed:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
