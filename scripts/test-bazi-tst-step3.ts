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

  assert(locationStep.includes("BirthLocationStep"), "BirthLocationStep component exists");
  assert(locationStep.includes("CitySearchBox"), "CitySearchBox integrated");
  assert(locationStep.includes("skip_use_default"), "Skip option");
  assert(locationStep.includes("why_link"), "Why link");
  assert(locationStep.includes("buildDefaultBirthLocation") || picker.includes("buildDefaultBirthLocation"), "Default builder");

  assert(picker.includes('useState<"birth" | "location">'), "Two-step flow");
  assert(picker.includes("BirthLocationStep"), "Picker integrates location step");
  assert(picker.includes("birth_location"), "birth_location passed on submit");

  assert(en.includes('"profile"'), "en profile namespace");
  assert(en.includes('"birth_location"'), "en birth_location keys");
  assert(zh.includes("出生地"), "zh birth location title");

  const confirm = read("components/poju/BirthInfoConfirmDialog.tsx");
  assert(confirm.includes("location_label"), "Confirm dialog shows location");

  console.log("✅ Bazi TST Step 3 — birth location UI OK");
}

main();
