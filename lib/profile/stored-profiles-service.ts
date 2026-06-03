/**
 * Multi-person BaZi profiles on device (POJU v5 Step B).
 */
import { safeRandomUUID } from "@/lib/client/safe-crypto";
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
import { birthInfoToStoredRecord, tstMetaFromProfile } from "@/lib/profile/stored-birth-info";
import type { BirthInfo, BirthLocation, UserProfile } from "@/lib/profile/types";
import { validateBirthLocationRequired } from "@/lib/profile/validate-birth-location";

const STORED_PROFILES_SECRET = "pojulife_v4_stored_profiles";

function assertBrowser(): void {
  if (typeof window === "undefined") {
    throw new Error("stored_profiles API is browser-only");
  }
}

async function hashBirthInfo(birth: BirthInfo): Promise<string> {
  const loc = birth.birth_location;
  const locPart =
    loc && !loc.use_defaults
      ? `${loc.longitude}-${loc.latitude ?? 0}-${loc.name}`
      : `default-${birth.timezone}`;
  const canonical = `${birth.year}-${birth.month}-${birth.day}-${birth.hour_period}-${birth.gender}-${birth.timezone}-${locPart}`;
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
  used_true_solar_time?: boolean;
  birth_location_name?: string;
  birth_location_use_defaults?: boolean;
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
      const loc = b.birth_location;
      summaries.push({
        profile_id: record.profile_id,
        display_name: record.display_name,
        birth_date: `${b.year}-${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")}`,
        hour_period: b.hour_period,
        gender: b.gender,
        timezone: b.timezone,
        relationship: record.relationship,
        has_base_analysis: record.has_base_analysis,
        used_true_solar_time:
          data.user_profile?.used_true_solar_time ??
          data.base_analysis?.used_true_solar_time ??
          (loc ? !loc.use_defaults : undefined),
        birth_location_name: loc?.name,
        birth_location_use_defaults: loc?.use_defaults,
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
  /** Only show profiles with a completed 命主基础分析 — no "empty shell" rows after failed LLM. */
  list = list.filter((p) => p.has_base_analysis);
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
  validateBirthLocationRequired(birth_info);
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
  const storedBirth = birthInfoToStoredRecord({
    ...birth_info,
    tst_meta: userProfile.tst_meta ?? birth_info.tst_meta,
    birth_location: userProfile.birth.birth_location ?? birth_info.birth_location,
  });

  const payload: StoredProfileData = {
    birth_info: storedBirth,
    user_profile: userProfile,
  };

  console.log("[createStoredProfile] writing birth_location:", {
    profile_id: "(new)",
    birth_info: storedBirth.birth_location,
    user_profile: userProfile.birth.birth_location,
  });

  const enc = await encryptJson(STORED_PROFILES_SECRET, payload);
  const profileId = safeRandomUUID();
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

export function stripMetaSectionForStorage(content: string): string {
  const idx = content.lastIndexOf("---META---");
  return idx === -1 ? content : content.slice(0, idx).trim();
}

export async function saveBaseAnalysisFromStream(input: {
  profile_id: string;
  display_text: string;
  structured: import("@/lib/calculations/build-profile-structured").ProfileStructured;
  meta?: Record<string, unknown>;
  locale: string;
  generated_at: string;
  /** @deprecated legacy — defaults to display_text */
  content?: string;
}): Promise<void> {
  assertBrowser();
  const db = getPojuDb();
  const record = await db.stored_profiles.get(input.profile_id);
  if (!record) throw new Error("profile not found");

  const data = await decryptJson<StoredProfileData>(STORED_PROFILES_SECRET, {
    iv: record.iv,
    cipher: record.encrypted_data,
  });

  const displayText = input.display_text.trim();
  const tst_meta =
    tstMetaFromProfile(
      normalizeStoredBirthInfo(data.birth_info as unknown as Record<string, unknown>),
      data.user_profile,
    );
  const used_true_solar_time = data.user_profile.used_true_solar_time ?? false;

  // Preserve birth_location — only update base_analysis (+ tst_meta on birth_info).
  const preservedBirthLocation = data.user_profile.birth?.birth_location ?? data.birth_info.birth_location;

  data.base_analysis = {
    generated_at: input.generated_at,
    model: "v4_structured_display",
    tokens_used: 0,
    structured: input.structured,
    display_text: displayText,
    content: input.content?.trim() || displayText,
    used_true_solar_time,
    tst_meta,
    stream_meta: input.meta,
    locale: input.locale,
    computation_version: "v4_structured_display",
  };

  if (tst_meta && data.birth_info) {
    data.birth_info.tst_meta = tst_meta;
  }

  if (preservedBirthLocation) {
    data.birth_info.birth_location = preservedBirthLocation;
    data.user_profile.birth = {
      ...data.user_profile.birth,
      birth_location: preservedBirthLocation,
    };
  }

  console.log("[saveBaseAnalysisFromStream] preserving birth_location:", preservedBirthLocation);

  const enc = await encryptJson(STORED_PROFILES_SECRET, data);
  await db.stored_profiles.update(input.profile_id, {
    encrypted_data: enc.cipher,
    iv: enc.iv,
    has_base_analysis: true,
    base_analysis_at: new Date(),
    last_used_at: new Date(),
  });

  console.log("[saveBaseAnalysisFromStream] saved profile", input.profile_id);
}

export async function saveBaseAnalysis(
  profileId: string,
  baseAnalysis: unknown,
  meta: {
    model: string;
    tokens_used: number;
    raw_text?: string;
    used_true_solar_time?: boolean;
    tst_meta?: import("@/lib/profile/types").TstMeta;
  },
): Promise<void> {
  assertBrowser();
  const db = getPojuDb();
  const record = await db.stored_profiles.get(profileId);
  if (!record) throw new Error("Profile not found");

  const data = await decryptJson<StoredProfileData>(STORED_PROFILES_SECRET, {
    iv: record.iv,
    cipher: record.encrypted_data,
  });

  const tst_meta =
    meta.tst_meta ??
    tstMetaFromProfile(
      normalizeStoredBirthInfo(data.birth_info as unknown as Record<string, unknown>),
      data.user_profile,
    );
  const used_true_solar_time =
    meta.used_true_solar_time ?? data.user_profile.used_true_solar_time ?? false;

  data.base_analysis = {
    generated_at: new Date().toISOString(),
    model: meta.model,
    tokens_used: meta.tokens_used,
    content: baseAnalysis,
    raw_text: meta.raw_text?.trim() || undefined,
    used_true_solar_time,
    tst_meta,
  };

  if (tst_meta && data.birth_info) {
    data.birth_info.tst_meta = tst_meta;
  }

  const enc = await encryptJson(STORED_PROFILES_SECRET, data);
  await db.stored_profiles.update(profileId, {
    encrypted_data: enc.cipher,
    iv: enc.iv,
    has_base_analysis: true,
    base_analysis_at: new Date(),
    last_used_at: new Date(),
  });
}

/**
 * Recalculate chart with new birth location and clear cached base_analysis (Step 4/5 upgrade).
 */
export async function upgradeStoredProfileLocation(
  profileId: string,
  birthLocation: BirthLocation,
): Promise<UserProfile> {
  assertBrowser();
  const db = getPojuDb();
  const record = await db.stored_profiles.get(profileId);
  if (!record) throw new Error("Profile not found");

  const data = await decryptJson<StoredProfileData>(STORED_PROFILES_SECRET, {
    iv: record.iv,
    cipher: record.encrypted_data,
  });

  const birth = normalizeStoredBirthInfo(data.birth_info as unknown as Record<string, unknown>);
  const updatedBirth: BirthInfo = {
    ...birth,
    birth_location: birthLocation,
  };

  const userProfile = await calculateProfile(updatedBirth);
  const storedBirth = birthInfoToStoredRecord({
    ...updatedBirth,
    tst_meta: userProfile.tst_meta,
    birth_location: userProfile.birth.birth_location ?? birthLocation,
  });

  data.birth_info = storedBirth;
  data.user_profile = userProfile;
  delete data.base_analysis;

  const enc = await encryptJson(STORED_PROFILES_SECRET, data);
  await db.stored_profiles.update(profileId, {
    encrypted_data: enc.cipher,
    iv: enc.iv,
    has_base_analysis: false,
    base_analysis_at: undefined,
    last_used_at: new Date(),
  });

  return userProfile;
}

/** Whether IndexedDB has a completed 命主基础分析 for this profile. */
export async function profileHasBaseAnalysis(profileId: string): Promise<boolean> {
  assertBrowser();
  const record = await getStoredProfileRecord(profileId);
  if (!record?.has_base_analysis) return false;
  const data = await getStoredProfile(profileId);
  const ba = data?.base_analysis;
  if (!ba) return false;
  const content = ba.content;
  if (content !== undefined && content !== null) return true;
  return Boolean(ba.raw_text && ba.raw_text.trim().length > 80);
}

/**
 * Remove a profile that was created for analysis but never got a successful base_analysis.
 * Only deletes when it matches the session "pending" marker (new birth this flow).
 */
export async function discardIncompletePendingProfile(profileId: string): Promise<boolean> {
  assertBrowser();
  const { getPendingBaseAnalysisProfileId, clearPendingBaseAnalysisProfile } = await import(
    "@/lib/profile/pending-base-analysis"
  );
  if (getPendingBaseAnalysisProfileId() !== profileId) return false;
  if (await profileHasBaseAnalysis(profileId)) {
    clearPendingBaseAnalysisProfile();
    return false;
  }
  await deleteStoredProfile(profileId);
  clearPendingBaseAnalysisProfile();
  return true;
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
