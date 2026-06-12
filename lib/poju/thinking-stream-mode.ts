import { normalizeAgentPhase } from "@/lib/poju/agent-state";
import { findPendingToolInjection } from "@/lib/poju/find-pending-tool-injection";
import type { POJUSessionState } from "@/lib/poju/types";

export type ThinkingStreamMode =
  | "flash"
  | "collecting"
  | "analyzing"
  | "preparing_delivery";

export function resolveThinkingStreamMode(
  session: POJUSessionState,
  userMessage: string,
  options?: { confirmPipeline?: boolean },
): ThinkingStreamMode {
  if (userMessage === "__OPENING__") {
    const pending = findPendingToolInjection(session);
    if (pending?.delivery_handoff) return "collecting";
    return "flash";
  }
  if (options?.confirmPipeline) return "preparing_delivery";

  const phase = normalizeAgentPhase(session.agent_v2?.current_phase);
  if (phase === "opening" || phase === "tracking" || phase === "delivered") return "flash";
  if (phase === "collecting_context") return "collecting";
  if (phase === "awaiting_confirmation") {
    if (/确认|生成|可以了|yes|confirm|proceed|generate/i.test(userMessage)) {
      return "preparing_delivery";
    }
    return "collecting";
  }
  if (phase === "greeting") return "collecting";
  return "collecting";
}
