import Dexie, { type EntityTable } from "dexie";
import type { EncryptedPayload } from "@/lib/crypto";
import type { UserProfile } from "@/lib/profile/types";

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
  current_state_hint:
    | "opening"
    | "greeting"
    | "collecting_context"
    | "awaiting_profile"
    | "awaiting_confirmation"
    | "analyzing"
    | "delivered"
    | "tracking";
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

/** POJU_v4.0_Agent_Implementation_Part1 — Step 1: multi-person BaZi rows (plaintext index + encrypted blob). */
export type StoredProfileRelationship =
  | "self"
  | "spouse"
  | "child"
  | "parent"
  | "sibling"
  | "friend"
  | "other";

export interface StoredProfileRecord {
  profile_id: string;
  device_id: string;
  display_name: string;
  birth_info_hash: string;
  relationship: StoredProfileRelationship;
  /** AES-GCM ciphertext (base64), same convention as `pojuSessionRecords.encrypted_data`. */
  encrypted_data: string;
  iv: string;
  created_at: Date;
  last_used_at: Date;
  used_in_products: { poju: number; glyph: number; syncro: number };
  has_base_analysis: boolean;
  base_analysis_at?: Date;
}

/** v5: 时辰段 + 时区（无经纬度/地点名）。Legacy rows normalized on read. */
export interface StoredProfileBirthInfo {
  year: number;
  month: number;
  day: number;
  hour_period?: import("@/lib/profile/types").HourPeriod;
  /** @deprecated v4 legacy */
  hour?: number;
  minute?: number;
  gender: "M" | "F" | "X";
  timezone: string;
  longitude?: number;
  latitude?: number;
  location_name?: string;
}

export interface StoredProfileData {
  birth_info: StoredProfileBirthInfo;
  user_profile: UserProfile;
  base_analysis?: {
    generated_at: string;
    model: string;
    content: unknown;
    tokens_used: number;
  };
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
  stored_profiles!: EntityTable<StoredProfileRecord, "profile_id">;

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
    this.version(4).stores({
      userProfiles: "id, updatedAt",
      glyphHistory: "id, updatedAt",
      syncroCache: "id, updatedAt",
      pojuSessions: "id, updatedAt",
      usage: "id, dayKey, product, updatedAt",
      pojuSessionRecords: "session_id, device_id, status, expires_at, last_interaction_at",
      pojuSessionArchive: "session_id, device_id, archived_at",
      stored_profiles: "profile_id, device_id, birth_info_hash, last_used_at, has_base_analysis",
    });
  }
}

let singleton: PojuDb | null = null;

export function getPojuDb(): PojuDb {
  if (!singleton) singleton = new PojuDb();
  return singleton;
}
