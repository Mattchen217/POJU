import { after, NextResponse } from "next/server";

import { buildStructuredInstanceInventory } from "@/lib/base-analysis/build-structured-instance-inventory";
import { normalizeBaseAnalysisInput } from "@/lib/llm/prompts/base-analysis-context";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
import { normalizeAgentPhase, type POJUAgentState } from "@/lib/poju/agent-state";
import { buildCoveredAgendaEvidence } from "@/lib/poju/investigation-agenda";
import { REPORT_BLUEPRINT } from "@/lib/poju/report-blueprint";
import { runSynthesisJob } from "@/lib/poju/xhigh-job-runner";
import {
  acquireXhighSessionLock,
  createXhighJob,
  findLatestXhighJobForSession,
  getXhighJob,
  releaseXhighSessionLock,
} from "@/lib/poju/xhigh-job-store";
import {
  isSynthesisJobResult,
  type SynthesisJobInput,
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
  if (!isRecord(x.context_collected)) return false;
  return true;
}

function buildStructuredInventory(base_analysis: unknown): string {
  try {
    const bundle = normalizeBaseAnalysisInput(base_analysis);
    const structured = bundle.structured;
    if (!structured) return "";
    return buildStructuredInstanceInventory(structured);
  } catch {
    return "";
  }
}

function resolveDesiredOutcome(agent: POJUAgentState | null): string {
  const fromContext = agent?.context_collected?.desired_outcome?.trim();
  if (fromContext) return fromContext;
  const fromDirection = agent?.desired_direction?.wants?.trim();
  if (fromDirection) return fromDirection;
  return "";
}

function buildSynthesisJobInput(input: {
  agent_v2: POJUAgentState | null;
  original_question: string;
  base_analysis: unknown;
}): SynthesisJobInput {
  const { agent_v2, original_question, base_analysis } = input;
  return {
    kind: "synthesis",
    multi_dimension_reckoning:
      agent_v2?.breakthrough_core?.multi_dimension_reckoning ?? [],
    desired_outcome: resolveDesiredOutcome(agent_v2),
    original_question:
      (typeof agent_v2?.original_question === "string" && agent_v2.original_question.trim()
        ? agent_v2.original_question.trim()
        : original_question) || "",
    question_category: agent_v2?.question_category ?? "other",
    // AgendaItem 无 captured_answer；答案在对话/context 里，证据块只带 label（与 final-delivery 一致）。
    covered_agenda: buildCoveredAgendaEvidence(agent_v2),
    structured_inventory: buildStructuredInventory(base_analysis),
    report_pages: REPORT_BLUEPRINT.map((p) => ({
      id: p.id,
      title: p.title.zh,
      purpose: p.purpose,
    })),
  };
}

function jobStatusResponse(job: NonNullable<Awaited<ReturnType<typeof getXhighJob>>>) {
  if (job.status === "completed" && isSynthesisJobResult(job.result)) {
    return NextResponse.json({
      ok: true,
      job_id: job.job_id,
      status: job.status,
      primary_path: job.result.primary_path,
      backup_path: job.result.backup_path,
      action_plan: job.result.action_plan,
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
      error: job.error ?? "synthesis job failed",
    });
  }
  return NextResponse.json({
    ok: true,
    job_id: job.job_id,
    status: job.status,
    accumulated_content: job.accumulated_content,
  });
}

function scheduleSynthesisJob(job_id: string, session_id: string): void {
  after(async () => {
    try {
      await runSynthesisJob(job_id);
    } catch (e) {
      console.error("[synthesis] background job failed:", e);
    } finally {
      await releaseXhighSessionLock("synthesis", session_id);
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
            "[synthesis] 能量底座缺失，无法组装 structured_inventory。" +
            "selected_stored_profile_id=" +
            String(body.selected_stored_profile_id ?? "null"),
        },
        { status: 422 },
      );
    }

    const dims = agent_v2?.breakthrough_core?.multi_dimension_reckoning;
    if (!Array.isArray(dims) || dims.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "[synthesis] multi_dimension_reckoning 缺失——汇总段需要第2段多维真算结果。",
        },
        { status: 422 },
      );
    }

    const locale = typeof body.locale === "string" ? body.locale : "en";
    const sessionId = body.session_id.trim();

    const latest = await findLatestXhighJobForSession("synthesis", sessionId);
    if (latest) {
      const ageMs = Date.now() - latest.updated_at;
      const staleRunning =
        (latest.status === "pending" || latest.status === "running") && ageMs > STALE_RUNNING_MS;
      if (latest.status === "pending" || (latest.status === "running" && !staleRunning)) {
        if (latest.status === "pending") {
          scheduleSynthesisJob(latest.job_id, sessionId);
        }
        return jobStatusResponse(latest);
      }
    }

    const locked = await acquireXhighSessionLock("synthesis", sessionId);
    if (!locked) {
      const retry = await findLatestXhighJobForSession("synthesis", sessionId);
      if (retry) return jobStatusResponse(retry);
      return NextResponse.json({ ok: false, error: "synthesis_job_in_progress" }, { status: 409 });
    }

    let job;
    try {
      job = await createXhighJob({
        phase: "synthesis",
        session_id: sessionId,
        locale,
        job_input: buildSynthesisJobInput({
          agent_v2,
          original_question: body.original_question,
          base_analysis,
        }),
      });
    } catch (e) {
      await releaseXhighSessionLock("synthesis", sessionId);
      throw e;
    }

    console.info("[synthesis] created async xhigh job", { job_id: job.job_id, sessionId });
    scheduleSynthesisJob(job.job_id, sessionId);

    return NextResponse.json({
      ok: true,
      job_id: job.job_id,
      status: job.status,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Synthesis failed";
    console.warn("[synthesis] request failed:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
