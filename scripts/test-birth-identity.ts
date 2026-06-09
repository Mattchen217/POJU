import assert from "node:assert/strict";
import {
  buildBirthIdentityLabels,
  chineseZodiacAnimal,
  computeAgeYears,
  westernSunSign,
} from "@/lib/profile/birth-identity";

const ref2026 = new Date(2026, 5, 3);
const birthMay1977 = { year: 1977, month: 5, day: 15 };
const birthJan1977 = { year: 1977, month: 1, day: 28 };

assert.equal(computeAgeYears(birthMay1977, ref2026), 49);
assert.equal(chineseZodiacAnimal(birthMay1977).en, "Snake");
assert.equal(westernSunSign(birthJan1977).en, "Aquarius");

const labels = buildBirthIdentityLabels(birthMay1977, ref2026);
assert.equal(labels.age_years, 49);
assert.equal(labels.zodiac_en, "Snake");
assert.equal(labels.sun_sign_en, "Taurus");

console.log("birth-identity tests passed");
