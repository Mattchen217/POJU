import { createReportMessage } from "@/lib/poju/preview-unlock";
import { detectSessionLangFromSample } from "@/lib/poju/session-lang";
import type { POJUMessage, POJUSessionState } from "@/lib/poju/types";

export function hasUnlockReportMessage(session: POJUSessionState): boolean {
  return session.messages.some((m) => m.meta?.kind === "report");
}

/** Post-unlock: attach streamed base-analysis report and mark agent ready for dialogue. */
export function finalizeUnlockBaziSession(
  session: POJUSessionState,
  reportText: string,
  profileId: string,
): POJUSessionState {
  const messages = hasUnlockReportMessage(session)
    ? session.messages
    : [...session.messages, createReportMessage({ reportText, profileId })];

  return {
    ...session,
    messages,
    agent_v2: session.agent_v2
      ? {
          ...session.agent_v2,
          has_base_analysis: true,
          selected_profile_id: profileId,
          /** Report/matrix is onboarding display; dialogue still starts at understanding gate (PDF step 2). */
          current_phase: "opening",
        }
      : session.agent_v2,
  };
}

/** Onboarding / paywall shells — not a real dialogue reply to the pending question. */
const NON_DIALOGUE_ASSISTANT_KINDS = new Set([
  "paywall",
  "energy_matrix",
  "welcome",
  "report",
]);

/**
 * True when an assistant dialogue reply already followed the pending user bubble.
 * Optimistic pre-Pass user bubbles must NOT skip release / first model turn.
 */
export function hasDialogueReplyForPendingQuestion(
  session: POJUSessionState,
  pending: string,
): boolean {
  const q = pending.trim();
  if (!q) return false;
  let lastUserIdx = -1;
  for (let i = 0; i < session.messages.length; i++) {
    const m = session.messages[i]!;
    if (m.role === "user" && !m.is_rejected && m.content.trim() === q) {
      lastUserIdx = i;
    }
  }
  if (lastUserIdx < 0) return false;
  for (let i = lastUserIdx + 1; i < session.messages.length; i++) {
    const m = session.messages[i]!;
    if (m.role !== "assistant") continue;
    const kind = m.meta?.kind;
    if (kind && NON_DIALOGUE_ASSISTANT_KINDS.has(kind)) continue;
    return true;
  }
  return false;
}

/**
 * After bazi report is visible: drop paywall + any pre-unlock user bubble,
 * append the intercepted question after the report, then run original Agent.
 */
export function prepareUnlockReleaseSession(
  session: POJUSessionState,
  userQuestion: string,
): POJUSessionState {
  const q = userQuestion.trim();
  const messages = session.messages.filter((m) => {
    if (m.meta?.kind === "paywall") return false;
    if (q && m.role === "user" && m.content.trim() === q) return false;
    return true;
  });

  const userMsg: POJUMessage = {
    role: "user",
    content: q,
    timestamp: new Date().toISOString(),
  };

  const lockFromQuestion = detectSessionLangFromSample(q);

  return {
    ...session,
    pending_question: undefined,
    original_question: q || session.original_question,
    messages: [...messages, userMsg],
    locked_output_locale: session.locked_output_locale ?? lockFromQuestion ?? undefined,
    agent_v2: session.agent_v2
      ? {
          ...session.agent_v2,
          has_base_analysis: true,
          current_phase: "opening",
        }
      : session.agent_v2,
  };
}
