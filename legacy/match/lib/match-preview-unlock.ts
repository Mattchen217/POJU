import type { MatchPreviewSession } from "@/lib/match/match-preview-session";

export function getMatchUnlockStatus(session: MatchPreviewSession): "preview" | "unlocked" {
  return session.unlock_status === "unlocked" ? "unlocked" : "preview";
}

export function isMatchPreviewSession(session: MatchPreviewSession): boolean {
  return getMatchUnlockStatus(session) === "preview";
}

export function resolveMatchQuestion(session: MatchPreviewSession): string {
  return session.pending_question?.trim() || "";
}
