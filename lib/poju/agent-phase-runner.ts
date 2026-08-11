/**
 * Step H — central phase dispatch (opening → collecting → confirmation → delivery → tracking).
 * Used by `poju-llm` (server) and maps results for `agent.ts` via `/api/poju/chat`.
 *
 * POJU v6 prompt transport (production default). Rollback: ENABLE_POJU_V6=false
 */
import { callCollectingPhase } from "@/lib/llm/phases/collecting-phase";
import { callCollectingPhaseV6 } from "@/lib/llm/phases/collecting-phase-v6";
import { callConfirmationPhase } from "@/lib/llm/phases/confirmation-phase";
import { callConfirmationPhaseV6 } from "@/lib/llm/phases/confirmation-phase-v6";
import { callDeliveryPhase } from "@/lib/llm/phases/delivery-phase";
import { callDeliveryPhaseV6 } from "@/lib/llm/phases/delivery-phase-v6";
import { callOpeningPhase } from "@/lib/llm/phases/opening-phase";
import { callOpeningPhaseV6 } from "@/lib/llm/phases/opening-phase-v6";
import { callTrackingPhase } from "@/lib/llm/phases/tracking-phase";
import { callTrackingPhaseV6 } from "@/lib/llm/phases/tracking-phase-v6";
import type { PhaseLLMInput, PhaseLLMResult } from "@/lib/llm/phases/types";
import { isPojuV6Enabled } from "@/lib/poju/poju-v6-flag";
import { resolveActiveAgentPhase } from "@/lib/poju/state-machine";
import { mapPhaseResultToChatPayload } from "@/lib/poju/phase-llm-mapper";
import type { AgentPhase } from "@/lib/poju/agent-state";
import {
  computeCollectingPullback,
  getUncoveredCriticalLabels,
} from "@/lib/poju/investigation-agenda";
import { countUserTurns } from "@/lib/poju/summary-readiness";
import { getLastUserMessageContent } from "@/lib/poju/context-helpers";
import type { POJUSessionState } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";
import type { PojuChatAttachment } from "@/lib/poju/attachments/types";
import {
  attachmentErrorMessage,
  processChatAttachment,
} from "@/lib/poju/attachments/process-attachment";

export type AgentPhaseLLMResult = Record<string, unknown> & {
  phase: PhaseLLMResult;
  activePhase: AgentPhase;
};

function buildPhaseInput(
  session: POJUSessionState,
  profile: UserProfile | null,
  locale: string,
  base_analysis?: unknown | null,
  archive_data?: PhaseLLMInput["archive_data"],
  tool_injection_context?: string | null,
  stream_hooks?: PhaseLLMInput["stream_hooks"],
  signal?: AbortSignal,
  activePhase?: AgentPhase,
): PhaseLLMInput {
  const user_message = getLastUserMessageContent(session);
  const agent = session.agent_v2 ?? null;
  const userTurns = countUserTurns(session);
  const collecting_pullback =
    activePhase === "collecting_context"
      ? computeCollectingPullback({ userMessage: user_message, agent, userTurns })
      : false;
  const uncovered_critical_labels =
    agent?.investigation_agenda?.length
      ? getUncoveredCriticalLabels(agent.investigation_agenda)
      : [];
  return {
    session,
    profile,
    base_analysis: base_analysis ?? null,
    locale,
    user_message,
    agent_state: agent,
    archive_data: archive_data ?? null,
    tool_injection_context: tool_injection_context ?? null,
    stream_hooks,
    signal,
    collecting_pullback,
    uncovered_critical_labels,
    // escalation_stage 由 active_question_state 承载;不再预注入 collecting_escalation_level。
  };
}

