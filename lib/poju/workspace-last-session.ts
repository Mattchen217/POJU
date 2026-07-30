/** Persist last open workspace POJU chat across refresh / tab switches. */

const KEY = "poju.workspaceLastSessionId";

export function readLastPojuWorkspaceSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const id = window.localStorage.getItem(KEY)?.trim() ?? "";
    return id || null;
  } catch {
    return null;
  }
}

export function writeLastPojuWorkspaceSessionId(sessionId: string): void {
  if (typeof window === "undefined") return;
  const id = sessionId.trim();
  if (!id) return;
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    /* private mode */
  }
}

export function clearLastPojuWorkspaceSessionId(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}
