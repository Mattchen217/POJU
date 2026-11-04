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
  completeXhighJob,
  createXhighJob,
  failXhighJob,
  findLatestXhighJobForSession,
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
import { FACE_AGENDA_BLUEPRINT } from "@/lib/poju/report-blueprint";
import {
  ensureLabZiweiFactPack,
  formatZiweiClosedSetForPrompt,
} from "@/lib/ziwei/lab-ziwei";
import { prepareFrozenDcForDelivery } from "@/lib/poju/decision-context/freeze-to-delivery";
import { applySufficiencyFreezeToSession } from "@/lib/poju/decision-context/production-freeze-wire";
import { evaluateDecisionSufficiency } from "@/lib/poju/decision-context";
import { normalizeBaseAnalysisInput } from "@/lib/llm/prompts/base-analysis-context";
import { buildStructuredInstanceInventory } from "@/lib/base-analysis/build-structured-instance-inventory";
import { dyadSkipPatch } from "@/lib/poju/dyad-compat";
import { buildPivotChartPathLock, isDyadGateUnresolved } from "@/lib/poju/pivot-chart-path";
import { clearDyadGateUi } from "@/lib/poju/reply-options";
import { buildCoveredAgendaEvidence } from "@/lib/poju/investigation-agenda";
import { sanitizeLabDeliverySource } from "@/lib/llm/pro/delivery/lab/sanitize-delivery-source";
import { buildLabCallTrace, slimLabCallTrace } from "@/lib/llm/pro/delivery/lab/call-trace";
import { buildLabObservation } from "@/lib/llm/pro/delivery/lab/observation";
import { derivePipelineCursor } from "@/lib/llm/pro/delivery/lab/pipeline-cursor";
import {
  chatReadyForDeliveryUnlock,
} from "@/lib/llm/pro/delivery/lab/pipeline-reconcile";
import type { LabPipelineTurn } from "@/lib/llm/pro/delivery/lab/lab-pipeline-types";
import type { DeliveryLabSession } from "@/lib/llm/pro/delivery/lab/types";
import type { DecisionContextBinding } from "@/lib/poju/decision-context";

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
    report_pages: FACE_AGENDA_BLUEPRINT.filter((p) => p.input_role === "needs_reality").map((p) => ({
      id: p.faceId,
      title: p.title,
      purpose: p.reality_needs.join("；") || p.title,
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

/** Create Call B (agenda bridge) xhigh job; caller must hold session lock. */
async function createLabAgendaBridgeJob(input: {
  lab: DeliveryLabSession;
  session: POJUSessionState;
  locale: string;
  breakthrough_core: BreakthroughCore;
}): Promise<Awaited<ReturnType<typeof createXhighJob>>> {
  const { lab, session, locale, breakthrough_core } = input;
  const segment1_understanding = formatSegment1UnderstandingForPrompt(ensureAgentV2(session));
  const ziweiClosed = formatZiweiClosedSetForPrompt(ensureLabZiweiFactPack(lab));
  return createXhighJob({
    phase: "segment2_agenda_bridge",
    session_id: session.session_id,
    locale,
    job_input: {
      session_id: session.session_id,
      locale,
      original_question:
        session.agent_v2?.original_question?.trim() ||
        session.original_question?.trim() ||
        "",
      question_category: session.agent_v2?.question_category ?? null,
      breakthrough_core,
      ...(segment1_understanding.trim()
        ? { segment1_understanding: segment1_understanding.trim() }
        : {}),
      dyad_compat_summary: session.dyad_compat_summary ?? null,
      partner_bazi: session.partner_bazi ?? null,
      pivot_chart_path: session.pivot_chart_path ?? null,
      dyad_matrix_pack: session.dyad_matrix_pack ?? null,
      ziwei_closed_set: ziweiClosed || null,
    },
  });
}

function stripLabCallBArtifacts(session: POJUSessionState): POJUSessionState {
  const base = ensureAgentV2(session);
  const core = base.breakthrough_core;
  if (!core) throw new Error("missing_breakthrough_core_for_call_b_rerun");
  const messages = session.messages.filter(
    (m) =>
      !(
        m.role === "assistant" &&
        (m.meta?.segment2_bridge_question || m.meta?.segment2_agenda_bridge_failed)
      ),
  );
  return withSessionProfileFlags({
    ...session,
    messages,
    agent_v2: {
      ...base,
      breakthrough_core: { ...core, first_question: undefined },
      investigation_agenda: [],
      agenda_generated: false,
      current_phase: "collecting_context",
      core_generation_failed: false,
    },
    last_interaction_at: new Date().toISOString(),
  });
}

function stripLabCallAArtifacts(session: POJUSessionState): POJUSessionState {
  const base = ensureAgentV2(session);
  const messages = session.messages.filter(
    (m) =>
      !(
        m.role === "assistant" &&
        (m.meta?.segment2_analysis ||
          m.meta?.segment2_bridge_question ||
          m.meta?.segment2_agenda_bridge_failed ||
          m.meta?.core_generation_failed)
      ),
  );
  const freshQuestion =
    base.original_question?.trim() ||
    extractOpeningProblem(messages) ||
    session.original_question?.trim() ||
    "";
  return withSessionProfileFlags({
    ...session,
    messages,
    original_question: freshQuestion || session.original_question,
    agent_v2: markCorePending(
      { ...base, original_question: freshQuestion || base.original_question },
      freshQuestion || base.original_question || "",
    ),
    last_interaction_at: new Date().toISOString(),
  });
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
  opts?: {
    error?: string;
    raw_fallback?: unknown;
    session?: POJUSessionState | null;
    lab_id?: string | null;
  },
): import("@/lib/llm/pro/delivery/lab/lab-pipeline-types").LabPipelineAttempt[] {
  const duration_ms = Math.max(0, (job.completed_at ?? Date.now()) - job.created_at);
  const dc = opts?.session?.decision_context ?? null;
  const binding: DecisionContextBinding | null =
    opts?.session?.last_delivery_context_binding ?? null;
  const traces = Array.isArray(job.lab_call_traces) ? job.lab_call_traces : [];
  if (traces.length > 0) {
    return traces.map((t, i) => {
      const input_payload = {
        job_id: job.job_id,
        leg: t.phase,
        job_phase: job.phase,
        session_id: opts?.session?.session_id ?? job.session_id,
        dc_status: dc?.status ?? null,
        dc_hypotheses: dc?.hypotheses?.length ?? 0,
        dc_dirs: dc?.dirs?.length ?? 0,
        dc_facts: dc?.reality_facts?.length ?? 0,
      };
      return {
        attempt_number: i + 1,
        timestamp: new Date().toISOString(),
        duration_ms,
        call_trace: t,
        raw_model_output: t.parsed ?? t.raw_text ?? opts?.raw_fallback ?? job.result,
        error: opts?.error,
        input_payload,
        observation: buildLabObservation({
          stage: phase,
          step_key: `pipeline_${phase}`,
          session_id: opts?.session?.session_id ?? job.session_id,
          lab_id: opts?.lab_id ?? null,
          job_id: job.job_id,
          call_trace: t,
          input_payload,
          processing_actions: [
            { action: "xhigh_job", detail: job.phase },
            ...(opts?.error
              ? [{ action: "job_error", detail: opts.error }]
              : [{ action: "job_complete", detail: job.status }]),
          ],
          gate_verdict: opts?.error
            ? { passed: false, failed_rule: "job_failed", detail: opts.error }
            : { passed: true },
          raw_model_output: t.parsed ?? t.raw_text ?? opts?.raw_fallback ?? job.result,
          output_to_next_stage: opts?.raw_fallback ?? job.result,
          context_binding: binding,
          has_context_snapshot: Boolean(dc),
          context_status: dc?.status ?? null,
        }),
      };
    });
  }
  // Fallback when older jobs lack lab_call_traces
  const fallbackTrace = slimLabCallTrace(
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
          // Fallback synthetic trace: job may lack per-call usage write-back.
          usage_written:
            typeof job.tokens_used === "number" && job.tokens_used > 0 ? true : false,
          generation_id: job.job_id,
        },
      },
    }),
  );
  const input_payload = {
    job_id: job.job_id,
    phase: job.phase,
    session_id: opts?.session?.session_id ?? job.session_id,
  };
  return [
    {
      attempt_number: 1,
      timestamp: new Date().toISOString(),
      duration_ms,
      call_trace: fallbackTrace,
      raw_model_output: opts?.raw_fallback ?? job.result,
      error: opts?.error,
      input_payload,
      observation: buildLabObservation({
        stage: phase,
        step_key: `pipeline_${phase}`,
        session_id: opts?.session?.session_id ?? job.session_id,
        lab_id: opts?.lab_id ?? null,
        job_id: job.job_id,
        call_trace: fallbackTrace,
        input_payload,
        processing_actions: [{ action: "xhigh_job_fallback_trace", detail: job.phase }],
        gate_verdict: opts?.error
          ? { passed: false, failed_rule: "job_failed", detail: opts.error }
          : { passed: true },
        raw_model_output: opts?.raw_fallback ?? job.result,
        output_to_next_stage: opts?.raw_fallback ?? job.result,
        context_binding: binding,
        has_context_snapshot: Boolean(dc),
        context_status: dc?.status ?? null,
      }),
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
    const ziweiPack = ensureLabZiweiFactPack(lab);
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
        ziwei_closed_set: formatZiweiClosedSetForPrompt(ziweiPack),
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
  const session = clearDyadGateUi({
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
  const session: POJUSessionState = clearDyadGateUi({
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
    const mid = await getXhighJob(job_id);
    // Wave1 parks at voice_queued. Nested after() = fresh Vercel maxDuration for voice
    // (awaiting voice in this same invoke would still share the first 300s wall).
    if (mid?.status === "running" && mid.current_stage === "voice_queued") {
      const session_id = mid.session_id;
      const { after } = await import("next/server");
      after(async () => {
        try {
          await runSegment2BreakthroughCoreJob(job_id);
        } catch (e) {
          console.error("[lab-pipeline] Call A voice wave failed", e);
          const job = await getXhighJob(job_id);
          if (job && (job.status === "running" || job.status === "pending")) {
            await failXhighJob(
              job_id,
              e instanceof Error ? e.message : String(e),
              {
                retryable: true,
                failure_reason: "llm_timeout",
                accumulated_content: job.accumulated_content,
              },
            ).catch(() => undefined);
          }
        } finally {
          await releaseXhighSessionLock("segment2_breakthrough_core", session_id);
        }
      });
      return;
    }
  } finally {
    const job = await getXhighJob(job_id);
    if (
      job?.session_id &&
      !(
        job.status === "running" &&
        (job.current_stage === "voice_queued" || job.current_stage === "voice")
      )
    ) {
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

/**
 * Reconcile Stage1–3 → delivery unlock for stuck labs:
 * pending job apply, latest synthesis job recovery, or chat already has paths.
 */
export async function labReconcileFullPipeline(
  lab: DeliveryLabSession,
): Promise<DeliveryLabSession> {
  if (lab.mode !== "full_pipeline" || !lab.chat_session) return lab;
  if (lab.pipeline_delivery_unlocked) return lab;

  let working = lab;

  // 1) Apply recorded pending job (may salvage stale running synthesis).
  if (working.pipeline_pending_job) {
    try {
      const next = await labPollPipelineJob(working);
      if (next.pipeline_delivery_unlocked) return next;
      working = next;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[lab-pipeline] pending apply failed during reconcile", { msg });
      if (msg === "job_not_found") {
        working = {
          ...working,
          pipeline_pending_job: null,
          chat_session: {
            ...working.chat_session!,
            pending_synthesis_job_id: null,
          },
        };
      } else {
        throw e;
      }
    }
  }

  if (working.pipeline_delivery_unlocked) return working;

  // 2) Recover from session's latest synthesis job (pending pointer lost / mismatched).
  const sessionId = working.chat_session?.session_id;
  if (sessionId) {
    const latest = await findLatestXhighJobForSession("synthesis", sessionId);
    if (latest) {
      const probe: DeliveryLabSession = {
        ...working,
        pipeline_pending_job: { job_id: latest.job_id, stage: "synthesis" },
      };
      try {
        const next = await labPollPipelineJob(probe);
        if (next.pipeline_delivery_unlocked) return next;
        // Keep cleared pending if poll failed the job, else keep working.
        if (!next.pipeline_pending_job) working = next;
      } catch (e) {
        console.warn("[lab-pipeline] latest synthesis probe failed", {
          job_id: latest.job_id,
          err: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  if (working.pipeline_delivery_unlocked) return working;

  // 3) Chat already has synthesis writeback — just seed + unlock.
  const agent = ensureAgentV2(working.chat_session!);
  if (
    chatReadyForDeliveryUnlock({
      synthesis_status: agent.synthesis_status,
      breakthrough_core: agent.breakthrough_core,
    })
  ) {
    let out = seedLabSourceFromChat({
      ...working,
      pipeline_pending_job: null,
      chat_session: {
        ...working.chat_session!,
        pending_synthesis_job_id: null,
      },
    });
    out.pipeline_delivery_unlocked = true;
    out.pipeline_cursor = "ready_for_delivery";
    return out;
  }

  return working;
}

/** Ops escape hatch: unlock delivery with whatever Stage1–3 seed is on the lab. */
export async function labForceUnlockDelivery(
  lab: DeliveryLabSession,
): Promise<DeliveryLabSession> {
  if (lab.mode !== "full_pipeline") throw new Error("lab_not_full_pipeline");
  const reconciled = await labReconcileFullPipeline(lab);
  if (reconciled.pipeline_delivery_unlocked) return reconciled;
  let out = seedLabSourceFromChat({
    ...reconciled,
    pipeline_pending_job: null,
    chat_session: reconciled.chat_session
      ? { ...reconciled.chat_session, pending_synthesis_job_id: null }
      : reconciled.chat_session,
  });
  out.pipeline_delivery_unlocked = true;
  out.pipeline_cursor = "ready_for_delivery";
  return out;
}

/**
 * After a background runner finishes, fold job result into the lab and persist unlock.
 * Client poll alone is not enough: full-page refresh skips poll, and KV save can race.
 */
export async function labApplyPendingJobByLabId(lab_id: string): Promise<DeliveryLabSession | null> {
  const { loadDeliveryLab, saveDeliveryLab } = await import(
    "@/lib/llm/pro/delivery/lab/store"
  );
  const lab = await loadDeliveryLab(lab_id);
  if (!lab || lab.mode !== "full_pipeline") return lab;
  const next = await labReconcileFullPipeline(lab);
  if (next === lab) return lab;
  try {
    await saveDeliveryLab(next);
  } catch (e) {
    console.warn("[lab-pipeline] save after apply failed — retry slim traces", {
      lab_id,
      err: e instanceof Error ? e.message : String(e),
    });
    await saveDeliveryLab(slimPipelineTurnsForSave(next));
  }
  return next;
}

function slimPipelineTurnsForSave(lab: DeliveryLabSession): DeliveryLabSession {
  const turns = lab.pipeline_turns ?? [];
  if (turns.length <= 2) return lab;
  const keep = 2;
  const slimmed = turns.map((t, idx) => {
    if (idx >= turns.length - keep) return t;
    return {
      ...t,
      attempts: (t.attempts ?? []).map((a) => ({
        ...a,
        call_trace: a.call_trace
          ? {
              phase: a.call_trace.phase ?? t.phase,
              system: "",
              user: "",
              reasoning: null,
              raw_text: null,
              meta: a.call_trace.meta ?? {},
            }
          : a.call_trace,
        raw_model_output: undefined,
      })),
    };
  });
  return { ...lab, pipeline_turns: slimmed };
}

/** Poll pending job; apply into chat_session; auto-start Call B after Call A. */
export async function labPollPipelineJob(lab: DeliveryLabSession): Promise<DeliveryLabSession> {
  const pending = lab.pipeline_pending_job;
  if (!pending || !lab.chat_session) return lab;

  let job = await getXhighJob(pending.job_id);
  if (!job) throw new Error("job_not_found");

  // Salvage: worker died after LLM streamed JSON but before completeXhighJob.
  if (
    (job.status === "pending" || job.status === "running") &&
    pending.stage === "synthesis" &&
    Date.now() - job.updated_at > 45_000 &&
    (job.accumulated_content?.trim().length ?? 0) > 80
  ) {
    try {
      const { parseSynthesisResponse } = await import("@/lib/llm/deepseek/synthesis-task");
      const parsed = parseSynthesisResponse(job.accumulated_content!);
      await completeXhighJob(job.job_id, {
        accumulated_content: job.accumulated_content,
        result: {
          kind: "synthesis",
          primary_path: parsed.primary_path,
          backup_path: parsed.backup_path,
          action_plan: parsed.action_plan,
        },
      });
      console.warn("[lab-pipeline] salvaged stale synthesis job from accumulated_content", {
        job_id: job.job_id,
      });
      job = (await getXhighJob(pending.job_id)) ?? job;
    } catch (e) {
      console.warn("[lab-pipeline] synthesis salvage skipped", {
        job_id: job.job_id,
        err: e instanceof Error ? e.message : String(e),
      });
    }
  }

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
          session: lab.chat_session,
          lab_id: lab.lab_id,
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

    let sessionA = finalizeSegment2ReportSuccess({
      session: clearPendingSegment2Job(lab.chat_session),
      locale,
      breakthrough_core: job.result.breakthrough_core,
      model: job.model,
      tokens_used: job.tokens_used,
      llm_debug: job.llm_debug,
    });
    try {
      const { persistDcLifecycleChange } = await import(
        "@/lib/poju/decision-context/production-dc-lifecycle"
      );
      if (sessionA.decision_context) {
        const p = await persistDcLifecycleChange(
          lab.chat_session,
          sessionA,
          `dc_call_a:${sessionA.session_id}:lab_report`,
        );
        sessionA = p.session;
      }
    } catch (e) {
      console.warn("[lab-pipeline] Call A DC persist failed", e);
    }

    const turnA: LabPipelineTurn = {
      turn_id: newTurnId(),
      phase: "segment2_a",
      kind: "segment2_a",
      attempts: jobAttemptsFromTraces("segment2_a", job, {
        raw_fallback: job.result,
        session: sessionA,
        lab_id: lab.lab_id,
      }),
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
      agendaJob = await createLabAgendaBridgeJob({
        lab,
        session: sessionA,
        locale,
        breakthrough_core: core,
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
              session: lab.chat_session,
              lab_id: lab.lab_id,
            }),
          },
        ],
      };
      out.pipeline_cursor = derivePipelineCursor(out);
      return out;
    }

    let sessionB = finalizeSegment2AgendaBridgeSuccess({
      session: clearPendingSegment2Job(lab.chat_session),
      locale,
      investigation_agenda: job.result.investigation_agenda ?? [],
      first_question: job.result.first_question ?? "",
      // Production parity (POJUChatUI): Call B chips live on the bridge message.
      options: job.result.options,
      model: job.model,
      tokens_used: job.tokens_used,
      llm_debug: job.llm_debug,
    });
    try {
      const { persistDcLifecycleChange } = await import(
        "@/lib/poju/decision-context/production-dc-lifecycle"
      );
      if (sessionB.decision_context) {
        const p = await persistDcLifecycleChange(
          lab.chat_session,
          sessionB,
          `dc_call_b:${sessionB.session_id}:lab_agenda_${job.result.investigation_agenda?.length ?? 0}`,
        );
        sessionB = p.session;
      }
    } catch (e) {
      console.warn("[lab-pipeline] Call B DC persist failed", e);
    }

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
          attempts: jobAttemptsFromTraces("segment2_b", job, {
            raw_fallback: job.result,
            session: sessionB,
            lab_id: lab.lab_id,
          }),
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
              session: lab.chat_session,
              lab_id: lab.lab_id,
            }),
          },
        ],
      };
      out.pipeline_cursor = derivePipelineCursor(out);
      return out;
    }

    const primary = job.result.primary_path as ModernActionFrame;
    const backup = job.result.backup_path as ModernActionFrame;
    const agentShell = ensureAgentV2(lab.chat_session);
    let sessionDone: import("@/lib/poju/types").POJUSessionState;
    if (!agentShell.breakthrough_core) {
      // Rare: Call A core missing on lab chat — still unlock delivery with synthesis paths.
      console.warn("[lab-pipeline] synthesis apply without breakthrough_core — seed paths only");
      sessionDone = {
        ...lab.chat_session,
        pending_synthesis_job_id: null,
        agent_v2: {
          ...agentShell,
          synthesis_status: "done",
          synthesis_generation_failed: false,
          breakthrough_core: {
            primary_path: primary,
            backup_path: backup,
            modern_action_frames: [primary, backup],
          } as unknown as BreakthroughCore,
        },
      };
    } else {
      sessionDone = await finalizeSynthesisJobSuccess({
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
    }

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
          attempts: jobAttemptsFromTraces("synthesis", job, {
            raw_fallback: job.result,
            session: sessionDone,
            lab_id: lab.lab_id,
          }),
        },
      ],
    };
    out = seedLabSourceFromChat(out);
    // Belt-and-suspenders: seed must unlock even if cursor derive races.
    out.pipeline_delivery_unlocked = true;
    out.pipeline_cursor = "ready_for_delivery";
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

  // S5/S8: LAB parity with production — Freeze on sufficiency before synthesis.
  // Lab sessions live in Ops KV (not Session C1), so apply in-memory freeze only.
  if (
    !agent_v2.stall_offer_pending &&
    agent_v2.delivery_mode !== "degraded"
  ) {
    const freeze = applySufficiencyFreezeToSession(sessionPending);
    if (freeze.ok) {
      sessionPending = withSessionProfileFlags({
        ...freeze.session,
        original_question: freshQuestion,
        messages: messagesWithUser,
        agent_v2,
        last_interaction_at: new Date().toISOString(),
      });
      if (!freeze.skipped && "pack" in freeze) {
        try {
          const prepared = prepareFrozenDcForDelivery({
            decision_context: sessionPending.decision_context,
            decision_context_versions: sessionPending.decision_context_versions,
          });
          sessionPending = {
            ...sessionPending,
            last_delivery_context_binding: prepared.decision_context_binding,
          };
        } catch (e) {
          console.warn("[lab-pipeline] freeze binding prepare failed", e);
        }
      } else if (freeze.skipped && freeze.binding) {
        sessionPending = {
          ...sessionPending,
          last_delivery_context_binding: freeze.binding,
        };
      }
    } else if (sessionPending.decision_context?.status === "draft") {
      if (evaluateDecisionSufficiency(sessionPending.decision_context).canStop) {
        throw new Error(`DC_FREEZE_FAILED:${freeze.reason}`);
      }
    }
  }

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

/**
 * Rerun Call B only: drop last segment2_b turn + bridge bubble, keep Call A,
 * enqueue a fresh agenda_bridge job.
 */
export async function rerunLabSegment2B(lab: DeliveryLabSession): Promise<DeliveryLabSession> {
  if (lab.mode !== "full_pipeline" || !lab.chat_session) {
    throw new Error("lab_not_full_pipeline");
  }
  if (lab.pipeline_pending_job) throw new Error("pipeline_job_pending");

  const turns = [...(lab.pipeline_turns ?? [])];
  let lastIdx = -1;
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i]?.kind === "segment2_b") {
      lastIdx = i;
      break;
    }
  }
  if (lastIdx < 0) throw new Error("no_segment2_b_turn_to_rerun");

  const locale = resolvePivotSessionLang(lab.chat_session, lab.source.locale || "zh");
  const cleaned = stripLabCallBArtifacts(lab.chat_session);
  const core = ensureAgentV2(cleaned).breakthrough_core;
  if (!core) throw new Error("missing_breakthrough_core_for_call_b_rerun");

  const sessionId = cleaned.session_id;
  const locked = await acquireXhighSessionLock("segment2_agenda_bridge", sessionId);
  if (!locked) throw new Error("segment2_job_in_progress");

  let agendaJob;
  try {
    agendaJob = await createLabAgendaBridgeJob({
      lab,
      session: cleaned,
      locale,
      breakthrough_core: core,
    });
  } catch (e) {
    await releaseXhighSessionLock("segment2_agenda_bridge", sessionId);
    throw e;
  }

  const out: DeliveryLabSession = {
    ...lab,
    chat_session: withPendingSegment2Job(cleaned, agendaJob.job_id, "agenda"),
    pipeline_pending_job: { job_id: agendaJob.job_id, stage: "segment2_b" },
    pipeline_turns: turns.slice(0, lastIdx),
    pipeline_delivery_unlocked: false,
    source: {
      ...lab.source,
      breakthrough_core: core,
    },
  };
  out.pipeline_cursor = derivePipelineCursor(out);
  return out;
}

