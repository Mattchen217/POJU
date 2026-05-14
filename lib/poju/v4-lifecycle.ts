import { getPojuDb } from "@/lib/db/poju-db";
import type { POJUSessionRecord } from "@/lib/db/poju-db";
import { getPojuDeviceId } from "@/lib/poju/client-device-id";
import { loadPOJUSession, savePOJUSession } from "@/lib/poju/session-manager";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const WARNING_MS = 7 * 24 * 60 * 60 * 1000;

const EXPIRING_KEY = "poju_v4_expiring_sessions";

async function copyRowToArchive(row: POJUSessionRecord, userMarkedResolved: boolean, satisfactionRating?: number) {
  const db = getPojuDb();
  await db.pojuSessionArchive.put({
    session_id: row.session_id,
    device_id: row.device_id,
    encrypted_data: row.encrypted_data,
    iv: row.iv,
    archived_at: new Date(),
    original_question: row.original_question,
    user_marked_resolved: userMarkedResolved,
    satisfaction_rating: satisfactionRating,
  });
}

/** Auto-archive expired active rows; record sessions expiring within 7 days. */
export async function runPOJUV4SessionMaintenance(): Promise<{ archivedIds: string[]; expiringSoonIds: string[] }> {
  if (typeof window === "undefined") return { archivedIds: [], expiringSoonIds: [] };
  const deviceId = getPojuDeviceId();
  const db = getPojuDb();
  const now = new Date();
  const soon = new Date(now.getTime() + WARNING_MS);
  const rows = await db.pojuSessionRecords.where("device_id").equals(deviceId).toArray();
  const archivedIds: string[] = [];
  const expiringSoonIds: string[] = [];

  for (const row of rows) {
    if (row.status !== "active") continue;
    if (row.expires_at <= now) {
      await copyRowToArchive(row, false);
      await db.pojuSessionRecords.update(row.session_id, { status: "archived" });
      archivedIds.push(row.session_id);
    } else if (row.expires_at <= soon) {
      expiringSoonIds.push(row.session_id);
    }
  }

  try {
    sessionStorage.setItem(EXPIRING_KEY, JSON.stringify(expiringSoonIds));
  } catch {
    // ignore quota / private mode
  }

  return { archivedIds, expiringSoonIds };
}

export async function restorePOJUV4ArchivedSession(sessionId: string): Promise<boolean> {
  const db = getPojuDb();
  const arch = await db.pojuSessionArchive.get(sessionId);
  const row = await db.pojuSessionRecords.get(sessionId);
  if (!arch || !row || row.status !== "archived") return false;
  if (getPojuDeviceId() !== row.device_id) return false;

  const now = new Date();
  const exp = new Date(now.getTime() + THIRTY_DAYS_MS);
  await db.pojuSessionRecords.update(sessionId, {
    status: "active",
    expires_at: exp,
    last_interaction_at: now,
  });
  await db.pojuSessionArchive.delete(sessionId);

  const state = await loadPOJUSession(sessionId);
  if (state) {
    await savePOJUSession({
      ...state,
      expires_at: exp.toISOString(),
      last_interaction_at: now.toISOString(),
    });
  }
  return true;
}

export async function permanentlyDeletePOJUV4Session(sessionId: string): Promise<void> {
  const db = getPojuDb();
  await db.pojuSessionRecords.delete(sessionId);
  await db.pojuSessionArchive.delete(sessionId);
}

export async function setPOJUV4SessionStatus(
  sessionId: string,
  status: POJUSessionRecord["status"],
): Promise<boolean> {
  const db = getPojuDb();
  const row = await db.pojuSessionRecords.get(sessionId);
  if (!row || getPojuDeviceId() !== row.device_id) return false;
  await db.pojuSessionRecords.update(sessionId, { status });
  return true;
}

export async function markPOJUV4SessionResolved(
  sessionId: string,
  satisfactionRating?: number,
): Promise<boolean> {
  const db = getPojuDb();
  const row = await db.pojuSessionRecords.get(sessionId);
  if (!row || row.status !== "active" || getPojuDeviceId() !== row.device_id) return false;
  await copyRowToArchive(row, true, satisfactionRating);
  await db.pojuSessionRecords.update(sessionId, { status: "resolved" });
  return true;
}
