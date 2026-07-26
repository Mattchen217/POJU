/**
 * POJU_v4.0_Agent_Implementation_Part1 — Step 1 schema smoke test.
 *
 * Run in the browser (e.g. DevTools on any pojulife page that loads client bundles):
 *
 * ```js
 * const { runStoredProfilesSchemaSelfTest } = await import('@/scripts/test-stored-profiles-schema');
 * await runStoredProfilesSchemaSelfTest();
 * ```
 *
 * Or paste the body of `runStoredProfilesSchemaSelfTest` after importing `getPojuDb` from `@/lib/db/poju-db`.
 */

import { getPojuDb } from "@/lib/db/poju-db";

export async function runStoredProfilesSchemaSelfTest(): Promise<void> {
  const db = getPojuDb();
  const tables = db.tables.map((x) => x.name);
  console.log("All tables:", tables);
  console.log("Has stored_profiles:", tables.includes("stored_profiles"));

  const id = "test-stored-profile-schema-1";
  await db.stored_profiles.put({
    profile_id: id,
    device_id: "test-device",
    display_name: "Schema test",
    birth_info_hash: "test-hash",
    relationship: "self",
    encrypted_data: "test-cipher",
    iv: "test-iv",
    created_at: new Date(),
    last_used_at: new Date(),
    used_in_products: { poju: 0, glyph: 0, syncro: 0, match: 0, atmos: 0 },
    has_base_analysis: false,
  });

  const record = await db.stored_profiles.get(id);
  console.log("Record read:", record);
  await db.stored_profiles.delete(id);
  console.log("✅ stored_profiles schema read/write/delete OK");
}
