import { safeRandomUUID } from "@/lib/client/safe-crypto";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { ensurePojuDbReady, getPojuDb, type ArchiveRecord } from "@/lib/db/poju-db";
import { ARCHIVE_UPDATED_EVENT } from "@/lib/archive/runtime-archive";
import { mapSessionActionsToArchiveActions } from "@/lib/archive/map-actions-for-archive";
import { getPojuDeviceId } from "@/lib/poju/client-device-id";
import { sessionListTopicLine } from "@/lib/poju/session-list-label";
import type { POJUSessionState } from "@/lib/poju/types";
import { isRowOwnedBy, resolveLocalOwnerKey } from "@/lib/storage/local-owner";

const ARCHIVE_SECRET = "pojulife_v4_archive_vault";

export type POJUSessionVaultMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

export type PojuVaultArchiveAction = ReturnType<typeof mapSessionActionsToArchiveActions>[number];

export interface POJUSessionVaultData {
  session_id: string;
  profile_id: string;
  original_question: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
  messages: POJUSessionVaultMessage[];
  delivery_excerpt?: string;
  actions: PojuVaultArchiveAction[];
}

function notifyArchiveUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ARCHIVE_UPDATED_EVENT));
}

function formatVaultTitle(originalQuestion: string, locale: string): string {
  const snippet = sessionListTopicLine(originalQuestion);
  return locale.startsWith("zh") ? `POJU：${snippet}` : `POJU: ${snippet}`;
}

function serializeVaultMessages(session: POJUSessionState): POJUSessionVaultMessage[] {
  return session.messages
    .filter((m) => m.role !== "system" && !m.is_rejected)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
      timestamp: m.timestamp,
    }));
}

function buildDeliveryExcerpt(session: POJUSessionState): string | undefined {
  const md = session.main_delivery;
  if (!md?.full_text?.trim()) return undefined;
  return md.full_text.trim().slice(0, 4000);
}

function buildVaultActions(session: POJUSessionState): PojuVaultArchiveAction[] {
  return mapSessionActionsToArchiveActions(session.actions.slice(0, 3));
}

export function buildPojuSessionVaultData(session: POJUSessionState): POJUSessionVaultData {
  const now = new Date().toISOString();
  const profileId = session.selected_stored_profile_id ?? session.agent_v2?.selected_profile_id ?? "";
  return {
    session_id: session.session_id,
    profile_id: profileId,
    original_question: session.original_question,
    created_at: session.created_at || now,
    updated_at: now,
    expires_at: session.expires_at,
    messages: serializeVaultMessages(session),
    delivery_excerpt: buildDeliveryExcerpt(session),
    actions: buildVaultActions(session),
  };
}

async function findPojuVaultRecordForSession(sessionId: string): Promise<ArchiveRecord | undefined> {
  const ownerKey = await resolveLocalOwnerKey();
  const db = await ensurePojuDbReady();
  const rows = await db.archive.where("owner_key").equals(ownerKey).toArray();
  const matches = rows.filter((r) => r.product === "poju" && r.session_id === sessionId);
  return matches.find((r) => r.type === "poju_session") ?? matches[0];
}

/** Upsert encrypted POJU session transcript into the cross-product archive vault. */
export async function syncPojuSessionVaultArchive(
  session: POJUSessionState,
  locale = "en",
): Promise<string> {
  const deviceId = getPojuDeviceId();
  const ownerKey = await resolveLocalOwnerKey();
  const db = await ensurePojuDbReady();
  const existing = await findPojuVaultRecordForSession(session.session_id);
  const now = new Date();
  const data = buildPojuSessionVaultData(session);
  const archiveId = existing?.archive_id ?? session.action_plan_archive_id ?? safeRandomUUID();
  const title = formatVaultTitle(session.original_question, locale);
  const { cipher, iv } = await encryptJson(ARCHIVE_SECRET, data);

  await db.archive.put({
    archive_id: archiveId,
    device_id: deviceId,
    owner_key: ownerKey,
    type: "poju_session",
    session_id: session.session_id,
    profile_id: data.profile_id || undefined,
    title,
    encrypted_data: cipher,
    iv,
    created_at: existing?.created_at ?? now,
    product: "poju",
  });

  const dupes = (await db.archive.where("owner_key").equals(ownerKey).toArray()).filter(
    (r) =>
      r.product === "poju" &&
      r.session_id === session.session_id &&
      r.archive_id !== archiveId,
  );
  for (const row of dupes) {
    await db.archive.delete(row.archive_id);
  }

  notifyArchiveUpdated();
  return archiveId;
}

