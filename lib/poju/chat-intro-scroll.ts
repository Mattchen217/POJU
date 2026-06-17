const KEY_PREFIX = "poju_chat_intro_seen:";

export function hasSeenPojuChatIntro(sessionId: string): boolean {
  if (!sessionId || typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(`${KEY_PREFIX}${sessionId}`) === "1";
  } catch {
    return false;
  }
}

export function markPojuChatIntroSeen(sessionId: string): void {
  if (!sessionId || typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`${KEY_PREFIX}${sessionId}`, "1");
  } catch {
    /* ignore quota / privacy mode */
  }
}

/** First visit: matrix header at top; return visits: scroll to latest content. */
export function pojuChatInitialScrollPosition(sessionId: string): "top" | "bottom" {
  return hasSeenPojuChatIntro(sessionId) ? "bottom" : "top";
}
