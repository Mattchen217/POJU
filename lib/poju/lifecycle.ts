import { allSessions, archiveSession, loadSession, saveSession } from "@/lib/poju/session-store";
import type { SessionState } from "@/lib/poju/types";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export function defaultExpiry(): number {
  return Date.now() + THIRTY_DAYS;
}

export function checkAndArchiveSessions(): string[] {
  const now = Date.now();
  const archived: string[] = [];
  allSessions().forEach((s) => {
    if (s.status === "active" && s.expiresAt <= now) {
      archiveSession(s.sessionId);
      archived.push(s.sessionId);
    }
  });
  return archived;
}

export function extendSession(sessionId: string): SessionState | null {
  const s = loadSession(sessionId);
  if (!s || s.status !== "active") return null;
  s.expiresAt += THIRTY_DAYS;
  s.renewals.push({ at: Date.now(), days: 30 });
  s.lastInteractionAt = Date.now();
  saveSession(s);
  return s;
}
