/**
 * IndexedDB store for delivery narration audio (local reuse; owner-scoped).
 */

import Dexie, { type Table } from "dexie";

import { getLocalOwnerKey, isRowOwnedBy } from "@/lib/storage/local-owner";

export type DeliveryAudioRecord = {
  /** `${ownerKey}__${sessionId}__${contentHash}` */
  id: string;
  owner_key: string;
  session_id: string;
  content_hash: string;
  locale: string;
  mime: string;
  blob: Blob;
  byte_length: number;
  char_count: number;
  created_at: number;
};

class DeliveryAudioDb extends Dexie {
  delivery_audio!: Table<DeliveryAudioRecord, string>;

  constructor() {
    super("pojulife-delivery-audio");
    this.version(1).stores({
      delivery_audio: "id, owner_key, session_id, content_hash, created_at",
    });
  }
}

const db = typeof window !== "undefined" ? new DeliveryAudioDb() : null;

export function deliveryAudioRecordId(
  ownerKey: string,
  sessionId: string,
  contentHash: string,
): string {
  return `${ownerKey}__${sessionId}__${contentHash}`;
}

export async function getDeliveryAudio(
  sessionId: string,
  contentHash: string,
): Promise<DeliveryAudioRecord | null> {
  if (!db) return null;
  const ownerKey = await getLocalOwnerKey();
  const id = deliveryAudioRecordId(ownerKey, sessionId, contentHash);
  const row = await db.delivery_audio.get(id);
  if (!row || !isRowOwnedBy(row, ownerKey)) return null;
  return row;
}

export async function putDeliveryAudio(input: {
  sessionId: string;
  contentHash: string;
  locale: string;
  mime: string;
  blob: Blob;
  charCount: number;
}): Promise<DeliveryAudioRecord> {
  if (!db) {
    throw new Error("delivery_audio_db_unavailable");
  }
  const ownerKey = await getLocalOwnerKey();
  const id = deliveryAudioRecordId(ownerKey, input.sessionId, input.contentHash);
  const row: DeliveryAudioRecord = {
    id,
    owner_key: ownerKey,
    session_id: input.sessionId,
    content_hash: input.contentHash,
    locale: input.locale,
    mime: input.mime || "audio/mpeg",
    blob: input.blob,
    byte_length: input.blob.size,
    char_count: input.charCount,
    created_at: Date.now(),
  };
  await db.delivery_audio.put(row);
  return row;
}

/** Drop every narration cache row for this delivery session (regen replaces old). */
export async function deleteAllDeliveryAudioForSession(
  sessionId: string,
): Promise<number> {
  if (!db) return 0;
  const ownerKey = await getLocalOwnerKey();
  const rows = await db.delivery_audio
    .where("session_id")
    .equals(sessionId)
    .filter((row) => isRowOwnedBy(row, ownerKey))
    .toArray();
  if (rows.length === 0) return 0;
  await db.delivery_audio.bulkDelete(rows.map((r) => r.id));
  return rows.length;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
