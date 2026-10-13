/**
 * Ops LAB Stage1–3 chat turn + LabCallTrace capture + rerun.
 */

import { randomBytes } from "node:crypto";
import { handleUserMessage } from "@/lib/poju/agent";
import { normalizeAgentPhase } from "@/lib/poju/agent-state";
import { buildLabCallTrace, slimLabCallTrace } from "@/lib/llm/pro/delivery/lab/call-trace";
import {
  derivePipelineCursor,
  lastAssistantOptions,
} from "@/lib/llm/pro/delivery/lab/pipeline-cursor";
import type {
  LabPipelineTurn,
} from "@/lib/llm/pro/delivery/lab/lab-pipeline-types";
import type { DeliveryLabSession } from "@/lib/llm/pro/delivery/lab/types";
import type { POJUSessionState } from "@/lib/poju/types";

function newTurnId(): string {
  return `pt_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
}

function lastAssistant(session: POJUSessionState) {
  for (let i = session.messages.length - 1; i >= 0; i--) {
    const m = session.messages[i];
    if (m?.role === "assistant") return m;
  }
  return null;
}

function buildTraceFromTurn(input: {
  phase: string;
  system: string;
  user: string;
  session: POJUSessionState;
}): ReturnType<typeof buildLabCallTrace> {
  const asst = lastAssistant(input.session);
  const meta = asst?.meta;
  const dbg = meta?.llm_debug as
    | {
        actual_model?: string;
        thinking_effort?: string;
        thinking_enabled?: boolean;
        tokens_used?: number;
        prompt_tokens?: number;
        completion_tokens?: number;
        reasoning_tokens?: number | null;
        latency_ms?: number;
        generation_id?: string | null;
        finish_reason?: string | null;
      }
    | undefined;
  // Turn-context / feed is usually the last user block in the transport user string.
  const userParts = input.user.split(/\n\n---\n\n/);
  const user_feed =
    userParts.length > 1 ? userParts[userParts.length - 1]!.trim() : undefined;

  return slimLabCallTrace(
    buildLabCallTrace({
      phase: input.phase,
      system: input.system,
      user: input.user,
      user_feed,
      raw_text: asst?.content ?? null,
      parsed: asst?.meta
        ? {
            options: asst.options ?? null,
            current_state: asst.meta.current_state,
            understanding_gate_pending: asst.meta.understanding_gate_pending,
            dyad_gate_pending: asst.meta.dyad_gate_pending,
          }
        : undefined,
      result: {
        reasoning: typeof meta?.thinking_process === "string" ? meta.thinking_process : undefined,
        actual_model:
          (typeof meta?.llm_model === "string" ? meta.llm_model : dbg?.actual_model) ??
          "unknown",
        meta: {
          call_type: "chat_flash",
          tokens_used: Number(dbg?.tokens_used ?? meta?.tokens_used ?? 0),
          latency_ms: Number(dbg?.latency_ms ?? 0),
          cost_usd: 0,
          cached_tokens: 0,
          thinking_enabled: Boolean(dbg?.thinking_enabled),
          thinking_effort: (dbg?.thinking_effort as "medium") ?? "medium",
          prompt_tokens: dbg?.prompt_tokens,
          completion_tokens: dbg?.completion_tokens,
          reasoning_tokens: dbg?.reasoning_tokens ?? undefined,
          generation_id: dbg?.generation_id ?? null,
          finish_reason: dbg?.finish_reason ?? null,
        },
      },
    }),
  );
}

export async function runLabPipelineChatTurn(input: {
  lab: DeliveryLabSession;
  userMessage: string;
}): Promise<DeliveryLabSession> {
  if (input.lab.mode !== "full_pipeline" || !input.lab.chat_session) {
    throw new Error("lab_not_full_pipeline");
  }
  if (input.lab.pipeline_pending_job) {
    throw new Error("pipeline_job_pending");
  }

  const locale = input.lab.source.locale || "zh";
  let captured = { system: "", user: "" };
  const t0 = Date.now();
  const phaseBefore =
    normalizeAgentPhase(input.lab.chat_session.agent_v2?.current_phase) ?? "opening";

  const nextSession = await handleUserMessage({
    session: input.lab.chat_session,
    userMessage: input.userMessage,
    locale,
    server_invoke: {
      base_analysis: input.lab.source.base_analysis,
      profile: null,
      skip_delivery_pipeline: true,
      lab_prompt_capture: (p) => {
        captured = p;
      },
    },
  });

  const phaseAfter =
    normalizeAgentPhase(nextSession.agent_v2?.current_phase) ?? phaseBefore;
  const asst = lastAssistant(nextSession);
  const turn: LabPipelineTurn = {
    turn_id: newTurnId(),
    phase: String(phaseAfter),
    kind: "chat",
    user_input: input.userMessage,
    attempts: [
      {
        attempt_number: 1,
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - t0,
        call_trace: buildTraceFromTurn({
          phase: String(phaseBefore),
          system: captured.system,
          user: captured.user,
          session: nextSession,
        }),
        input_payload: {
          user_message: input.userMessage,
          phase_before: phaseBefore,
        },
        raw_model_output: {
          content: asst?.content ?? null,
          options: asst?.options ?? null,
          meta: asst?.meta ?? null,
        },
      },
    ],
  };

  const lab: DeliveryLabSession = {
    ...input.lab,
    chat_session: nextSession,
    pipeline_turns: [...(input.lab.pipeline_turns ?? []), turn],
    source: {
      ...input.lab.source,
      original_question:
        nextSession.original_question?.trim() || input.lab.source.original_question,
      desired_outcome:
        typeof nextSession.agent_v2?.desired_direction?.wants === "string"
          ? nextSession.agent_v2.desired_direction.wants
          : input.lab.source.desired_outcome,
      question_category:
        nextSession.agent_v2?.question_category ?? input.lab.source.question_category,
    },
  };
  lab.pipeline_cursor = derivePipelineCursor(lab);
  return lab;
}

/** Drop last assistant (+ matching user if present) and re-run with same user_input. */
export async function rerunLabPipelineLastChatTurn(
  lab: DeliveryLabSession,
): Promise<DeliveryLabSession> {
  if (lab.mode !== "full_pipeline" || !lab.chat_session) {
    throw new Error("lab_not_full_pipeline");
  }
  const turns = [...(lab.pipeline_turns ?? [])];
  let lastChatIdx = -1;
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i]?.kind === "chat") {
      lastChatIdx = i;
      break;
    }
  }
  if (lastChatIdx < 0) throw new Error("no_chat_turn_to_rerun");
  const lastTurn = turns[lastChatIdx]!;
  const userInput = lastTurn.user_input?.trim();
  if (!userInput) throw new Error("missing_user_input_for_rerun");

  // Rewind messages: remove last assistant and the user turn that produced it.
  let messages = [...lab.chat_session.messages];
  if (messages[messages.length - 1]?.role === "assistant") {
    messages = messages.slice(0, -1);
  }
  if (
    messages[messages.length - 1]?.role === "user" &&
    messages[messages.length - 1]!.content.trim() === userInput
  ) {
    messages = messages.slice(0, -1);
  }

  const rewindSession: POJUSessionState = {
    ...lab.chat_session,
    messages,
  };

  const withoutLast: DeliveryLabSession = {
    ...lab,
    chat_session: rewindSession,
    pipeline_turns: turns.slice(0, lastChatIdx),
  };

  const attemptBase = lastTurn.attempts.length;
  const locale = lab.source.locale || "zh";
  let captured = { system: "", user: "" };
  const t0 = Date.now();
  const phaseBefore =
    normalizeAgentPhase(rewindSession.agent_v2?.current_phase) ?? "opening";

  const nextSession = await handleUserMessage({
    session: rewindSession,
    userMessage: userInput,
    locale,
    server_invoke: {
      base_analysis: lab.source.base_analysis,
      profile: null,
      skip_delivery_pipeline: true,
      lab_prompt_capture: (p) => {
        captured = p;
      },
    },
  });

  const phaseAfter =
    normalizeAgentPhase(nextSession.agent_v2?.current_phase) ?? phaseBefore;
  const asst = lastAssistant(nextSession);
  const newAttempt = {
    attempt_number: attemptBase + 1,
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - t0,
    call_trace: buildTraceFromTurn({
      phase: String(phaseBefore),
      system: captured.system,
      user: captured.user,
      session: nextSession,
    }),
    input_payload: { user_message: userInput, phase_before: phaseBefore, rerun: true },
    raw_model_output: {
      content: asst?.content ?? null,
      options: asst?.options ?? null,
      meta: asst?.meta ?? null,
    },
  };

  const rebuiltTurn: LabPipelineTurn = {
    ...lastTurn,
    phase: String(phaseAfter),
    attempts: [...lastTurn.attempts, newAttempt],
  };

  const out: DeliveryLabSession = {
    ...withoutLast,
    chat_session: nextSession,
    pipeline_turns: [...(withoutLast.pipeline_turns ?? []), rebuiltTurn],
  };
  out.pipeline_cursor = derivePipelineCursor(out);
  return out;
}

export function labChatPublicSlice(lab: DeliveryLabSession) {
  const session = lab.chat_session;
  return {
    mode: lab.mode ?? "delivery_only",
    pipeline_cursor: derivePipelineCursor(lab),
    pipeline_delivery_unlocked: Boolean(lab.pipeline_delivery_unlocked),
    pipeline_pending_job: lab.pipeline_pending_job ?? null,
    pipeline_turns: lab.pipeline_turns ?? [],
    chat_session: session
      ? {
          session_id: session.session_id,
          original_question: session.original_question,
          messages: session.messages.map((m) => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
            options: m.options,
            meta: m.meta
              ? {
                  current_state: m.meta.current_state,
                  understanding_gate_pending: m.meta.understanding_gate_pending,
                  dyad_gate_pending: m.meta.dyad_gate_pending,
                  segment2_analysis: m.meta.segment2_analysis,
                  thinking_process: m.meta.thinking_process,
                  tokens_used: m.meta.tokens_used,
                  llm_model: m.meta.llm_model,
                }
              : undefined,
          })),
          agent_phase: session.agent_v2?.current_phase ?? null,
          pivot_chart_path: session.pivot_chart_path ?? null,
          dyad_offer_status: session.dyad_offer_status ?? "none",
          has_breakthrough_core: session.agent_v2?.breakthrough_core != null,
          options: lastAssistantOptions(session),
        }
      : null,
  };
}
