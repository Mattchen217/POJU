import type { AgentPhase } from "@/lib/poju/agent-state";
import { callCollectingPhase } from "@/lib/llm/phases/collecting-phase";
import { callConfirmationPhase } from "@/lib/llm/phases/confirmation-phase";
import { callGreetingPhase } from "@/lib/llm/phases/greeting-phase";
import { callOpeningPhase } from "@/lib/llm/phases/opening-phase";
import { resolveSessionHasProfile } from "@/lib/poju/session-profile";
import { callTrackingPhase } from "@/lib/llm/phases/tracking-phase";
import type { PhaseLLMInput, PhaseLLMResult } from "@/lib/llm/phases/types";
import { normalizeAgentPhase } from "@/lib/poju/agent-state";
import { getLastUserMessageContent } from "@/lib/poju/context-helpers";
import type { POJUSessionState } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

export function resolveActiveAgentPhase(session: POJUSessionState): AgentPhase {
  if (session.main_delivery_done) return "tracking";
  const normalized = normalizeAgentPhase(session.agent_v2?.current_phase);
  if (normalized) return normalized;
  return "opening";
}

/** Route to Step 10–14 phase modules (Part2). Delivery (Step 13) stays client-orchestrated. */
export async function callPhaseSpecificLLM(input: {
  session: POJUSessionState;
  profile: UserProfile | null;
  locale: string;
}): Promise<{ phase: PhaseLLMResult; activePhase: AgentPhase }> {
  const activePhase = resolveActiveAgentPhase(input.session);
  const user_message = getLastUserMessageContent(input.session);

  const phaseInput: PhaseLLMInput = {
    session: input.session,
    profile: input.profile,
    locale: input.locale,
    user_message,
    agent_state: input.session.agent_v2 ?? null,
  };

  switch (activePhase) {
    case "opening":
      if (resolveSessionHasProfile(input.session) || input.profile) {
        return { phase: await callOpeningPhase(phaseInput), activePhase: "opening" };
      }
      return { phase: await callGreetingPhase(phaseInput), activePhase: "opening" };
    case "collecting_context":
      return { phase: await callCollectingPhase(phaseInput), activePhase: "collecting_context" };
    case "awaiting_confirmation":
      return { phase: await callConfirmationPhase(phaseInput), activePhase };
    case "delivered":
    case "tracking":
      return { phase: await callTrackingPhase(phaseInput), activePhase: "tracking" };
    default:
      return { phase: await callCollectingPhase(phaseInput), activePhase: "collecting_context" };
  }
}
