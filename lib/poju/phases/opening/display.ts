/**
 * Opening phase (segment 1) — user-visible reply assembly.
 * Owns gate summary + understanding failure copy. Segment-2 display stays elsewhere.
 */
import type { POJUAgentState } from "@/lib/poju/agent-state";
import { buildUnderstandingGateSummaryFromFields } from "@/lib/poju/understanding-gate-reply";

export { buildUnderstandingGateSummaryFromFields };

/** Segment 1 opening — transport resends exhausted; user retries via button. */
export function openingUnderstandingGenerationFailedMessage(locale: string): string {
  return locale.startsWith("zh")
    ? "网络不太稳，我这次没能把理解整理好。点下方按钮重试。"
    : "The connection was unstable and I couldn't finish understanding this turn. Tap the button below to retry.";
}

export function openingUnderstandingRetryButtonLabel(locale: string): string {
  return locale.startsWith("zh") ? "点击重试" : "Retry";
}

/** Envelope conversion stayed in opening with empty body — ask user to nudge. */
export function envelopeCoreFallbackRetryHint(locale: string): string {
  return locale.startsWith("zh")
    ? "我在整理与你问题相关的调查角度时遇到一点异常，请再发一句让我继续。"
    : "I hit a snag while framing investigation angles for your question — please send another message.";
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
