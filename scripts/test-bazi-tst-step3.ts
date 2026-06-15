/**
 * POJU/Match/Glyph True Solar Time — Step 3 UI verification.
 * Run: pnpm test:bazi-tst-step3
 */
import { readFileSync } from "fs";
import { join } from "path";

const root = join(process.cwd());

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function main() {
  const picker = read("components/poju/BirthInfoPicker.tsx");
  const locationStep = read("components/profile/BirthLocationStep.tsx");
  const en = read("messages/en.json");
  const zh = read("messages/zh.json");
  const validate = read("lib/profile/validate-birth-location.ts");
  const stored = read("lib/profile/stored-profiles-service.ts");

  assert(locationStep.includes("BirthLocationField"), "BirthLocationField integrated");
  assert(!locationStep.includes("onSkip"), "Skip removed from location step");
  assert(!picker.includes("handleLocationSkip"), "Skip removed from picker");
  assert(locationStep.includes("resolveBirthLocationForSubmit"), "Resolves GPS/IP/search on continue");

  assert(validate.includes("validateBirthLocationRequired"), "Validation helper");
  assert(stored.includes("validateBirthLocationRequired"), "createStoredProfile validates location");

  assert(!picker.includes('useState<"birth" | "location">'), "Single-page flow (no step wizard)");
  assert(!picker.includes("BirthLocationStep"), "Location embedded in picker");
  assert(picker.includes("BirthLocationField"), "BirthLocationField embedded in picker");
  assert(picker.includes('name="hour"'), "Hour wheel column");
  assert(picker.includes('name="minute"'), "Minute wheel column");
  assert(picker.includes("isBirthLocationComplete"), "Location validated on submit");
  assert(picker.includes("birth_location"), "birth_location passed on submit");

  assert(en.includes('"birth_form"'), "en birth_form namespace");
  assert(zh.includes("出生地点"), "zh birth location label");
  assert(zh.includes("出生时间"), "zh birth time label");

  const confirm = read("components/poju/BirthInfoConfirmDialog.tsx");
  assert(confirm.includes("location_label"), "Confirm dialog shows location");
  assert(confirm.includes("formatBirthTimeDisplay"), "Confirm dialog shows precise time");

  const parseBody = read("lib/profile/stored-birth-info.ts");
  assert(parseBody.includes("birth_location_required"), "API rejects use_defaults");

  console.log("test-bazi-tst-step3: OK");
}

main();
