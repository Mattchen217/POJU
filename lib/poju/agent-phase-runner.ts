/**
 * Step H — central phase dispatch (opening → collecting → confirmation → delivery → tracking).
 * Used by `poju-llm` (server) and maps results for `agent.ts` via `/api/poju/chat`.
 */
import { callCollectingPhase } from "@/lib/llm/phases/collecting-phase";
import { callConfirmationPhase } from "@/lib/llm/phases/confirmation-phase";
import { callDeliveryPhase } from "@/lib/llm/phases/delivery-phase";
import { callOpeningPhase } from "@/lib/llm/phases/opening-phase";
import { callTrackingPhase } from "@/lib/llm/phases/tracking-phase";
import type { PhaseLLMInput, PhaseLLMResult } from "@/lib/llm/phases/types";
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
  switch (activePhase) {
    case "opening":
      return callOpeningPhase(input);
    case "collecting_context":
      return callCollectingPhase(input);
    case "awaiting_confirmation":
      return callConfirmationPhase(input);
    case "delivered":
      return callDeliveryPhase(input);
    case "tracking":
      return callTrackingPhase(input);
    default:
      return callCollectingPhase(input);
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
