/**
 * Ops LAB · Segment2 / Synthesis jobs + seed LabSource for delivery unlock.
 * Server-only (createXhighJob + runners); does not use browser fetch helpers.
 */

import { randomBytes } from "node:crypto";
import {
  formatSegment1UnderstandingForPrompt,
  normalizeAgentPhase,
  type BreakthroughCore,
  type ModernActionFrame,
  type POJUAgentState,
} from "@/lib/poju/agent-state";
import { ensureSessionCycles } from "@/lib/poju/cycle-manager";
import { advanceStateMachine, extractModelTurnSignals } from "@/lib/poju/state-machine";
import { withSessionProfileFlags } from "@/lib/poju/session-profile";
import { resolvePivotSessionLang } from "@/lib/poju/session-lang";
import { understandingGateConfirmButtonLabel } from "@/lib/poju/understanding-gate-reply";
import { deliveryConfirmButtonLabel } from "@/lib/poju/delivery-confirm-reply";
import { safeRandomUUID } from "@/lib/client/safe-crypto";
import type { POJUMessage, POJUSessionState } from "@/lib/poju/types";
import {
  clearPendingSegment2Job,
  finalizeSegment2AgendaBridgeSuccess,
  finalizeSegment2JobFailure,
  finalizeSegment2ReportSuccess,
  finalizeSynthesisJobFailure,
  finalizeSynthesisJobSuccess,
  markSynthesisPending,
  withPendingSegment2Job,
} from "@/lib/poju/phases/segment2/control";
import { createInitialAgentState } from "@/lib/poju/agent-state";
import {
  acquireXhighSessionLock,
  createXhighJob,
  getXhighJob,
  releaseXhighSessionLock,
} from "@/lib/poju/xhigh-job-store";
import {
  runSegment2AgendaBridgeJob,
  runSegment2BreakthroughCoreJob,
  runSynthesisJob,
} from "@/lib/poju/xhigh-job-runner";
import {
  isSegment2JobResult,
  isSynthesisJobResult,
  type SynthesisJobInput,
} from "@/lib/poju/xhigh-job-types";
import { REPORT_BLUEPRINT } from "@/lib/poju/report-blueprint";
import { normalizeBaseAnalysisInput } from "@/lib/llm/prompts/base-analysis-context";
import { buildStructuredInstanceInventory } from "@/lib/base-analysis/build-structured-instance-inventory";
import { dyadSkipPatch } from "@/lib/poju/dyad-compat";
import { buildPivotChartPathLock, isDyadGateUnresolved } from "@/lib/poju/pivot-chart-path";
import { consumeReplyOptionsOnSession } from "@/lib/poju/reply-options";
import { buildCoveredAgendaEvidence } from "@/lib/poju/investigation-agenda";
import { sanitizeLabDeliverySource } from "@/lib/llm/pro/delivery/lab/sanitize-delivery-source";
import { buildLabCallTrace, slimLabCallTrace } from "@/lib/llm/pro/delivery/lab/call-trace";
import { derivePipelineCursor } from "@/lib/llm/pro/delivery/lab/pipeline-cursor";
import type { LabPipelineTurn } from "@/lib/llm/pro/delivery/lab/lab-pipeline-types";
import type { DeliveryLabSession } from "@/lib/llm/pro/delivery/lab/types";

