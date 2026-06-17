import { safeRandomUUID } from "@/lib/client/safe-crypto";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { ensurePojuDbReady, getPojuDb, type ArchiveRecord } from "@/lib/db/poju-db";
import { ARCHIVE_UPDATED_EVENT } from "@/lib/archive/runtime-archive";
import { mapSessionActionsToArchiveActions } from "@/lib/archive/map-actions-for-archive";
import { getPojuDeviceId } from "@/lib/poju/client-device-id";
import { sessionListTopicLine } from "@/lib/poju/session-list-label";
import type { POJUSessionState } from "@/lib/poju/types";

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
  if (!md) return undefined;
  const text = [md.analysis?.user_situation_summary, md.conclusion?.core_message]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 4000);
  return text || undefined;
}

function buildVaultActions(session: POJUSessionState): PojuVaultArchiveAction[] {
  const deliveryActions = session.main_delivery?.actions?.length
    ? session.main_delivery.actions
    : session.actions;
  return mapSessionActionsToArchiveActions(deliveryActions.slice(0, 3));
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
  const deviceId = getPojuDeviceId();
  const db = await ensurePojuDbReady();
  const rows = await db.archive.where("device_id").equals(deviceId).toArray();
  const matches = rows.filter((r) => r.product === "poju" && r.session_id === sessionId);
  return matches.find((r) => r.type === "poju_session") ?? matches[0];
}

/** Upsert encrypted POJU session transcript into the cross-product archive vault. */
export async function syncPojuSessionVaultArchive(
  session: POJUSessionState,
  locale = "en",
): Promise<string> {
  const deviceId = getPojuDeviceId();
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
    type: "poju_session",
    session_id: session.session_id,
    profile_id: data.profile_id || undefined,
    title,
    encrypted_data: cipher,
    iv,
    created_at: existing?.created_at ?? now,
    product: "poju",
  });

  const dupes = (await db.archive.where("device_id").equals(deviceId).toArray()).filter(
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

export async function loadPojuSessionVault(archiveId: string): Promise<POJUSessionVaultData | null> {
  const record = await getPojuDb().archive.get(archiveId);
  if (!record || record.type !== "poju_session") return null;
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
  return getPojuDb().archive.get(archiveId);
}
