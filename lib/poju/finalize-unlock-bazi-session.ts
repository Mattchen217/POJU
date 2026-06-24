import { createReportMessage } from "@/lib/poju/preview-unlock";
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

  return {
    ...session,
    pending_question: undefined,
    original_question: q || session.original_question,
    messages: [...messages, userMsg],
    agent_v2: session.agent_v2
      ? {
          ...session.agent_v2,
          has_base_analysis: true,
          current_phase: "opening",
        }
      : session.agent_v2,
  };
}
