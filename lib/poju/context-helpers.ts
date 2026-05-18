/**
 * Minimal session context helpers (replaces deleted context-readiness.ts for Step B).
 * Step I+ may expand scoring logic.
 */
import type { POJUSessionState } from "@/lib/poju/types";

export function getLastUserMessageContent(session: POJUSessionState): string {
  for (let i = session.messages.length - 1; i >= 0; i -= 1) {
    const m = session.messages[i];
    if (m.role === "user" && !m.is_rejected) return m.content.trim();
  }
  return "";
}

export function countUserTurns(session: POJUSessionState): number {
  return session.messages.filter((m) => m.role === "user" && !m.is_rejected).length;
}

export function countContextSignals(session: POJUSessionState): number {
  const c = session.context_collected;
  let n = 0;
  for (const v of Object.values(c)) {
    if (v == null) continue;
    if (typeof v === "string" && v.trim()) n += 1;
    else if (Array.isArray(v) && v.length > 0) n += 1;
    else if (typeof v === "object" && Object.keys(v as object).length > 0) n += 1;
  }
  const agent = session.agent_v2?.context_collected;
  if (agent) {
    for (const v of Object.values(agent)) {
      if (v == null) continue;
      if (typeof v === "string" && v.trim()) n += 1;
      else if (Array.isArray(v) && v.length > 0) n += 1;
      else if (typeof v === "object" && Object.keys(v as object).length > 0) n += 1;
    }
  }
  return n;
}

export function computeContextReadinessScore(session: POJUSessionState, hasProfile: boolean): number {
  const turns = countUserTurns(session);
  const signals = countContextSignals(session);
  const agentScore = session.agent_v2?.collection_completeness ?? 0;
  const base = Math.max(agentScore * 10, Math.min(10, turns * 1.2 + signals * 0.8));
  return hasProfile ? Math.min(10, base + 0.5) : Math.min(9, base);
}
