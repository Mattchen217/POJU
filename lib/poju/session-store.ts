import type { SessionState } from "@/lib/poju/types";

type StoreGlobals = {
  __pojuSessions?: Map<string, SessionState>;
  __pojuArchived?: Map<string, SessionState>;
};

const storeGlobal = globalThis as StoreGlobals;
const sessions = storeGlobal.__pojuSessions ?? new Map<string, SessionState>();
const archived = storeGlobal.__pojuArchived ?? new Map<string, SessionState>();
storeGlobal.__pojuSessions = sessions;
storeGlobal.__pojuArchived = archived;

export function saveSession(session: SessionState): void {
  sessions.set(session.sessionId, session);
}

export function loadSession(sessionId: string): SessionState | null {
  return sessions.get(sessionId) ?? null;
}

export function archiveSession(sessionId: string): boolean {
  const hit = sessions.get(sessionId);
  if (!hit) return false;
  sessions.delete(sessionId);
  archived.set(sessionId, { ...hit, status: "archived" });
  return true;
}

export function restoreSession(sessionId: string): SessionState | null {
  const hit = archived.get(sessionId);
  if (!hit) return null;
  archived.delete(sessionId);
  const restored: SessionState = {
    ...hit,
    status: "active",
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    renewals: [...hit.renewals, { at: Date.now(), days: 30 }],
  };
  sessions.set(sessionId, restored);
  return restored;
}

export function getActiveByDevice(deviceId: string): SessionState | null {
  for (const s of sessions.values()) {
    if (s.deviceId === deviceId && s.status === "active") return s;
  }
  return null;
}

export function allSessions(): SessionState[] {
  return [...sessions.values()];
}
