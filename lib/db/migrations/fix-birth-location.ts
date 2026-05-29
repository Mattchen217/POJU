/**
 * One-off helper: scan stored profiles for birth locations that look corrupted.
 * Run in browser devtools: `import('@/lib/db/migrations/fix-birth-location').then(m => m.fixOrphanedBirthLocations())`
 */
import { getPojuDb } from "@/lib/db/poju-db";
import { decryptJson } from "@/lib/crypto";
import { isGenericDefaultLocationName } from "@/lib/profile/birth-info-display";
import { normalizeStoredBirthInfo } from "@/lib/profile/birth-info-utils";

const STORED_PROFILES_SECRET = "pojulife_v4_stored_profiles";

export async function fixOrphanedBirthLocations(): Promise<number> {
  if (typeof window === "undefined") {
    throw new Error("fixOrphanedBirthLocations is browser-only");
  }

  const db = getPojuDb();
  const records = await db.stored_profiles.toArray();
  let flagged = 0;

  for (const record of records) {
    try {
      const data = await decryptJson<{
        birth_info: Record<string, unknown>;
        user_profile?: { birth?: { birth_location?: { name?: string; longitude?: number; use_defaults?: boolean } } };
      }>(STORED_PROFILES_SECRET, {
        iv: record.iv,
        cipher: record.encrypted_data,
      });

      const birth = normalizeStoredBirthInfo(data.birth_info);
      const loc = birth.birth_location;

      if (
        loc?.longitude &&
        (!loc.name || isGenericDefaultLocationName(loc.name) || loc.use_defaults)
      ) {
        console.log("[fix-birth-location] orphaned location:", {
          profile_id: record.profile_id,
          display_name: record.display_name,
          birth_location: loc,
        });
        flagged += 1;
      }
    } catch (e) {
      console.warn("[fix-birth-location] decrypt failed:", record.profile_id, e);
    }
  }

  console.log(`[fix-birth-location] flagged ${flagged} profile(s) needing user re-entry`);
  return flagged;
}
