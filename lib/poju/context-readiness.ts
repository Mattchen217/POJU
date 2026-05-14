import type { POJUSessionState } from "@/lib/poju/types";

function isSignificantContextValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return !Number.isNaN(value);
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

/**
 * Deterministic 0–10 score: combines user turn depth, `context_collected`, and profile.
 * Used for server-side gates (do not trust LLM self-score alone).
 */
export function computeContextReadinessScore(session: POJUSessionState, hasProfile: boolean): number {
  const users = session.messages.filter((m) => m.role === "user" && !m.is_rejected);
  let turnPts = 0;
  for (const m of users) {
    const L = m.content.trim().length;
    if (L < 4) continue;
    if (L < 28) turnPts += 1;
    else if (L < 120) turnPts += 2;
    else turnPts += 3;
  }

  const cc = session.context_collected ?? {};
  const filledKeys = Object.keys(cc).filter((k) => isSignificantContextValue(cc[k])).length;
  /** Structured slots from the LLM matter more than raw chat length. */
  const contextPts = Math.min(5, filledKeys * 2);

  const profilePts = hasProfile ? 4 : 0;
  /** Without a profile, cap “chit-chat” points so long shallow threads don’t inflate readiness. */
  turnPts = Math.min(hasProfile ? 5 : 3, turnPts);

  return Math.min(10, Math.round(turnPts + contextPts + profilePts));
}

/** Counts substantive structured fields (strings length≥40 count double). */
export function countContextSignals(session: POJUSessionState): number {
  const cc = session.context_collected ?? {};
  let n = 0;
  for (const v of Object.values(cc)) {
    if (!isSignificantContextValue(v)) continue;
    if (typeof v === "string" && v.trim().length >= 40) n += 2;
    else n += 1;
  }
  return n;
}

export function countUserTurns(session: POJUSessionState): number {
  return session.messages.filter((m) => m.role === "user" && !m.is_rejected).length;
}

export function getLastUserMessageContent(session: POJUSessionState): string {
  for (let i = session.messages.length - 1; i >= 0; i -= 1) {
    const m = session.messages[i];
    if (m.role === "user" && !m.is_rejected) return m.content;
  }
  return "";
}
