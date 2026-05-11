import { allSessions, archiveSession, loadSession, saveSession } from "@/lib/poju/session-store";
import type { SessionState } from "@/lib/poju/types";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export function defaultExpiry(): number {
  return Date.now() + THIRTY_DAYS;
}

export async function checkAndArchiveSessions(): Promise<string[]> {
  const now = Date.now();
  const archived: string[] = [];
  const list = await allSessions();
  for (const s of list) {
    if (s.status === "active" && s.expiresAt <= now) {
      await archiveSession(s.sessionId);
      archived.push(s.sessionId);
    }
  }
  return archived;
}

export async function extendSession(sessionId: string): Promise<SessionState | null> {
  const s = await loadSession(sessionId);
  if (!s || s.status !== "active") return null;
  s.expiresAt += THIRTY_DAYS;
  s.renewals.push({ at: Date.now(), days: 30 });
  s.lastInteractionAt = Date.now();
  await saveSession(s);
  return s;
}
