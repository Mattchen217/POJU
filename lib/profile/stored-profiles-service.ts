/**
 * Multi-person BaZi profiles on device (POJU_v4.0_Agent_Implementation_Part1 Step 2).
 * Browser-only (IndexedDB + Web Crypto).
 */

import { encryptJson, decryptJson } from "@/lib/crypto";
import { calculateProfile } from "@/lib/calculations";
import { getPojuDb } from "@/lib/db/poju-db";
import type {
  StoredProfileData,
  StoredProfileBirthInfo,
  StoredProfileRecord,
  StoredProfileRelationship,
} from "@/lib/db/poju-db";
import { getPojuDeviceId } from "@/lib/poju/client-device-id";
import type { BirthGender, BirthInfo, UserProfile } from "@/lib/profile/types";

const STORED_PROFILES_SECRET = "pojulife_v4_stored_profiles";

function assertBrowser(): void {
  if (typeof window === "undefined") {
    throw new Error("stored_profiles API is browser-only");
  }
}

function genderToBirthGender(g: StoredProfileBirthInfo["gender"]): BirthGender {
  if (g === "M") return "male";
  if (g === "F") return "female";
  return "other";
}

function toBirthInfo(b: StoredProfileBirthInfo): BirthInfo {
  return {
    year: b.year,
    month: b.month,
    day: b.day,
    hour: b.hour,
    minute: b.minute,
    gender: genderToBirthGender(b.gender),
    city: b.location_name,
    latitude: b.latitude,
    longitude: b.longitude,
  };
}

