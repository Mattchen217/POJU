/**
 * Syncro v5 — encrypted session storage (IndexedDB `syncro_sessions`).
 * @see docs/Syncro_v5.0_Refactor.md Step 4
 */

import { safeRandomUUID } from "@/lib/client/safe-crypto";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { getPojuDb, type SyncroSessionRecord } from "@/lib/db/poju-db";
import { getPojuDeviceId } from "@/lib/poju/client-device-id";
import type { SyncroSession, SyncroSessionPayload } from "./types";
import {
  computeSyncroSessionExpiresAt,
  isSubmissionTimelineComplete,
} from "./syncro-submission-timeline";

const SYNCRO_SESSION_SECRET = "pojulife_v5_syncro_session";

export type CreateSyncroSessionInput = {
  profile_id: string;
  task_description: string;
  user_location: SyncroSession["user_location"];
  matrix: SyncroSession["matrix"];
  locale: string;
  is_free: boolean;
  cost_usd: number;
  llm_meta: SyncroSession["llm_meta"];
};

export type SyncroSessionListItem = {
  session_id: string;
  profile_id: string;
  created_at: Date;
  expires_at: Date;
  is_expired: boolean;
};

function toPayload(session: SyncroSession): SyncroSessionPayload {
  return {
    ...session,
    created_at: session.created_at.toISOString(),
    expires_at: session.expires_at.toISOString(),
  };
}

function fromPayload(payload: SyncroSessionPayload): SyncroSession {
  return {
    ...payload,
    created_at: new Date(payload.created_at),
    expires_at: new Date(payload.expires_at),
  };
}

export async function createSyncroSession(input: CreateSyncroSessionInput): Promise<string> {
  const deviceId = getPojuDeviceId();
  const sessionId = safeRandomUUID();
  const now = new Date();
  const expires = computeSyncroSessionExpiresAt(input.matrix, now);

  const session: SyncroSession = {
    session_id: sessionId,
    device_id: deviceId,
    profile_id: input.profile_id,
    task_description: input.task_description,
    user_location: input.user_location,
    created_at: now,
    expires_at: expires,
    matrix: input.matrix,
    locale: input.locale,
    is_free: input.is_free,
    cost_usd: input.cost_usd,
    llm_meta: input.llm_meta,
  };

  const { cipher, iv } = await encryptJson(SYNCRO_SESSION_SECRET, toPayload(session));

  const row: SyncroSessionRecord = {
    session_id: sessionId,
    device_id: deviceId,
    profile_id: input.profile_id,
    encrypted_data: cipher,
    iv,
    created_at: now,
    expires_at: expires,
  };

  await getPojuDb().syncro_sessions.put(row);
  return sessionId;
}

/** Merge LLM batch copy into an existing session matrix (client-side IndexedDB). */
export async function patchSyncroSessionMatrix(
  sessionId: string,
  advice: Record<
    string,
    Partial<{
      short_advice: string;
      detailed_advice: string;
      rationale: string;
    }>
  >,
  llmMeta?: Partial<SyncroSession["llm_meta"]> & { cost_usd_delta?: number },
): Promise<SyncroSession | null> {
  const record = await getPojuDb().syncro_sessions.get(sessionId);
  if (!record) return null;

  if (new Date(record.expires_at) < new Date()) {
    return null;
  }

  try {
    const payload = await decryptJson<SyncroSessionPayload>(SYNCRO_SESSION_SECRET, {
      iv: record.iv,
      cipher: record.encrypted_data,
    });
    const session = fromPayload(payload);

    for (const [key, patch] of Object.entries(advice)) {
      const cell = session.matrix[key];
      if (!cell) continue;
      if (patch.short_advice?.trim()) cell.short_advice = patch.short_advice.trim();
      if (patch.detailed_advice?.trim()) cell.detailed_advice = patch.detailed_advice.trim();
      if (patch.rationale?.trim()) cell.rationale = patch.rationale.trim();
      cell.llm_pending = false;
      cell.llm_failed = false;
    }

    if (llmMeta?.model) session.llm_meta.model = llmMeta.model;
    if (typeof llmMeta?.tokens_used === "number") {
      session.llm_meta.tokens_used += llmMeta.tokens_used;
    }
    if (typeof llmMeta?.latency_ms === "number") {
      session.llm_meta.latency_ms += llmMeta.latency_ms;
    }
    if (typeof llmMeta?.cost_usd_delta === "number") {
      session.cost_usd += llmMeta.cost_usd_delta;
    }

    const { cipher, iv } = await encryptJson(SYNCRO_SESSION_SECRET, toPayload(session));
    await getPojuDb().syncro_sessions.put({
      ...record,
      encrypted_data: cipher,
      iv,
    });

    return session;
  } catch (e) {
    console.error("[syncro-session] patch failed:", e);
    return null;
  }
}

