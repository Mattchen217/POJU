import Dexie, { type EntityTable } from "dexie";
import type { EncryptedPayload } from "@/lib/crypto";

export type EncryptedRecord = {
  id: string;
  payload: EncryptedPayload;
  createdAt: number;
  updatedAt: number;
};

export type UsageRecord = {
  id: string;
  dayKey: string;
  product: "glyph" | "syncro_ar" | "poju";
  count: number;
  updatedAt: number;
};

/** POJU v4.0 Part1 — IndexedDB row (plaintext index fields + encrypted blob). */
export interface POJUSessionRecord {
  session_id: string;
  device_id: string;
  encrypted_data: string;
  iv: string;
  status: "active" | "paused" | "resolved" | "archived";
  original_question: string;
  created_at: Date;
  last_interaction_at: Date;
  expires_at: Date;
  payment_id: string;
  payment_processor: "dodopayments" | "stripe";
  renewals: Array<{
    extended_at: Date;
    reason: string;
  }>;
  tokens_used: number;
  turn_count: number;
  current_state_hint: "greeting" | "collecting_context" | "awaiting_profile" | "analyzing" | "delivered" | "tracking";
  main_delivery_done: boolean;
  main_delivery_at?: Date;
}

/** Snapshot row when a v4 POJU session is archived (Step 15). */
export interface POJUSessionArchiveRecord {
  session_id: string;
  device_id: string;
  encrypted_data: string;
  iv: string;
  archived_at: Date;
  original_question: string;
  user_marked_resolved: boolean;
  satisfaction_rating?: number;
}

export class PojuDb extends Dexie {
  userProfiles!: EntityTable<EncryptedRecord, "id">;
  glyphHistory!: EntityTable<EncryptedRecord, "id">;
  syncroCache!: EntityTable<EncryptedRecord, "id">;
  pojuSessions!: EntityTable<EncryptedRecord, "id">;
  usage!: EntityTable<UsageRecord, "id">;
  /** v4.0 POJU agent sessions (Part1 Step 1). */
  pojuSessionRecords!: EntityTable<POJUSessionRecord, "session_id">;
  pojuSessionArchive!: EntityTable<POJUSessionArchiveRecord, "session_id">;

  constructor() {
    super("pojulife_v4");
    this.version(1).stores({
      userProfiles: "id, updatedAt",
      glyphHistory: "id, updatedAt",
      syncroCache: "id, updatedAt",
      pojuSessions: "id, updatedAt",
      usage: "id, dayKey, product, updatedAt",
    });
    this.version(2).stores({
      userProfiles: "id, updatedAt",
      glyphHistory: "id, updatedAt",
      syncroCache: "id, updatedAt",
      pojuSessions: "id, updatedAt",
      usage: "id, dayKey, product, updatedAt",
      pojuSessionRecords: "session_id, device_id, status, expires_at, last_interaction_at",
    });
    this.version(3).stores({
      userProfiles: "id, updatedAt",
      glyphHistory: "id, updatedAt",
      syncroCache: "id, updatedAt",
      pojuSessions: "id, updatedAt",
      usage: "id, dayKey, product, updatedAt",
      pojuSessionRecords: "session_id, device_id, status, expires_at, last_interaction_at",
      pojuSessionArchive: "session_id, device_id, archived_at",
    });
  }
}

let singleton: PojuDb | null = null;

export function getPojuDb(): PojuDb {
  if (!singleton) singleton = new PojuDb();
  return singleton;
}
