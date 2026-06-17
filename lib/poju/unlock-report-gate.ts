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

export function reportPreviewExcerpt(text: string, maxChars = 160): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";
  const firstBlock = normalized.split(/\n{2,}/)[0]?.trim() ?? normalized;
  if (firstBlock.length <= maxChars) return firstBlock;
  return `${firstBlock.slice(0, maxChars).trim()}…`;
}