/** Mark cells as LLM batch failed (fallback copy remains). */
export async function patchSyncroSessionMatrixFailure(
  sessionId: string,
  keys: string[],
): Promise<SyncroSession | null> {
  const record = await getPojuDb().syncro_sessions.get(sessionId);
  if (!record) return null;

  if (new Date(record.expires_at) < new Date()) {
    return null;
  }

  try {
    const payload = await decryptJson<SyncroSessionPayload>(SYNCRO_SESSION_SECRET, {
      iv: record.iv,
      cipher: record.encrypted_data,
    });
    const session = fromPayload(payload);

    for (const key of keys) {
      const cell = session.matrix[key];
      if (!cell) continue;
      cell.llm_pending = false;
      cell.llm_failed = true;
    }

    const { cipher, iv } = await encryptJson(SYNCRO_SESSION_SECRET, toPayload(session));
    await getPojuDb().syncro_sessions.put({
      ...record,
      encrypted_data: cipher,
      iv,
    });

    return session;
  } catch (e) {
    console.error("[syncro-session] patch failure failed:", e);
    return null;
  }
}

export async function loadSyncroSession(sessionId: string): Promise<SyncroSession | null> {
  const record = await getPojuDb().syncro_sessions.get(sessionId);
  if (!record) return null;

  if (new Date(record.expires_at) < new Date()) {
    return null;
  }

  try {
    const payload = await decryptJson<SyncroSessionPayload>(SYNCRO_SESSION_SECRET, {
      iv: record.iv,
      cipher: record.encrypted_data,
    });
    return fromPayload(payload);
  } catch (e) {
    console.error("[syncro-session] Decrypt failed:", e);
    return null;
  }
}

export async function deleteSyncroSession(sessionId: string): Promise<void> {
  await getPojuDb().syncro_sessions.delete(sessionId);
}

export async function isSyncroSessionExpired(sessionId: string): Promise<boolean> {
  const record = await getPojuDb().syncro_sessions.get(sessionId);
  if (!record) return true;
  if (new Date(record.expires_at) < new Date()) {
    await deleteSyncroSession(sessionId);
    return true;
  }

  const session = await loadSyncroSession(sessionId);
  if (session && isSubmissionTimelineComplete(session)) {
    await deleteSyncroSession(sessionId);
    return true;
  }

  return false;
}

export async function listUserSyncroSessions(): Promise<SyncroSessionListItem[]> {
  const deviceId = getPojuDeviceId();
  const records = await getPojuDb().syncro_sessions.where("device_id").equals(deviceId).toArray();

  const now = Date.now();
  return records
    .map((r) => ({
      session_id: r.session_id,
      profile_id: r.profile_id,
      created_at: new Date(r.created_at),
      expires_at: new Date(r.expires_at),
      is_expired: new Date(r.expires_at).getTime() < now,
    }))
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
}

function isRecordActive(record: SyncroSessionRecord, now: number): boolean {
  return new Date(record.expires_at).getTime() > now;
}

async function isSessionTimelineActive(session: SyncroSession): Promise<boolean> {
  return !isSubmissionTimelineComplete(session);
}

function sortRecordsByCreatedDesc(records: SyncroSessionRecord[]): SyncroSessionRecord[] {
  return [...records].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

async function loadActiveSessionFromRecord(
  record: SyncroSessionRecord,
): Promise<SyncroSession | null> {
  const session = await loadSyncroSession(record.session_id);
  if (!session || Object.keys(session.matrix).length === 0) return null;
  return session;
}

/** Most recent non-expired session for a profile (24h window). */
export async function findActiveSyncroSession(profileId: string): Promise<SyncroSession | null> {
  const now = Date.now();
  const records = sortRecordsByCreatedDesc(
    await getPojuDb().syncro_sessions.where("profile_id").equals(profileId).toArray(),
  );

  for (const record of records) {
    if (!isRecordActive(record, now)) continue;
    const session = await loadActiveSessionFromRecord(record);
    if (!session || !(await isSessionTimelineActive(session))) {
      if (session && isSubmissionTimelineComplete(session)) {
        await deleteSyncroSession(record.session_id);
      }
      continue;
    }
    if (session) return session;
  }

  return null;
}

/** Most recent non-expired session on this device (any profile). */
export async function findLatestActiveSyncroSessionForDevice(): Promise<SyncroSession | null> {
  const deviceId = getPojuDeviceId();
  const now = Date.now();
  const records = sortRecordsByCreatedDesc(
    await getPojuDb().syncro_sessions.where("device_id").equals(deviceId).toArray(),
  );

  for (const record of records) {
    if (!isRecordActive(record, now)) continue;
    const session = await loadActiveSessionFromRecord(record);
    if (!session || !(await isSessionTimelineActive(session))) {
      if (session && isSubmissionTimelineComplete(session)) {
        await deleteSyncroSession(record.session_id);
      }
      continue;
    }
    if (session) return session;
  }

  return null;
}

/** Delete expired rows and finished 12-slot timelines from IndexedDB. */
export async function cleanupExpiredSyncroSessions(): Promise<number> {
  const now = Date.now();
  const rows = await getPojuDb().syncro_sessions.toArray();
  let removed = 0;

  for (const row of rows) {
    const expiresMs = new Date(row.expires_at).getTime();
    if (expiresMs <= now) {
      await deleteSyncroSession(row.session_id);
      removed++;
      continue;
    }

    const session = await loadSyncroSession(row.session_id);
    if (session && isSubmissionTimelineComplete(session)) {
      await deleteSyncroSession(row.session_id);
      removed++;
    }
  }

  return removed;
}

