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
  used_in_products: { poju: number; glyph: number; syncro: number; match: number };
  has_base_analysis: boolean;
  base_analysis_at?: Date;
}

/** v5 birth + optional true solar time metadata. Legacy rows normalized on read. */
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
  birth_location?: import("@/lib/profile/types").BirthLocation;
  tst_meta?: import("@/lib/profile/types").TstMeta;
  /** @deprecated flat legacy — prefer birth_location */
  longitude?: number;
  latitude?: number;
  location_name?: string;
}

export interface StoredProfileBaseAnalysis {
  generated_at: string;
  model: string;
  content: unknown;
  tokens_used: number;
  /** True when chart used user-provided birth coordinates. */
  used_true_solar_time?: boolean;
  tst_meta?: import("@/lib/profile/types").TstMeta;
}

export interface StoredProfileData {
  birth_info: StoredProfileBirthInfo;
  user_profile: UserProfile;
  base_analysis?: StoredProfileBaseAnalysis;
}

/** POJU 改进 3 — encrypted action-plan vault rows. */
export interface ArchiveRecord {
  archive_id: string;
  device_id: string;
  type: "poju_action_recommendations" | "glyph_reading" | "syncro_task" | "match_session";
  session_id?: string;
  profile_id?: string;
  title: string;
  encrypted_data: string;
  iv: string;
  created_at: Date;
  product: "poju" | "glyph" | "syncro" | "match";
}

/** Match v5 — encrypted match report row (plaintext index + encrypted blob). */
export interface MatchSessionRecord {
  match_id: string;
  device_id: string;
  a_profile_id: string;
  b_profile_id: string;
  encrypted_data: string;
  iv: string;
  created_at: Date;
}

/** Syncro v5 — encrypted 24h session row (plaintext index + encrypted blob). */
export interface SyncroSessionRecord {
  session_id: string;
  device_id: string;
  profile_id: string;
  encrypted_data: string;
  iv: string;
  created_at: Date;
  expires_at: Date;
}

/** Syncro v5 — per-device product usage (first free + paid sessions). */
export interface DeviceUsageRecord {
  /** `${device_id}__${product}` */
  id: string;
  device_id: string;
  product: "glyph" | "syncro" | "match";
  free_used: boolean;
  free_used_at?: Date;
  paid_count: number;
  last_used_at: Date;
  total_cost_usd: number;
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
  archive!: EntityTable<ArchiveRecord, "archive_id">;
  device_usage!: EntityTable<DeviceUsageRecord, "id">;
  syncro_sessions!: EntityTable<SyncroSessionRecord, "session_id">;
  match_sessions!: EntityTable<MatchSessionRecord, "match_id">;

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
    this.version(5).stores({
      userProfiles: "id, updatedAt",
      glyphHistory: "id, updatedAt",
      syncroCache: "id, updatedAt",
      pojuSessions: "id, updatedAt",
      usage: "id, dayKey, product, updatedAt",
      pojuSessionRecords: "session_id, device_id, status, expires_at, last_interaction_at",
      pojuSessionArchive: "session_id, device_id, archived_at",
      stored_profiles: "profile_id, device_id, birth_info_hash, last_used_at, has_base_analysis",
      archive: "archive_id, device_id, type, session_id, created_at, product",
    });
    this.version(6).stores({
      userProfiles: "id, updatedAt",
      glyphHistory: "id, updatedAt",
      syncroCache: "id, updatedAt",
      pojuSessions: "id, updatedAt",
      usage: "id, dayKey, product, updatedAt",
      pojuSessionRecords: "session_id, device_id, status, expires_at, last_interaction_at",
      pojuSessionArchive: "session_id, device_id, archived_at",
      stored_profiles: "profile_id, device_id, birth_info_hash, last_used_at, has_base_analysis",
      archive: "archive_id, device_id, type, session_id, created_at, product",
      device_usage: "id, device_id, product, last_used_at",
    });
    this.version(7).stores({
      userProfiles: "id, updatedAt",
      glyphHistory: "id, updatedAt",
      syncroCache: "id, updatedAt",
      pojuSessions: "id, updatedAt",
      usage: "id, dayKey, product, updatedAt",
      pojuSessionRecords: "session_id, device_id, status, expires_at, last_interaction_at",
      pojuSessionArchive: "session_id, device_id, archived_at",
      stored_profiles: "profile_id, device_id, birth_info_hash, last_used_at, has_base_analysis",
      archive: "archive_id, device_id, type, session_id, created_at, product",
      device_usage: "id, device_id, product, last_used_at",
      syncro_sessions: "session_id, device_id, profile_id, created_at, expires_at",
    });
    this.version(8).stores({
      userProfiles: "id, updatedAt",
      glyphHistory: "id, updatedAt",
      syncroCache: "id, updatedAt",
      pojuSessions: "id, updatedAt",
      usage: "id, dayKey, product, updatedAt",
      pojuSessionRecords: "session_id, device_id, status, expires_at, last_interaction_at",
      pojuSessionArchive: "session_id, device_id, archived_at",
      stored_profiles: "profile_id, device_id, birth_info_hash, last_used_at, has_base_analysis",
      archive: "archive_id, device_id, type, session_id, created_at, product",
      device_usage: "id, device_id, product, last_used_at",
      syncro_sessions: "session_id, device_id, profile_id, created_at, expires_at",
      match_sessions: "match_id, device_id, a_profile_id, b_profile_id, created_at",
    });
  }
}

let singleton: PojuDb | null = null;

export function getPojuDb(): PojuDb {
  if (!singleton) singleton = new PojuDb();
  return singleton;
}
