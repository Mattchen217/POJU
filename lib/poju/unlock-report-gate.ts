import { POJU_RELEASE_PENDING_QUESTION_FLAG } from "@/lib/poju/preview-unlock";
import { truncateReadingTeaser } from "@/lib/reading/truncate-reading-teaser";
import type { POJUMessage, POJUSessionState } from "@/lib/poju/types";

export function getUnlockReportMessage(session: POJUSessionState): POJUMessage | undefined {
  return session.messages.find((m) => m.meta?.kind === "report");
}

export function getUnlockReportText(message: POJUMessage | undefined): string {
  if (!message) return "";
  return (message.meta?.report_text ?? message.content).trim();
}

export function isPendingUnlockQuestionRelease(sessionId: string): boolean {
  if (!sessionId || typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(POJU_RELEASE_PENDING_QUESTION_FLAG) === sessionId;
  } catch {
    return false;
  }
}

/** Sync initial modal/gate state — avoid one-frame chat flash before useEffect opens the report modal. */
export function getInitialUnlockReportUiState(session: POJUSessionState): {
  modalOpen: boolean;
  gateDismissed: boolean;
} {
  if (typeof window === "undefined") {
    return { modalOpen: false, gateDismissed: true };
  }
  const hasReport = Boolean(getUnlockReportMessage(session));
  const pendingRelease = isPendingUnlockQuestionRelease(session.session_id);
  if (!hasReport || !pendingRelease) {
    return { modalOpen: false, gateDismissed: true };
  }
  return { modalOpen: true, gateDismissed: false };
}

export function isUnlockReportReturnRoute(sessionId: string): boolean {
  return isPendingUnlockQuestionRelease(sessionId);
}

/**
 * Card preview = same parseReadingBlocks pipeline as full report, truncated by blocks.
 * Never char-slice raw markdown (that leaks literal `##` and skips auto-mark).
 */
export function reportPreviewForCard(text: string, maxBlocks = 5): string {
  return truncateReadingTeaser(text, maxBlocks);
}