async function dispatchPhase(activePhase: AgentPhase, input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const v6 = isPojuV6Enabled();
  switch (activePhase) {
    case "opening":
      return v6 ? callOpeningPhaseV6(input) : callOpeningPhase(input);
    case "collecting_context":
      return v6 ? callCollectingPhaseV6(input) : callCollectingPhase(input);
    case "awaiting_understanding_confirm":
      return v6 ? callOpeningPhaseV6(input) : callOpeningPhase(input);
    case "awaiting_confirmation":
      return v6 ? callConfirmationPhaseV6(input) : callConfirmationPhase(input);
    case "delivered":
      return v6 ? callDeliveryPhaseV6(input) : callDeliveryPhase(input);
    case "tracking":
      return v6 ? callTrackingPhaseV6(input) : callTrackingPhase(input);
    default:
      return v6 ? callCollectingPhaseV6(input) : callCollectingPhase(input);
  }
}

function dilemmaHintFromAgent(session: POJUSessionState): string | null {
  const d = session.agent_v2?.core_dilemma;
  if (!d) return null;
  const parts = [d.concrete_event, d.stakes, d.sticking_point].filter(
    (x): x is string => typeof x === "string" && x.trim().length > 0,
  );
  return parts.length ? parts.join(" / ") : null;
}

/** Run the active agent phase LLM module and map to chat API payload shape. */
export async function executeAgentPhaseLLM(input: {
  session: POJUSessionState;
  profile: UserProfile | null;
  base_analysis?: unknown | null;
  archive_data?: PhaseLLMInput["archive_data"];
  locale: string;
  tool_injection_context?: string | null;
  stream_hooks?: PhaseLLMInput["stream_hooks"];
  signal?: AbortSignal;
  attachment?: PojuChatAttachment | null;
}): Promise<AgentPhaseLLMResult> {
  const {
    session,
    profile,
    locale,
    base_analysis,
    archive_data,
    tool_injection_context,
    stream_hooks,
    signal,
    attachment,
  } = input;

  let workingSession = session;
  if (attachment?.data_url) {
    const lastUser = [...session.messages].reverse().find((m) => m.role === "user");
    const userText = lastUser?.content ?? "";
    const processed = await processChatAttachment({
      attachment,
      userText,
      locale,
      dilemmaHint: dilemmaHintFromAgent(session),
      signal,
    });
    if (processed.error && !processed.context_text) {
      const msg = attachmentErrorMessage(processed.error, locale);
      return {
        response: msg,
        model: "poju-attachment",
        tokens_used: 0,
        user_intent: "unclear",
        current_state: resolveActiveAgentPhase(session),
        action_requested: "continue_chat",
        topic_drift_detected: false,
        topic_drift_signal: "none",
        should_show_new_session_button: false,
        context_updates: {},
        contains_delivery: false,
        suggest_refund: false,
        agent_suggested_phase: resolveActiveAgentPhase(session),
        phase: {
          response: msg,
          suggested_phase: null,
          context_updates: {},
          question_category: null,
          current_summary: null,
          main_delivery_data: null,
          actions: [],
          tokens_used: 0,
          total_cost: 0,
          call_count: 0,
        },
        activePhase: resolveActiveAgentPhase(session),
      } as AgentPhaseLLMResult;
    }
    if (processed.context_text && lastUser) {
      const enriched = userText.trim()
        ? `${userText.trim()}\n\n${processed.context_text}`
        : processed.context_text;
      workingSession = {
        ...session,
        messages: session.messages.map((m, i) =>
          i === session.messages.length - 1 && m.role === "user"
            ? { ...m, content: enriched }
            : m,
        ),
      };
    }
  }

  const activePhase = resolveActiveAgentPhase(workingSession);
  if (isPojuV6Enabled()) {
    console.info("[poju-v6] transport active", { activePhase, session_id: workingSession.session_id });
  }
  const phaseInput = buildPhaseInput(
    workingSession,
    profile,
    locale,
    base_analysis,
    archive_data,
    tool_injection_context,
    stream_hooks,
    signal,
    activePhase,
  );
  const phase = await dispatchPhase(activePhase, phaseInput);
  const mapped = mapPhaseResultToChatPayload(phase, {
    session: workingSession,
    profile,
    locale,
    fallbackPhase: activePhase,
  });

  return {
    ...(mapped as Record<string, unknown>),
    phase,
    activePhase,
  } as AgentPhaseLLMResult;
}
