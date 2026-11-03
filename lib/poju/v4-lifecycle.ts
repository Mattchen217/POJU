import { getPojuDb } from "@/lib/db/poju-db";
import type { POJUSessionRecord } from "@/lib/db/poju-db";
import { getPojuDeviceId } from "@/lib/poju/client-device-id";
import { loadPOJUSession, runPOJUSessionPostCommitSideEffects } from "@/lib/poju/session-manager";
import { mutatePOJUSession } from "@/lib/poju/session-mutation";
import { isRowOwnedBy, resolveLocalOwnerKey } from "@/lib/storage/local-owner";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const WARNING_MS = 7 * 24 * 60 * 60 * 1000;

const EXPIRING_KEY = "poju_v4_expiring_sessions";

async function copyRowToArchive(row: POJUSessionRecord, userMarkedResolved: boolean, satisfactionRating?: number) {
  const db = getPojuDb();
  await db.pojuSessionArchive.put({
    session_id: row.session_id,
    device_id: row.device_id,
    owner_key: row.owner_key,
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
  const ownerKey = await resolveLocalOwnerKey();
  const db = getPojuDb();
  const now = new Date();
  const soon = new Date(now.getTime() + WARNING_MS);
  const rows = await db.pojuSessionRecords
    .where("owner_key")
    .equals(ownerKey)
    .and((s) => s.device_id === deviceId)
    .toArray();
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

export async function restorePOJUV4ArchivedSession(
  sessionId: string,
  paymentId: string,
): Promise<boolean> {
  const db = getPojuDb();
  const ownerKey = await resolveLocalOwnerKey();
  const arch = await db.pojuSessionArchive.get(sessionId);
  const row = await db.pojuSessionRecords.get(sessionId);
  if (!arch || !row || row.status !== "archived") return false;
  if (!isRowOwnedBy(row, ownerKey) || !isRowOwnedBy(arch, ownerKey)) return false;
  if (getPojuDeviceId() !== row.device_id) return false;
  if (!paymentId.trim()) return false;

  const payId = paymentId.trim();

  // Phase 3 rem (C5 leftover): fail closed — require decryptable blob BEFORE
  // status/expires/renewals mutation or archive delete. Wrong metadata must not
  // become authority over an unverifiable Session blob.
  let state;
  try {
    state = await loadPOJUSession(sessionId);
  } catch {
    return false;
  }
  if (!state) return false;

  const now = new Date();
  const exp = new Date(now.getTime() + THIRTY_DAYS_MS);
  const nowIso = now.toISOString();
  const expIso = exp.toISOString();

  try {
    const result = await mutatePOJUSession(sessionId, {
      operation_id: `restore_paid_${payId}`,
      kind: "session_patch",
      bump_dc: false,
      append_renewal: {
        extended_at: now,
        reason: "paid_restore",
        payment_id: payId,
      },
      apply: (latest) => ({
        ...latest,
        expires_at: expIso,
        last_interaction_at: nowIso,
      }),
    });
    await runPOJUSessionPostCommitSideEffects(result.state);
  } catch {
    // CAS failed — leave status=archived and archive row intact for retry.
    return false;
  }

  // After verifiable blob+renewals commit: activate + drop archive copy.
  await db.pojuSessionRecords.update(sessionId, { status: "active" });
  await db.pojuSessionArchive.delete(sessionId);
  return true;
}

export async function permanentlyDeletePOJUV4Session(sessionId: string): Promise<void> {
  const db = getPojuDb();
  const ownerKey = await resolveLocalOwnerKey();
  const row = await db.pojuSessionRecords.get(sessionId);
  if (row && !isRowOwnedBy(row, ownerKey)) return;
  const arch = await db.pojuSessionArchive.get(sessionId);
  if (arch && !isRowOwnedBy(arch, ownerKey)) return;
  if (row) await db.pojuSessionRecords.delete(sessionId);
  if (arch) await db.pojuSessionArchive.delete(sessionId);
}

export async function setPOJUV4SessionStatus(
  sessionId: string,
  status: POJUSessionRecord["status"],
): Promise<boolean> {
  const db = getPojuDb();
  const ownerKey = await resolveLocalOwnerKey();
  const row = await db.pojuSessionRecords.get(sessionId);
  if (!row || !isRowOwnedBy(row, ownerKey) || getPojuDeviceId() !== row.device_id) return false;
  await db.pojuSessionRecords.update(sessionId, { status });
  return true;
}

export async function markPOJUV4SessionResolved(
  sessionId: string,
  satisfactionRating?: number,
): Promise<boolean> {
  const db = getPojuDb();
  const ownerKey = await resolveLocalOwnerKey();
  const row = await db.pojuSessionRecords.get(sessionId);
  if (!row || row.status !== "active" || !isRowOwnedBy(row, ownerKey) || getPojuDeviceId() !== row.device_id) {
    return false;
  }
  await copyRowToArchive(row, true, satisfactionRating);
  await db.pojuSessionRecords.update(sessionId, { status: "resolved" });
  return true;
}
