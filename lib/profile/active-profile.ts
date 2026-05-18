import { decryptJson, encryptJson } from "@/lib/crypto";
import { getPojuDb } from "@/lib/db/poju-db";
import type { UserProfile } from "@/lib/profile/types";

const PROFILE_KEY = "default";
const SECRET_KEY = "pojulife_v4_profile";

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const db = getPojuDb();
  const payload = await encryptJson(SECRET_KEY, profile);
  const now = Date.now();
  await db.userProfiles.put({
    id: PROFILE_KEY,
    payload,
    createdAt: profile.createdAt ?? now,
    updatedAt: now,
  });
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const db = getPojuDb();
  const row = await db.userProfiles.get(PROFILE_KEY);
  if (!row) return null;
  try {
    return await decryptJson<UserProfile>(SECRET_KEY, row.payload);
  } catch {
    return null;
  }
}