/**
 * Rerun Call A (and the auto Call B that follows): drop segment2_a/b turns +
 * analysis/bridge bubbles, enqueue a fresh breakthrough_core job.
 */
export async function rerunLabSegment2A(lab: DeliveryLabSession): Promise<DeliveryLabSession> {
  if (lab.mode !== "full_pipeline" || !lab.chat_session) {
    throw new Error("lab_not_full_pipeline");
  }
  if (lab.pipeline_pending_job) throw new Error("pipeline_job_pending");

  const turns = [...(lab.pipeline_turns ?? [])];
  let lastAIdx = -1;
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i]?.kind === "segment2_a") {
      lastAIdx = i;
      break;
    }
  }
  if (lastAIdx < 0) throw new Error("no_segment2_a_turn_to_rerun");

  // Drop Call A and everything after it (Call B / later collecting chats that
  // depended on the prior analysis).
  const locale = resolvePivotSessionLang(lab.chat_session, lab.source.locale || "zh");
  const cleaned = stripLabCallAArtifacts(lab.chat_session);
  const agent_v2 = ensureAgentV2(cleaned);
  const freshQuestion =
    agent_v2.original_question?.trim() ||
    cleaned.original_question?.trim() ||
    "";
  if (!freshQuestion) throw new Error("missing_question_for_call_a_rerun");

  const sessionId = cleaned.session_id;
  const locked = await acquireXhighSessionLock("segment2_breakthrough_core", sessionId);
  if (!locked) throw new Error("segment2_job_in_progress");

  let job;
  try {
    const ziweiPack = ensureLabZiweiFactPack(lab);
    job = await createXhighJob({
      phase: "segment2_breakthrough_core",
      session_id: sessionId,
      locale,
      job_input: {
        session_id: sessionId,
        original_question: freshQuestion,
        locale,
        profile_id: cleaned.selected_stored_profile_id?.trim() || null,
        agent_v2,
        base_analysis: lab.source.base_analysis,
        dyad_compat_summary: cleaned.dyad_compat_summary ?? null,
        partner_bazi: cleaned.partner_bazi ?? null,
        pivot_chart_path: cleaned.pivot_chart_path ?? null,
        dyad_matrix_pack: cleaned.dyad_matrix_pack ?? null,
        ziwei_closed_set: formatZiweiClosedSetForPrompt(ziweiPack),
      },
    });
  } catch (e) {
    await releaseXhighSessionLock("segment2_breakthrough_core", sessionId);
    throw e;
  }

  const out: DeliveryLabSession = {
    ...lab,
    chat_session: withPendingSegment2Job(cleaned, job.job_id, "report"),
    pipeline_pending_job: { job_id: job.job_id, stage: "segment2_a" },
    pipeline_turns: turns.slice(0, lastAIdx),
    pipeline_delivery_unlocked: false,
    source: {
      ...lab.source,
      original_question: freshQuestion,
      breakthrough_core: undefined,
    },
  };
  out.pipeline_cursor = derivePipelineCursor(out);
  return out;
}

