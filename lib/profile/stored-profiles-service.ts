/**
 * Multi-person BaZi profiles on device (POJU v5 Step B).
 */
import { encryptJson, decryptJson } from "@/lib/crypto";
import { sha256Hex } from "@/lib/sha256";
import { calculateProfile } from "@/lib/calculations";
import { getUserProfile } from "@/lib/profile/active-profile";
import { getPojuDb } from "@/lib/db/poju-db";
import type { StoredProfileData, StoredProfileRecord } from "@/lib/db/poju-db";
import { getPojuDeviceId } from "@/lib/poju/client-device-id";
import {
  generateDisplayName,
  normalizeStoredBirthInfo,
} from "@/lib/profile/birth-info-utils";
import type { BirthInfo, UserProfile } from "@/lib/profile/types";

const STORED_PROFILES_SECRET = "pojulife_v4_stored_profiles";

function assertBrowser(): void {
  if (typeof window === "undefined") {
    throw new Error("stored_profiles API is browser-only");
  }
}

async function hashBirthInfo(birth: BirthInfo): Promise<string> {
  const canonical = `${birth.year}-${birth.month}-${birth.day}-${birth.hour_period}-${birth.gender}-${birth.timezone}`;
  return sha256Hex(new TextEncoder().encode(canonical));
}

export interface StoredProfileSummary {
  profile_id: string;
  display_name: string;
  birth_date: string;
  hour_period: BirthInfo["hour_period"];
  gender: "M" | "F";
  timezone: string;
  relationship: import("@/lib/db/poju-db").StoredProfileRelationship;
  has_base_analysis: boolean;
  used_in_products: { poju: number; glyph: number; syncro: number; match: number };
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
      const b = normalizeStoredBirthInfo(data.birth_info as unknown as Record<string, unknown>);
      summaries.push({
        profile_id: record.profile_id,
        display_name: record.display_name,
        birth_date: `${b.year}-${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")}`,
        hour_period: b.hour_period,
        gender: b.gender,
        timezone: b.timezone,
        relationship: record.relationship,
        has_base_analysis: record.has_base_analysis,
        used_in_products: {
          poju: record.used_in_products.poju ?? 0,
          glyph: record.used_in_products.glyph ?? 0,
          syncro: record.used_in_products.syncro ?? 0,
          match: record.used_in_products.match ?? 0,
        },
        last_used_at: record.last_used_at.toISOString(),
        created_at: record.created_at.toISOString(),
      });
    } catch {
      console.warn("[stored-profiles] Failed to decrypt:", record.profile_id);
    }
  }

  return summaries;
}

/**
 * Session prep (POJU / Glyph / Syncro / Match): shared multi-profile list.
 * If v5 `stored_profiles` is empty but legacy `userProfiles` exists, import once.
 */
export async function listStoredProfilesForSessionPrep(): Promise<StoredProfileSummary[]> {
  let list = await listStoredProfiles();
  if (list.length > 0) return list;

  const legacy = await getUserProfile();
  if (!legacy?.birth?.year) return list;

  try {
    await importCalculatedProfileAsStored({ profile: legacy });
    list = await listStoredProfiles();
  } catch (e) {
    console.warn("[stored-profiles] Legacy profile import failed:", e);
  }
  return list;
}

export async function createStoredProfile(input: {
  birth_info: BirthInfo;
}): Promise<{ profile_id: string; is_duplicate: boolean }> {
  assertBrowser();

  const birth_info = input.birth_info;
  const deviceId = getPojuDeviceId();
  const db = getPojuDb();
  const hash = await hashBirthInfo(birth_info);
  const display_name = generateDisplayName(birth_info);

  const existing = await db.stored_profiles
    .where("birth_info_hash")
    .equals(hash)
    .filter((r) => r.device_id === deviceId)
    .first();

  if (existing) {
    await db.stored_profiles.update(existing.profile_id, { last_used_at: new Date() });
    return { profile_id: existing.profile_id, is_duplicate: true };
  }

  const userProfile = await calculateProfile(birth_info);

  const payload: StoredProfileData = {
    birth_info: birth_info as unknown as StoredProfileData["birth_info"],
    user_profile: userProfile,
  };

  const enc = await encryptJson(STORED_PROFILES_SECRET, payload);
  const profileId = crypto.randomUUID();
  const now = new Date();

  await db.stored_profiles.put({
    profile_id: profileId,
    device_id: deviceId,
    display_name,
    birth_info_hash: hash,
    relationship: "self",
    encrypted_data: enc.cipher,
    iv: enc.iv,
    created_at: now,
    last_used_at: now,
    used_in_products: { poju: 0, glyph: 0, syncro: 0, match: 0 },
    has_base_analysis: false,
  });

  return { profile_id: profileId, is_duplicate: false };
}

/** Build stored birth_info from calculated profile (v5). */
export function storedBirthInfoFromUserProfile(profile: UserProfile): BirthInfo {
  return profile.birth;
}

/** Save an already-calculated profile without re-running shunshi. */
export async function importCalculatedProfileAsStored(input: {
  profile: UserProfile;
  timezone?: string;
}): Promise<{ profile_id: string; is_duplicate: boolean }> {
  assertBrowser();
  let birth_info = input.profile.birth;
  if (input.timezone && birth_info.timezone !== input.timezone) {
    birth_info = { ...birth_info, timezone: input.timezone };
  }
  return createStoredProfile({ birth_info });
}

export async function getStoredProfile(profileId: string): Promise<StoredProfileData | null> {
  if (typeof window === "undefined") return null;
  const db = getPojuDb();
  const record = await db.stored_profiles.get(profileId);
  if (!record) return null;
  try {
    const data = await decryptJson<StoredProfileData>(STORED_PROFILES_SECRET, {
      iv: record.iv,
      cipher: record.encrypted_data,
    });
    const birth = normalizeStoredBirthInfo(data.birth_info as unknown as Record<string, unknown>);
    return {
      ...data,
      birth_info: birth as unknown as StoredProfileData["birth_info"],
      user_profile: { ...data.user_profile, birth },
    };
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
  product: "poju" | "glyph" | "syncro" | "match",
): Promise<void> {
  if (typeof window === "undefined") return;
  const db = getPojuDb();
  const record = await db.stored_profiles.get(profileId);
  if (!record) return;
  const updated = {
    poju: record.used_in_products.poju ?? 0,
    glyph: record.used_in_products.glyph ?? 0,
    syncro: record.used_in_products.syncro ?? 0,
    match: record.used_in_products.match ?? 0,
  };
  updated[product] += 1;
  await db.stored_profiles.update(profileId, {
    used_in_products: updated,
    last_used_at: new Date(),
  });
}

export async function deleteStoredProfile(profileId: string): Promise<void> {
  assertBrowser();
  await getPojuDb().stored_profiles.delete(profileId);
}