/** Delete live POJU session + any matching vault rows (sidebar history). */
export async function deletePojuSessionHistory(sessionId: string): Promise<void> {
  const { deletePOJUSession } = await import("@/lib/poju/session-manager");
  await deletePOJUSession(sessionId);
  const ownerKey = await resolveLocalOwnerKey();
  const db = await ensurePojuDbReady();
  const rows = await db.archive.where("owner_key").equals(ownerKey).toArray();
  for (const row of rows) {
    if (row.product === "poju" && row.session_id === sessionId) {
      await db.archive.delete(row.archive_id);
    }
  }
  notifyArchiveUpdated();
}

/**
 * Phase 3 C5 — rename result. Decrypt/load failure must NOT rewrite the
 * plaintext `original_question` index or vault title (wrong index must not
 * become the new authority). Happy path goes through Session CAS only.
 */
export type RenamePojuSessionHistoryCode =
  | "EMPTY_TITLE"
  | "NOT_FOUND"
  | "DECRYPT_OR_LOAD_FAILED"
  | "CAS_FAILED";

export type RenamePojuSessionHistoryResult =
  | { ok: true; path: "cas" }
  | { ok: false; code: RenamePojuSessionHistoryCode; message: string };

export class RenamePojuSessionHistoryError extends Error {
  readonly code: RenamePojuSessionHistoryCode;
  constructor(code: RenamePojuSessionHistoryCode, message: string) {
    super(message);
    this.name = "RenamePojuSessionHistoryError";
    this.code = code;
  }
}

/**
 * Rename display title for a live POJU session (question + vault title).
 *
 * Phase 3 C5 (Max §8 / S0 W6f):
 * - Success: Session CAS (`savePOJUSession`) updates blob + plaintext index together;
 *   vault title follows via post-commit archive sync.
 * - Decrypt/load failure: **fail closed** — preserve `encrypted_data` and the
 *   existing `original_question` / archive title; return `DECRYPT_OR_LOAD_FAILED`.
 * - Must NOT silently overwrite an existing index with an unverifiable rename.
 */
export async function renamePojuSessionHistory(
  sessionId: string,
  title: string,
  locale = "en",
): Promise<RenamePojuSessionHistoryResult> {
  void locale; // call-site compat; vault title comes from CAS post-commit sync
  const next = title.trim();
  if (!next) {
    return {
      ok: false,
      code: "EMPTY_TITLE",
      message: "rename title must be non-empty after trim",
    };
  }

  const ownerKey = await resolveLocalOwnerKey();
  const db = await ensurePojuDbReady();
  const row = await db.pojuSessionRecords.get(sessionId);
  if (!row || !isRowOwnedBy(row, ownerKey)) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: `session row missing or not owned: ${sessionId}`,
    };
  }

  const indexBefore = row.original_question;
  const cipherBefore = row.encrypted_data;
  const ivBefore = row.iv;
  const existingVault = await findPojuVaultRecordForSession(sessionId);
  const vaultTitleBefore = existingVault?.title;

  const { loadPOJUSession, savePOJUSession } = await import("@/lib/poju/session-manager");

  let state: POJUSessionState | null = null;
  try {
    state = await loadPOJUSession(sessionId);
  } catch (e) {
    return {
      ok: false,
      code: "DECRYPT_OR_LOAD_FAILED",
      message:
        e instanceof Error
          ? e.message
          : "session load failed; refusing plaintext index rename",
    };
  }

  if (!state) {
    // Row exists but blob unverifiable. Fail closed — do not write index or vault title.
    void indexBefore;
    void cipherBefore;
    void ivBefore;
    void vaultTitleBefore;
    return {
      ok: false,
      code: "DECRYPT_OR_LOAD_FAILED",
      message:
        "Session blob could not be decrypted/loaded; refusing plaintext index rename to preserve index↔blob consistency",
    };
  }

  try {
    await savePOJUSession({ ...state, original_question: next });
  } catch (e) {
    return {
      ok: false,
      code: "CAS_FAILED",
      message: e instanceof Error ? e.message : String(e),
    };
  }

  return { ok: true, path: "cas" };
}

export async function loadPojuSessionVault(archiveId: string): Promise<POJUSessionVaultData | null> {
  const ownerKey = await resolveLocalOwnerKey();
  const record = await getPojuDb().archive.get(archiveId);
  if (!record || record.type !== "poju_session" || !isRowOwnedBy(record, ownerKey)) return null;
  try {
    return await decryptJson<POJUSessionVaultData>(ARCHIVE_SECRET, {
      iv: record.iv,
      cipher: record.encrypted_data,
    });
  } catch (e) {
    console.error("[archive] POJU session vault decrypt failed:", e);
    return null;
  }
}

export async function getArchiveRecord(archiveId: string): Promise<ArchiveRecord | undefined> {
  const ownerKey = await resolveLocalOwnerKey();
  const record = await getPojuDb().archive.get(archiveId);
  if (!record || !isRowOwnedBy(record, ownerKey)) return undefined;
  return record;
}
