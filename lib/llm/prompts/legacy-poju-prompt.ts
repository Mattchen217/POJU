/** Minimal legacy system prompt (Step B stub; full v5 prompts in Part 2). */
import type { POJUSessionState } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

export function buildPOJUSystemPrompt(input: {
  session: POJUSessionState;
  profile: UserProfile | null;
  locale: string;
}): string {
  const { session, profile, locale } = input;
  const profileNote = profile
    ? `User has a birth profile (day master context available internally).`
    : `No birth profile linked yet.`;

  return `# POJU — Legacy fallback path
Locale: ${locale}
Original question: "${session.original_question}"
${profileNote}

Respond with strict JSON:
{
  "response": "user-facing text",
  "user_intent": "sharing_situation",
  "current_state": "collecting_context",
  "action_requested": "continue_chat",
  "topic_drift_detected": false,
  "context_updates": {},
  "contains_delivery": false
}`;
}
