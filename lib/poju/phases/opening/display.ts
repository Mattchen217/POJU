/**
 * Opening phase (segment 1) — user-visible reply assembly.
 * Owns gate summary + understanding failure copy. Segment-2 display stays elsewhere.
 */
import type { POJUAgentState } from "@/lib/poju/agent-state";
import { pivotChatCopy } from "@/lib/poju/pivot-chat-copy";
import { buildUnderstandingGateSummaryFromFields } from "@/lib/poju/understanding-gate-reply";

export { buildUnderstandingGateSummaryFromFields };

/** Segment 1 opening — transport resends exhausted; user retries via button. */
export function openingUnderstandingGenerationFailedMessage(locale: string): string {
  return pivotChatCopy(locale).network_unstable_retry;
}

export function openingUnderstandingRetryButtonLabel(locale: string): string {
  return pivotChatCopy(locale).click_to_retry;
}

/** Envelope conversion stayed in opening with empty body — ask user to nudge. */
export function envelopeCoreFallbackRetryHint(locale: string): string {
  return pivotChatCopy(locale).investigation_angles_error;
}

export type OpeningReplyAssemblyInput = {
  locale: string;
  agent: POJUAgentState;
  llmResponse: string;
  understandingGenerationFailed: boolean;
  phaseAfter: string;
  envelopeFailedStayedOpening: boolean;
};

/**
 * Resolve opening-owned user-visible content.
 * Returns null when the caller should keep the LLM response (normal opening turn).
 */
export function resolveOpeningTurnReply(input: OpeningReplyAssemblyInput): string | null {
  if (input.phaseAfter === "awaiting_understanding_confirm") {
    return buildUnderstandingGateSummaryFromFields(input.agent, input.locale);
  }
  if (input.understandingGenerationFailed) {
    return openingUnderstandingGenerationFailedMessage(input.locale);
  }
  if (input.envelopeFailedStayedOpening && !input.llmResponse.trim()) {
    return envelopeCoreFallbackRetryHint(input.locale);
  }
  return null;
}

/** True when opening display fully owns the bubble (skip appendForwardMove). */
export function openingReplyIsComplete(input: OpeningReplyAssemblyInput): boolean {
  return resolveOpeningTurnReply(input) != null;
}
