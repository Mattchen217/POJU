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
import { resolvePreCallEscalation } from "@/lib/poju/collection-progress";
import { countUserTurns } from "@/lib/poju/summary-readiness";
import { getLastUserMessageContent } from "@/lib/poju/context-helpers";
import type { POJUSessionState } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

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
  const collecting_escalation_level =
    activePhase === "collecting_context"
      ? resolvePreCallEscalation({ agent, collecting_pullback })
      : undefined;

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
    collecting_escalation_level,
  };
}

async function dispatchPhase(activePhase: AgentPhase, input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const v6 = isPojuV6Enabled();
  switch (activePhase) {
    case "opening":
      return v6 ? callOpeningPhaseV6(input) : callOpeningPhase(input);
    case "collecting_context":
      return v6 ? callCollectingPhaseV6(input) : callCollectingPhase(input);
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
  } = input;

  const activePhase = resolveActiveAgentPhase(session);
  if (isPojuV6Enabled()) {
    console.info("[poju-v6] transport active", { activePhase, session_id: session.session_id });
  }
  const phaseInput = buildPhaseInput(
    session,
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
    session,
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
