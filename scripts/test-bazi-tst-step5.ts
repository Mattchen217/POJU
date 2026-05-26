/**
 * POJU/Match/Glyph True Solar Time — Step 5 migration UI tests.
 * Run: pnpm test:bazi-tst-step5
 */
import { readFileSync } from "fs";
import { join } from "path";
import { profileNeedsLocationUpgrade } from "@/lib/profile/upgrade-profile-location";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function main() {
  assert(profileNeedsLocationUpgrade(undefined) === true, "legacy profile needs upgrade");
  assert(profileNeedsLocationUpgrade(false) === true, "v1 needs upgrade");
  assert(profileNeedsLocationUpgrade(true) === false, "v2 does not need upgrade");

  const badge = read("components/profile/ProfileAccuracyBadge.tsx");
  const modal = read("components/profile/ProfileUpgradeModal.tsx");
  const upgrade = read("lib/profile/upgrade-profile-location.ts");
  const sessionPrep = read("components/poju/SessionPreparation.tsx");
  const selector = read("components/profile/ProfileSelector.tsx");
  const en = read("messages/en.json");

  assert(badge.includes("ProfileAccuracyBadge"), "badge component");
  assert(badge.includes("stopPropagation"), "upgrade click isolated");
  assert(modal.includes("CitySearchBox"), "modal city search");
  assert(modal.includes("upgradeProfileWithLocation"), "modal upgrade call");
  assert(modal.includes("keep_old_for_now"), "user can skip");
  assert(upgrade.includes("upgradeStoredProfileLocation"), "uses stored upgrade");
  assert(upgrade.includes("generateBaseAnalysis"), "regenerates analysis when cached");
  assert(sessionPrep.includes("ProfileUpgradeModal"), "session prep modal");
  assert(sessionPrep.includes("ProfileAccuracyBadge"), "session prep badge");
  assert(selector.includes("ProfileUpgradeModal"), "profile selector modal");
  assert(en.includes('"badge_upgradeable"'), "upgrade translations");

  console.log("✅ Bazi TST Step 5 — gentle migration UI OK");
}

main();