/**
 * Rerun synthesis: drop last synthesis turn + unlock, re-enqueue from
 * awaiting_confirmation state (keeps collecting transcript + Call A/B).
 */
export async function rerunLabSynthesis(lab: DeliveryLabSession): Promise<DeliveryLabSession> {
  if (lab.mode !== "full_pipeline" || !lab.chat_session) {
    throw new Error("lab_not_full_pipeline");
  }
  if (lab.pipeline_pending_job) throw new Error("pipeline_job_pending");

  const turns = [...(lab.pipeline_turns ?? [])];
  let lastIdx = -1;
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i]?.kind === "synthesis") {
      lastIdx = i;
      break;
    }
  }
  if (lastIdx < 0) throw new Error("no_synthesis_turn_to_rerun");

  const locale = resolvePivotSessionLang(lab.chat_session, lab.source.locale || "zh");
  const base = ensureAgentV2(lab.chat_session);
  const core = base.breakthrough_core;
  if (!core) throw new Error("missing_breakthrough_core_for_synthesis_rerun");

  // Roll phase back to awaiting_confirmation so labSynthesisConfirm can fire.
  // Drop the synthesis_confirm gate turn if it sits just before synthesis.
  let cutIdx = lastIdx;
  if (cutIdx > 0 && turns[cutIdx - 1]?.kind === "gate" && turns[cutIdx - 1]?.gate?.action === "synthesis_confirm") {
    cutIdx -= 1;
  }

  let session = ensureSessionCycles(lab.chat_session);
  // Drop the synthetic confirm user bubble if it is the last user message.
  const confirmLabel = deliveryConfirmButtonLabel(locale);
  const msgs = [...session.messages];
  if (msgs[msgs.length - 1]?.role === "user" && msgs[msgs.length - 1]!.content.trim() === confirmLabel) {
    msgs.pop();
  }
  session = withSessionProfileFlags({
    ...session,
    messages: msgs,
    pending_synthesis_job_id: null,
    agent_v2: {
      ...base,
      current_phase: "awaiting_confirmation",
      synthesis_status: undefined,
      synthesis_generation_failed: false,
    },
    last_interaction_at: new Date().toISOString(),
  });

  const rolled: DeliveryLabSession = {
    ...lab,
    chat_session: session,
    pipeline_turns: turns.slice(0, cutIdx),
    pipeline_pending_job: null,
    pipeline_delivery_unlocked: false,
  };
  rolled.pipeline_cursor = derivePipelineCursor(rolled);
  return (await labSynthesisConfirm(rolled)).lab;
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

  let decision_context_binding =
    lab.source.decision_context_binding ??
    session.last_delivery_context_binding ??
    null;
  let decision_context_snapshot = lab.source.decision_context_snapshot ?? null;
  if (
    session.decision_context &&
    (session.decision_context.status === "final" ||
      session.decision_context.status === "superseded")
  ) {
    try {
      const prepared = prepareFrozenDcForDelivery({
        decision_context: session.decision_context,
        decision_context_versions: session.decision_context_versions,
      });
      decision_context_binding = prepared.decision_context_binding;
      decision_context_snapshot = prepared.decision_context_snapshot;
    } catch (e) {
      console.warn("[lab-pipeline] seed DC binding failed", e);
      decision_context_snapshot = session.decision_context;
    }
  }

  return {
    ...lab,
    pipeline_delivery_unlocked: true,
    pipeline_cursor: "ready_for_delivery",
    chat_session: {
      ...session,
      last_delivery_context_binding:
        decision_context_binding ?? session.last_delivery_context_binding ?? null,
    },
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
      decision_context_binding,
      decision_context_snapshot,
    },
  };
}
