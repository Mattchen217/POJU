const SNOOZE_KEY = "poju_expiry_reminder_snoozed";

export const POJU_SESSION_WARNING_DAYS = 7;

export function getSessionDaysLeft(expiresAtIso: string, nowMs = Date.now()): number {
  const msLeft = new Date(expiresAtIso).getTime() - nowMs;
  return Math.ceil(msLeft / (24 * 60 * 60 * 1000));
}

export function isExpiryReminderSnoozed(sessionId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    if (!raw) return false;
    const map = JSON.parse(raw) as Record<string, boolean>;
    return Boolean(map[sessionId]);
  } catch {
    return false;
  }
}

export function setExpiryReminderSnoozed(sessionId: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    map[sessionId] = true;
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota / private mode
  }
}

export function clearExpiryReminderSnooze(sessionId: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    if (!raw) return;
    const map = JSON.parse(raw) as Record<string, boolean>;
    delete map[sessionId];
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

/** Show the near-expiry dialog when opening a session (within 7 days, not snoozed). */
export function shouldShowExpiryWarning(sessionId: string, expiresAtIso: string): boolean {
  const daysLeft = getSessionDaysLeft(expiresAtIso);
  if (daysLeft <= 0 || daysLeft > POJU_SESSION_WARNING_DAYS) return false;
  return !isExpiryReminderSnoozed(sessionId);
}

export function isSessionExpired(expiresAtIso: string, nowMs = Date.now()): boolean {
  return getSessionDaysLeft(expiresAtIso, nowMs) <= 0;
}