function newTurnId(): string {
  return `pt_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
}

function buildLabSynthesisJobInput(input: {
  agent_v2: POJUAgentState;
  original_question: string;
  base_analysis: unknown;
  dyad_compat_summary?: import("@/lib/poju/dyad-compat").DyadCompatSummary | null;
  partner_bazi?: import("@/lib/poju/dyad-compat").PartnerBaziPresence | null;
  pivot_chart_path?: import("@/lib/poju/pivot-chart-path").PivotChartPath | null;
  dyad_matrix_pack?: import("@/lib/poju/dyad-matrix-pack").DyadMatrixPack | null;
}): SynthesisJobInput {
  const { agent_v2, original_question, base_analysis } = input;
  let structured_inventory = "";
  try {
    const bundle = normalizeBaseAnalysisInput(base_analysis);
    if (bundle.structured) {
      structured_inventory = buildStructuredInstanceInventory(bundle.structured, {
        questionCategory: agent_v2.question_category ?? null,
      });
    }
  } catch {
    structured_inventory = "";
  }
  const desired =
    agent_v2.context_collected?.desired_outcome?.trim() ||
    agent_v2.desired_direction?.wants?.trim() ||
    "";
  return {
    kind: "synthesis",
    multi_dimension_reckoning:
      agent_v2.breakthrough_core?.multi_dimension_reckoning ?? [],
    desired_outcome: desired,
    original_question:
      (typeof agent_v2.original_question === "string" && agent_v2.original_question.trim()
        ? agent_v2.original_question.trim()
        : original_question) || "",
    question_category: agent_v2.question_category ?? "other",
    covered_agenda: buildCoveredAgendaEvidence(agent_v2),
    structured_inventory,
    report_pages: REPORT_BLUEPRINT.map((p) => ({
      id: p.id,
      title: p.title.zh,
      purpose: p.purpose,
    })),
    dyad_compat_summary: input.dyad_compat_summary ?? null,
    partner_bazi: input.partner_bazi ?? null,
    pivot_chart_path: input.pivot_chart_path ?? null,
    dyad_matrix_pack: input.dyad_matrix_pack ?? null,
  };
}

function ensureAgentV2(session: POJUSessionState): POJUAgentState {
  const base = session.agent_v2;
  if (base) {
    const phase = normalizeAgentPhase(base.current_phase) ?? base.current_phase;
    return { ...base, current_phase: phase };
  }
  return createInitialAgentState({
    original_question: session.original_question,
    selected_profile_id: session.selected_stored_profile_id,
  });
}

function extractOpeningProblem(messages: POJUMessage[]): string {
  const users = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.trim())
    .filter(Boolean);
  const last = users[users.length - 1] ?? "";
  if (last && last !== "__OPENING__") return last;
  return users.find((c) => c !== "__OPENING__") ?? "";
}

function markCorePending(agent: POJUAgentState, freshQuestion: string): POJUAgentState {
  return {
    ...agent,
    original_question: freshQuestion,
    current_phase: "collecting_context",
    breakthrough_core: null,
    investigation_agenda: [],
    agenda_generated: false,
    core_generation_failed: false,
    has_situation_analysis: false,
  };
}

function appendGateTurn(
  lab: DeliveryLabSession,
  gate: { action: string; detail?: string },
): DeliveryLabSession {
  const turn: LabPipelineTurn = {
    turn_id: newTurnId(),
    phase: String(lab.chat_session?.agent_v2?.current_phase ?? "gate"),
    kind: "gate",
    gate,
    attempts: [
      {
        attempt_number: 1,
        timestamp: new Date().toISOString(),
        duration_ms: 0,
        input_payload: gate,
      },
    ],
  };
  return {
    ...lab,
    pipeline_turns: [...(lab.pipeline_turns ?? []), turn],
  };
}

function jobAttemptsFromTraces(
  phase: string,
  job: NonNullable<Awaited<ReturnType<typeof getXhighJob>>>,
  opts?: { error?: string; raw_fallback?: unknown },
): import("@/lib/llm/pro/delivery/lab/lab-pipeline-types").LabPipelineAttempt[] {
  const duration_ms = Math.max(0, (job.completed_at ?? Date.now()) - job.created_at);
  const traces = Array.isArray(job.lab_call_traces) ? job.lab_call_traces : [];
  if (traces.length > 0) {
    return traces.map((t, i) => ({
      attempt_number: i + 1,
      timestamp: new Date().toISOString(),
      duration_ms,
      call_trace: t,
      raw_model_output: t.parsed ?? t.raw_text ?? opts?.raw_fallback ?? job.result,
      error: opts?.error,
      input_payload: {
        job_id: job.job_id,
        leg: t.phase,
        job_phase: job.phase,
      },
    }));
  }
  // Fallback when older jobs lack lab_call_traces
  return [
    {
      attempt_number: 1,
      timestamp: new Date().toISOString(),
      duration_ms,
      call_trace: slimLabCallTrace(
        buildLabCallTrace({
          phase,
          system: "(本 job 未写入 lab_call_traces — 请重跑本段以捕获完整 prompt)",
          user: JSON.stringify(
            { job_id: job.job_id, phase: job.phase, status: job.status },
            null,
            2,
          ),
          raw_text: job.accumulated_content || null,
          parsed: job.result ?? undefined,
          result: {
            reasoning: undefined,
            actual_model: job.model ?? "unknown",
            meta: {
              call_type: "deep_analysis",
              tokens_used: Number(job.tokens_used ?? 0),
              latency_ms: duration_ms,
              cost_usd: 0,
              cached_tokens: 0,
              thinking_enabled: true,
              thinking_effort: "high",
              generation_id: job.job_id,
            },
          },
        }),
      ),
      raw_model_output: opts?.raw_fallback ?? job.result,
      error: opts?.error,
      input_payload: { job_id: job.job_id, phase: job.phase },
    },
  ];
}

/** Understanding confirm → lock path → create Call A job (caller schedules / awaits). */
export async function labUnderstandingConfirm(lab: DeliveryLabSession): Promise<{
  lab: DeliveryLabSession;
  job_id: string | null;
}> {
  if (lab.mode !== "full_pipeline" || !lab.chat_session) {
    throw new Error("lab_not_full_pipeline");
  }
  const locale = resolvePivotSessionLang(lab.chat_session, lab.source.locale || "zh");
  let session = ensureSessionCycles(lab.chat_session);
  const baseAgent = ensureAgentV2(session);
  const phase = normalizeAgentPhase(baseAgent.current_phase);
  if (phase !== "awaiting_understanding_confirm") {
    throw new Error("not_awaiting_understanding_confirm");
  }

  if (isDyadGateUnresolved(session.dyad_offer_status)) {
    session = { ...session, ...dyadSkipPatch() };
  }
  session = { ...session, ...buildPivotChartPathLock(session) };

  const userLabel = understandingGateConfirmButtonLabel(locale);
  const userMessage: POJUMessage = {
    role: "user",
    content: userLabel,
    timestamp: new Date().toISOString(),
    client_id: safeRandomUUID(),
  };
  const messagesWithUser = [...session.messages, userMessage];
  const signals = extractModelTurnSignals({ confirmation_signal: "confirmed" });
  const advance = advanceStateMachine(baseAgent, signals, userLabel);
  const freshQuestion =
    advance.next_agent.original_question?.trim() ||
    extractOpeningProblem(messagesWithUser) ||
    session.original_question?.trim() ||
    userLabel;

  let agent_v2 = markCorePending(
    { ...advance.next_agent, original_question: freshQuestion },
    freshQuestion,
  );

  let sessionPending = withSessionProfileFlags({
    ...session,
    original_question: freshQuestion,
    messages: messagesWithUser,
    agent_v2,
    last_interaction_at: new Date().toISOString(),
  });

  let labOut = appendGateTurn(
    { ...lab, chat_session: sessionPending },
    { action: "understanding_confirm", detail: `path=${sessionPending.pivot_chart_path}` },
  );

  if (!advance.trigger_breakthrough_core) {
    labOut.pipeline_cursor = derivePipelineCursor(labOut);
    return { lab: labOut, job_id: null };
  }

  const sessionId = sessionPending.session_id;
  const locked = await acquireXhighSessionLock("segment2_breakthrough_core", sessionId);
  if (!locked) throw new Error("segment2_job_in_progress");

  let job;
  try {
    job = await createXhighJob({
      phase: "segment2_breakthrough_core",
      session_id: sessionId,
      locale,
      job_input: {
        session_id: sessionId,
        original_question: freshQuestion,
        locale,
        profile_id: sessionPending.selected_stored_profile_id?.trim() || null,
        agent_v2,
        base_analysis: lab.source.base_analysis,
        dyad_compat_summary: sessionPending.dyad_compat_summary ?? null,
        partner_bazi: sessionPending.partner_bazi ?? null,
        pivot_chart_path: sessionPending.pivot_chart_path ?? null,
        dyad_matrix_pack: sessionPending.dyad_matrix_pack ?? null,
      },
    });
  } catch (e) {
    await releaseXhighSessionLock("segment2_breakthrough_core", sessionId);
    throw e;
  }

  sessionPending = withPendingSegment2Job(sessionPending, job.job_id, "report");
  labOut = {
    ...labOut,
    chat_session: sessionPending,
    pipeline_pending_job: { job_id: job.job_id, stage: "segment2_a" },
    source: {
      ...labOut.source,
      original_question: freshQuestion,
      pivot_chart_path: sessionPending.pivot_chart_path,
      partner_bazi: sessionPending.partner_bazi,
      dyad_compat_summary: sessionPending.dyad_compat_summary,
      dyad_matrix_pack: sessionPending.dyad_matrix_pack,
    },
  };
  labOut.pipeline_cursor = derivePipelineCursor(labOut);
  return { lab: labOut, job_id: job.job_id };
}

export async function labDyadSkip(lab: DeliveryLabSession): Promise<DeliveryLabSession> {
  if (lab.mode !== "full_pipeline" || !lab.chat_session) {
    throw new Error("lab_not_full_pipeline");
  }
  const session = consumeReplyOptionsOnSession({
    ...lab.chat_session,
    ...dyadSkipPatch(),
    ...buildPivotChartPathLock({ ...lab.chat_session, ...dyadSkipPatch() }),
  });
  let labOut = appendGateTurn(
    { ...lab, chat_session: session },
    { action: "dyad_skip", detail: `path=${session.pivot_chart_path}` },
  );
  labOut.pipeline_cursor = derivePipelineCursor(labOut);
  return labOut;
}

/** Normalize LAB / paste payloads for Match matrix (bare `{ structured }` → bundle). */
function asDyadMatrixProfile(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const o = raw as Record<string, unknown>;
  if (o.user_profile != null || o.base_analysis != null) return raw;
  if (o.structured != null) return { base_analysis: o };
  return raw;
}

/** Dyad collect with partner birth-derived profile or pasted base_analysis JSON. */
export async function labDyadCollect(
  lab: DeliveryLabSession,
  partnerBaseAnalysis: unknown,
): Promise<DeliveryLabSession> {
  if (lab.mode !== "full_pipeline" || !lab.chat_session) {
    throw new Error("lab_not_full_pipeline");
  }
  const { buildDyadCompatSummary } = await import("@/lib/poju/dyad-compat");
  const { buildDyadMatrixPack } = await import("@/lib/poju/dyad-matrix-pack");

  const profileA = asDyadMatrixProfile(lab.source.base_analysis);
  const profileB = asDyadMatrixProfile(partnerBaseAnalysis);

  const summary = buildDyadCompatSummary({
    profileA,
    profileB,
  });
  const matrix = buildDyadMatrixPack({
    profileA,
    profileB,
  });

  const partner_profile_id = "lab-partner";
  const session: POJUSessionState = consumeReplyOptionsOnSession({
    ...lab.chat_session,
    dyad_offer_status: "collected",
    partner_bazi: "present",
    partner_profile_id,
    dyad_compat_summary: summary,
    dyad_matrix_pack: matrix,
    ...buildPivotChartPathLock({
      ...lab.chat_session,
      dyad_offer_status: "collected",
      partner_bazi: "present",
      partner_profile_id,
      dyad_compat_summary: summary,
      dyad_matrix_pack: matrix,
    }),
  });

  let labOut = appendGateTurn(
    {
      ...lab,
      chat_session: session,
      source: {
        ...lab.source,
        partner_bazi: "present",
        dyad_compat_summary: summary,
        dyad_matrix_pack: matrix,
        pivot_chart_path: session.pivot_chart_path,
      },
    },
    { action: "dyad_collect", detail: `path=${session.pivot_chart_path}` },
  );
  labOut.pipeline_cursor = derivePipelineCursor(labOut);
  return labOut;
}

export async function labRunSegment2AJob(job_id: string): Promise<void> {
  try {
    await runSegment2BreakthroughCoreJob(job_id);
  } finally {
    const job = await getXhighJob(job_id);
    if (job?.session_id) {
      await releaseXhighSessionLock("segment2_breakthrough_core", job.session_id);
    }
  }
}

export async function labRunSegment2BJob(job_id: string): Promise<void> {
  try {
    await runSegment2AgendaBridgeJob(job_id);
  } finally {
    const job = await getXhighJob(job_id);
    if (job?.session_id) {
      await releaseXhighSessionLock("segment2_agenda_bridge", job.session_id);
    }
  }
}

export async function labRunSynthesisJob(job_id: string): Promise<void> {
  try {
    await runSynthesisJob(job_id);
  } finally {
    const job = await getXhighJob(job_id);
    if (job?.session_id) {
      await releaseXhighSessionLock("synthesis", job.session_id);
    }
  }
}

/** Poll pending job; apply into chat_session; auto-start Call B after Call A. */
export async function labPollPipelineJob(lab: DeliveryLabSession): Promise<DeliveryLabSession> {
  const pending = lab.pipeline_pending_job;
  if (!pending || !lab.chat_session) return lab;

  const job = await getXhighJob(pending.job_id);
  if (!job) throw new Error("job_not_found");

  if (job.status === "pending" || job.status === "running") {
    return lab;
  }

  const locale = lab.source.locale || "zh";

  if (pending.stage === "segment2_a") {
    if (job.status === "failed" || !isSegment2JobResult(job.result)) {
      const session = finalizeSegment2JobFailure({
        session: lab.chat_session,
        locale,
        error: job.error,
      });
      const turn: LabPipelineTurn = {
        turn_id: newTurnId(),
        phase: "segment2_a",
        kind: "segment2_a",
        attempts: jobAttemptsFromTraces("segment2_a", job, {
          error: job.error ?? "segment2_a_failed",
        }),
      };
      const out: DeliveryLabSession = {
        ...lab,
        chat_session: clearPendingSegment2Job(session),
        pipeline_pending_job: null,
        pipeline_turns: [...(lab.pipeline_turns ?? []), turn],
      };
      out.pipeline_cursor = derivePipelineCursor(out);
      return out;
    }

    const sessionA = finalizeSegment2ReportSuccess({
      session: clearPendingSegment2Job(lab.chat_session),
      locale,
      breakthrough_core: job.result.breakthrough_core,
      model: job.model,
      tokens_used: job.tokens_used,
      llm_debug: job.llm_debug,
    });

    const turnA: LabPipelineTurn = {
      turn_id: newTurnId(),
      phase: "segment2_a",
      kind: "segment2_a",
      attempts: jobAttemptsFromTraces("segment2_a", job, { raw_fallback: job.result }),
    };

    // Auto-start Call B
    const core = job.result.breakthrough_core;
    const sessionId = sessionA.session_id;
    const locked = await acquireXhighSessionLock("segment2_agenda_bridge", sessionId);
    if (!locked) {
      const out: DeliveryLabSession = {
        ...lab,
        chat_session: sessionA,
        pipeline_pending_job: null,
        pipeline_turns: [...(lab.pipeline_turns ?? []), turnA],
        source: {
          ...lab.source,
          breakthrough_core: core,
        },
      };
      out.pipeline_cursor = derivePipelineCursor(out);
      return out;
    }

    let agendaJob;
    try {
      const segment1_understanding = formatSegment1UnderstandingForPrompt(ensureAgentV2(sessionA));
      agendaJob = await createXhighJob({
        phase: "segment2_agenda_bridge",
        session_id: sessionId,
        locale,
        job_input: {
          session_id: sessionId,
          locale,
          original_question:
            sessionA.agent_v2?.original_question?.trim() ||
            sessionA.original_question?.trim() ||
            "",
          question_category: sessionA.agent_v2?.question_category ?? null,
          breakthrough_core: core,
          ...(segment1_understanding.trim()
            ? { segment1_understanding: segment1_understanding.trim() }
            : {}),
          dyad_compat_summary: sessionA.dyad_compat_summary ?? null,
          partner_bazi: sessionA.partner_bazi ?? null,
          pivot_chart_path: sessionA.pivot_chart_path ?? null,
          dyad_matrix_pack: sessionA.dyad_matrix_pack ?? null,
        },
      });
    } catch (e) {
      await releaseXhighSessionLock("segment2_agenda_bridge", sessionId);
      throw e;
    }

    const sessionPendingB = withPendingSegment2Job(sessionA, agendaJob.job_id, "agenda");
    const out: DeliveryLabSession = {
      ...lab,
      chat_session: sessionPendingB,
      pipeline_pending_job: { job_id: agendaJob.job_id, stage: "segment2_b" },
      pipeline_turns: [...(lab.pipeline_turns ?? []), turnA],
      source: {
        ...lab.source,
        breakthrough_core: core,
      },
    };
    out.pipeline_cursor = derivePipelineCursor(out);
    return out;
  }

  if (pending.stage === "segment2_b") {
    if (job.status === "failed" || !isSegment2JobResult(job.result)) {
      const out: DeliveryLabSession = {
        ...lab,
        chat_session: clearPendingSegment2Job(lab.chat_session),
        pipeline_pending_job: null,
        pipeline_turns: [
          ...(lab.pipeline_turns ?? []),
          {
            turn_id: newTurnId(),
            phase: "segment2_b",
            kind: "segment2_b",
            attempts: jobAttemptsFromTraces("segment2_b", job, {
              error: job.error ?? "segment2_b_failed",
            }),
          },
        ],
      };
      out.pipeline_cursor = derivePipelineCursor(out);
      return out;
    }

    const sessionB = finalizeSegment2AgendaBridgeSuccess({
      session: clearPendingSegment2Job(lab.chat_session),
      locale,
      investigation_agenda: job.result.investigation_agenda ?? [],
      first_question: job.result.first_question ?? "",
    });

    const out: DeliveryLabSession = {
      ...lab,
      chat_session: sessionB,
      pipeline_pending_job: null,
      pipeline_turns: [
        ...(lab.pipeline_turns ?? []),
        {
          turn_id: newTurnId(),
          phase: "segment2_b",
          kind: "segment2_b",
          attempts: jobAttemptsFromTraces("segment2_b", job, { raw_fallback: job.result }),
        },
      ],
    };
    out.pipeline_cursor = derivePipelineCursor(out);
    return out;
  }

  if (pending.stage === "synthesis") {
    if (job.status === "failed" || !isSynthesisJobResult(job.result)) {
      const session = finalizeSynthesisJobFailure({
        session: lab.chat_session,
        locale,
        error: job.error,
      });
      const out: DeliveryLabSession = {
        ...lab,
        chat_session: { ...session, pending_synthesis_job_id: null },
        pipeline_pending_job: null,
        pipeline_turns: [
          ...(lab.pipeline_turns ?? []),
          {
            turn_id: newTurnId(),
            phase: "synthesis",
            kind: "synthesis",
            attempts: jobAttemptsFromTraces("synthesis", job, {
              error: job.error ?? "synthesis_failed",
            }),
          },
        ],
      };
      out.pipeline_cursor = derivePipelineCursor(out);
      return out;
    }

    const primary = job.result.primary_path as ModernActionFrame;
    const backup = job.result.backup_path as ModernActionFrame;
    const sessionDone = await finalizeSynthesisJobSuccess({
      session: lab.chat_session,
      locale,
      primary_path: primary,
      backup_path: backup,
      action_plan: job.result.action_plan,
      model: job.model,
      tokens_used: job.tokens_used,
      llm_debug: job.llm_debug,
      start_delivery: false,
    });

    let out: DeliveryLabSession = {
      ...lab,
      chat_session: sessionDone,
      pipeline_pending_job: null,
      pipeline_turns: [
        ...(lab.pipeline_turns ?? []),
        {
          turn_id: newTurnId(),
          phase: "synthesis",
          kind: "synthesis",
          attempts: jobAttemptsFromTraces("synthesis", job, { raw_fallback: job.result }),
        },
      ],
    };
    out = seedLabSourceFromChat(out);
    out.pipeline_cursor = derivePipelineCursor(out);
    return out;
  }

  return lab;
}

export async function labSynthesisConfirm(lab: DeliveryLabSession): Promise<{
  lab: DeliveryLabSession;
  job_id: string | null;
}> {
  if (lab.mode !== "full_pipeline" || !lab.chat_session) {
    throw new Error("lab_not_full_pipeline");
  }
  const locale = resolvePivotSessionLang(lab.chat_session, lab.source.locale || "zh");
  const session = ensureSessionCycles(lab.chat_session);
  const baseAgent = ensureAgentV2(session);
  const phase = normalizeAgentPhase(baseAgent.current_phase);
  if (phase !== "awaiting_confirmation") {
    throw new Error("not_awaiting_confirmation");
  }

  const userLabel = deliveryConfirmButtonLabel(locale);
  const userMessage: POJUMessage = {
    role: "user",
    content: userLabel,
    timestamp: new Date().toISOString(),
    client_id: safeRandomUUID(),
  };
  const messagesWithUser = [...session.messages, userMessage];
  const signals = extractModelTurnSignals({ confirmation_signal: "confirmed" });
  const advance = advanceStateMachine(baseAgent, signals, userLabel);
  const freshQuestion =
    advance.next_agent.original_question?.trim() ||
    extractOpeningProblem(messagesWithUser) ||
    session.original_question?.trim() ||
    userLabel;

  let agent_v2 = markSynthesisPending({
    ...advance.next_agent,
    original_question: freshQuestion,
  });

  let sessionPending = withSessionProfileFlags({
    ...session,
    original_question: freshQuestion,
    messages: messagesWithUser,
    agent_v2,
    last_interaction_at: new Date().toISOString(),
  });

  let labOut = appendGateTurn(
    { ...lab, chat_session: sessionPending },
    { action: "synthesis_confirm" },
  );

  if (!advance.trigger_synthesis) {
    labOut.pipeline_cursor = derivePipelineCursor(labOut);
    return { lab: labOut, job_id: null };
  }

  const dims = agent_v2.breakthrough_core?.multi_dimension_reckoning;
  if (!Array.isArray(dims) || dims.length === 0) {
    throw new Error("missing_multi_dimension_reckoning");
  }

  const sessionId = sessionPending.session_id;
  const locked = await acquireXhighSessionLock("synthesis", sessionId);
  if (!locked) throw new Error("synthesis_job_in_progress");

  const synthInput = buildLabSynthesisJobInput({
    agent_v2,
    original_question: freshQuestion,
    base_analysis: lab.source.base_analysis,
    dyad_compat_summary: sessionPending.dyad_compat_summary ?? null,
    partner_bazi: sessionPending.partner_bazi ?? null,
    pivot_chart_path: sessionPending.pivot_chart_path ?? null,
    dyad_matrix_pack: sessionPending.dyad_matrix_pack ?? null,
  });
  let job;
  try {
    job = await createXhighJob({
      phase: "synthesis",
      session_id: sessionId,
      locale,
      job_input: synthInput,
    });
  } catch (e) {
    await releaseXhighSessionLock("synthesis", sessionId);
    throw e;
  }

  sessionPending = {
    ...sessionPending,
    pending_synthesis_job_id: job.job_id,
  };
  labOut = {
    ...labOut,
    chat_session: sessionPending,
    pipeline_pending_job: { job_id: job.job_id, stage: "synthesis" },
  };
  labOut.pipeline_cursor = derivePipelineCursor(labOut);
  return { lab: labOut, job_id: job.job_id };
}

/** Write Stage1–3 outputs into LabSource and unlock delivery steps. */
export function seedLabSourceFromChat(lab: DeliveryLabSession): DeliveryLabSession {
  const session = lab.chat_session;
  if (!session) return lab;
  const agent = ensureAgentV2(session);
  const core = agent.breakthrough_core as BreakthroughCore | null;
  const clean = sanitizeLabDeliverySource({
    base_analysis: lab.source.base_analysis,
    breakthrough_core: core,
  });
  const covered = buildCoveredAgendaEvidence(agent);
  const desired =
    typeof agent.desired_direction?.wants === "string"
      ? agent.desired_direction.wants
      : lab.source.desired_outcome;

  return {
    ...lab,
    pipeline_delivery_unlocked: true,
    pipeline_cursor: "ready_for_delivery",
    source: {
      ...lab.source,
      base_analysis: clean.base_analysis,
      breakthrough_core: clean.breakthrough_core,
      covered_agenda: covered,
      original_question:
        agent.original_question?.trim() ||
        session.original_question?.trim() ||
        lab.source.original_question,
      desired_outcome: desired,
      question_category: agent.question_category ?? lab.source.question_category,
      pivot_chart_path: session.pivot_chart_path ?? lab.source.pivot_chart_path,
      partner_bazi: session.partner_bazi ?? lab.source.partner_bazi,
      dyad_compat_summary: session.dyad_compat_summary ?? lab.source.dyad_compat_summary,
      dyad_matrix_pack: session.dyad_matrix_pack ?? lab.source.dyad_matrix_pack,
    },
  };
}
