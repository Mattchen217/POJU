/**
 * Shared default session load for Generation TaskContext CAS helpers.
 * Mirrors session-mutation defaultLoad (row + decrypt + revision mirror).
 */

import { decryptJson } from "@/lib/crypto";
import { getPojuDb, type POJUSessionRecord } from "@/lib/db/poju-db";
import { resolveRevisionMirror } from "@/lib/poju/session-mutation";
import { isRowOwnedBy, resolveLocalOwnerKey } from "@/lib/storage/local-owner";
import type { POJUSessionState } from "@/lib/poju/types";

const SESSION_SECRET = "pojulife_v4_poju_session";

export async function defaultLoadForGeneration(
  sessionId: string,
): Promise<{ row: POJUSessionRecord; state: POJUSessionState } | null> {
  const db = getPojuDb();
  const ownerKey = await resolveLocalOwnerKey();
  const row = await db.pojuSessionRecords.get(sessionId);
  if (!row || !isRowOwnedBy(row, ownerKey)) return null;
  const state = await decryptJson<POJUSessionState>(SESSION_SECRET, {
    iv: row.iv,
    cipher: row.encrypted_data,
  });
  resolveRevisionMirror(row, state);
  return { row, state };
}
