import { POJU_RELEASE_PENDING_QUESTION_FLAG } from "@/lib/poju/preview-unlock";
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

/** Raw report text for card preview — keeps term markers for RichReadingText (CSS line-clamp). */
export function reportPreviewForCard(text: string, maxChars = 480): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars).trim()}…`;
}
