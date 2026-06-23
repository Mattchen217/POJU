import { getWelcomeMessage } from "@/lib/poju/welcome-messages";
import type { POJUMessage, POJUSessionState } from "@/lib/poju/types";

export function isFixedWelcomeContent(content: string): boolean {
  const text = content.toLowerCase();
  return (
    text.includes("this is a focused space for one question") ||
    text.includes("这里只围绕你今天带来的那一个核心问题")
  );
}

export function hasFixedWelcomeMessage(session: POJUSessionState): boolean {
  return session.messages.some(
    (m) => m.role === "assistant" && (m.meta?.kind === "welcome" || isFixedWelcomeContent(m.content)),
  );
}

export function createWelcomeAssistantMessage(locale: string): POJUMessage {
  return {
    role: "assistant",
    content: getWelcomeMessage(locale),
    timestamp: new Date().toISOString(),
    meta: { kind: "welcome" },
  };
}

/** Append fixed welcome copy — no LLM. Idempotent per session. */
export function seedFixedWelcomeMessages(session: POJUSessionState, locale: string): POJUSessionState {
  if (hasFixedWelcomeMessage(session)) return session;
  return {
    ...session,
    messages: [...session.messages, createWelcomeAssistantMessage(locale)],
  };
}