async function hashBirthInfo(birth: StoredProfileBirthInfo): Promise<string> {
  const canonical = `${birth.year}-${birth.month}-${birth.day}-${birth.hour}-${birth.minute}-${birth.gender}`;
  const data = new TextEncoder().encode(canonical);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface StoredProfileSummary {
  profile_id: string;
  display_name: string;
  relationship: string;
  birth_date: string;
  birth_time: string;
  gender: "M" | "F" | "X";
  location_name: string;
  has_base_analysis: boolean;
  used_in_products: { poju: number; glyph: number; syncro: number };
  last_used_at: string;
  created_at: string;
}

export async function listStoredProfiles(): Promise<StoredProfileSummary[]> {
  if (typeof window === "undefined") return [];

  const deviceId = getPojuDeviceId();
  const db = getPojuDb();
  const records = await db.stored_profiles.where("device_id").equals(deviceId).sortBy("last_used_at");
  records.reverse();

  const summaries: StoredProfileSummary[] = [];

  for (const record of records) {
    try {
      const data = await decryptJson<StoredProfileData>(STORED_PROFILES_SECRET, {
        iv: record.iv,
        cipher: record.encrypted_data,
      });
      const b = data.birth_info;
      summaries.push({
        profile_id: record.profile_id,
        display_name: record.display_name,
        relationship: record.relationship,
        birth_date: `${b.year}-${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")}`,
        birth_time: `${String(b.hour).padStart(2, "0")}:${String(b.minute).padStart(2, "0")}`,
        gender: b.gender,
        location_name: b.location_name || "—",
        has_base_analysis: record.has_base_analysis,
        used_in_products: record.used_in_products,
        last_used_at: record.last_used_at.toISOString(),
        created_at: record.created_at.toISOString(),
      });
    } catch {
      console.warn("[stored-profiles] Failed to decrypt:", record.profile_id);
    }
  }

  return summaries;
}

export async function createStoredProfile(input: {
  birth_info: StoredProfileBirthInfo;
  display_name: string;
  relationship: StoredProfileRelationship;
}): Promise<{ profile_id: string; is_duplicate: boolean }> {
  assertBrowser();

  const deviceId = getPojuDeviceId();
  const db = getPojuDb();
  const hash = await hashBirthInfo(input.birth_info);

  const existing = await db.stored_profiles
    .where("birth_info_hash")
    .equals(hash)
    .filter((r) => r.device_id === deviceId)
    .first();

  if (existing) {
    await db.stored_profiles.update(existing.profile_id, { last_used_at: new Date() });
    return { profile_id: existing.profile_id, is_duplicate: true };
  }

  const userProfile = await calculateProfile(toBirthInfo(input.birth_info));

  const payload: StoredProfileData = {
    birth_info: input.birth_info,
    user_profile: userProfile,
  };

  const enc = await encryptJson(STORED_PROFILES_SECRET, payload);
  const profileId = crypto.randomUUID();
  const now = new Date();

  await db.stored_profiles.put({
    profile_id: profileId,
    device_id: deviceId,
    display_name: input.display_name,
    birth_info_hash: hash,
    relationship: input.relationship,
    encrypted_data: enc.cipher,
    iv: enc.iv,
    created_at: now,
    last_used_at: now,
    used_in_products: { poju: 0, glyph: 0, syncro: 0 },
    has_base_analysis: false,
  });

  return { profile_id: profileId, is_duplicate: false };
}

/** Build `StoredProfileBirthInfo` from a saved `UserProfile` + display meta (after `/api/profile/calculate`). */
export function storedBirthInfoFromUserProfile(
  profile: UserProfile,
  opts?: { timezone?: string },
): StoredProfileBirthInfo {
  const b = profile.birth;
  const g =
    b.gender === "male" ? ("M" as const) : b.gender === "female" ? ("F" as const) : ("X" as const);
  return {
    year: b.year,
    month: b.month,
    day: b.day,
    hour: b.hour,
    minute: b.minute ?? 0,
    gender: g,
    timezone: opts?.timezone ?? "Asia/Shanghai",
    longitude: b.longitude ?? 0,
    latitude: b.latitude ?? 0,
    location_name: b.city,
  };
}

/** Save an already-calculated profile (e.g. from `BirthInfoForm` + `/api/profile/calculate`) without re-running shunshi. */
export async function importCalculatedProfileAsStored(input: {
  profile: UserProfile;
  display_name: string;
  relationship: StoredProfileRelationship;
  timezone?: string;
}): Promise<{ profile_id: string; is_duplicate: boolean }> {
  assertBrowser();
  const birth_info = storedBirthInfoFromUserProfile(input.profile, { timezone: input.timezone });
  const deviceId = getPojuDeviceId();
  const db = getPojuDb();
  const hash = await hashBirthInfo(birth_info);

  const existing = await db.stored_profiles
    .where("birth_info_hash")
    .equals(hash)
    .filter((r) => r.device_id === deviceId)
    .first();

  if (existing) {
    await db.stored_profiles.update(existing.profile_id, { last_used_at: new Date() });
    return { profile_id: existing.profile_id, is_duplicate: true };
  }

  const payload: StoredProfileData = {
    birth_info,
    user_profile: input.profile,
  };

  const enc = await encryptJson(STORED_PROFILES_SECRET, payload);
  const profileId = crypto.randomUUID();
  const now = new Date();

  await db.stored_profiles.put({
    profile_id: profileId,
    device_id: deviceId,
    display_name: input.display_name,
    birth_info_hash: hash,
    relationship: input.relationship,
    encrypted_data: enc.cipher,
    iv: enc.iv,
    created_at: now,
    last_used_at: now,
    used_in_products: { poju: 0, glyph: 0, syncro: 0 },
    has_base_analysis: false,
  });

  return { profile_id: profileId, is_duplicate: false };
}

export async function getStoredProfile(profileId: string): Promise<StoredProfileData | null> {
  if (typeof window === "undefined") return null;
  const db = getPojuDb();
  const record = await db.stored_profiles.get(profileId);
  if (!record) return null;
  try {
    return await decryptJson<StoredProfileData>(STORED_PROFILES_SECRET, {
      iv: record.iv,
      cipher: record.encrypted_data,
    });
  } catch (e) {
    console.error("[stored-profiles] Decrypt failed:", e);
    return null;
  }
}

export async function getStoredProfileRecord(profileId: string): Promise<StoredProfileRecord | null> {
  if (typeof window === "undefined") return null;
  return (await getPojuDb().stored_profiles.get(profileId)) ?? null;
}

export async function saveBaseAnalysis(
  profileId: string,
  baseAnalysis: unknown,
  meta: { model: string; tokens_used: number },
): Promise<void> {
  assertBrowser();
  const db = getPojuDb();
  const record = await db.stored_profiles.get(profileId);
  if (!record) throw new Error("Profile not found");

  const data = await decryptJson<StoredProfileData>(STORED_PROFILES_SECRET, {
    iv: record.iv,
    cipher: record.encrypted_data,
  });
  data.base_analysis = {
    generated_at: new Date().toISOString(),
    model: meta.model,
    tokens_used: meta.tokens_used,
    content: baseAnalysis,
  };

  const enc = await encryptJson(STORED_PROFILES_SECRET, data);
  await db.stored_profiles.update(profileId, {
    encrypted_data: enc.cipher,
    iv: enc.iv,
    has_base_analysis: true,
    base_analysis_at: new Date(),
    last_used_at: new Date(),
  });
}

export async function recordProfileUsage(
  profileId: string,
  product: "poju" | "glyph" | "syncro",
): Promise<void> {
  if (typeof window === "undefined") return;
  const db = getPojuDb();
  const record = await db.stored_profiles.get(profileId);
  if (!record) return;
  const updated = { ...record.used_in_products };
  updated[product] = (updated[product] || 0) + 1;
  await db.stored_profiles.update(profileId, {
    used_in_products: updated,
    last_used_at: new Date(),
  });
}

export async function deleteStoredProfile(profileId: string): Promise<void> {
  assertBrowser();
  await getPojuDb().stored_profiles.delete(profileId);
}

export async function updateStoredProfileMeta(
  profileId: string,
  updates: { display_name?: string; relationship?: StoredProfileRelationship },
): Promise<void> {
  assertBrowser();
  const db = getPojuDb();
  const record = await db.stored_profiles.get(profileId);
  if (!record) return;
  await db.stored_profiles.update(profileId, {
    ...updates,
    last_used_at: new Date(),
  });
}
