import { tokenize } from "@/lib/poju/drift-detection";
import type { SessionState } from "@/lib/poju/types";

export function extractTopicKeywords(text: string, max = 14): string[] {
  const t = tokenize(text);
  return [...new Set(t)].slice(0, max);
}

/** 首次用户输入时锁定原始问题（Batch4 Task 5.3 / Batch1 话题锚点）。 */
export function lockSessionTopicIfNeeded(session: SessionState, input: string): void {
  if (session.originalQuestion?.trim()) return;
  const trimmed = input.trim();
  if (!trimmed) return;
  session.originalQuestion = trimmed.slice(0, 2000);
  session.topicKeywords = extractTopicKeywords(trimmed);
  session.questionLockedAt = Date.now();
}

export function topicAnchorText(session: SessionState, fallbackFirstUser: string): string {
  return session.originalQuestion?.trim() || fallbackFirstUser;
}
