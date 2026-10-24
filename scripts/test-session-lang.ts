/**
 * Session language — output ≡ website UI locale (single SSOT).
 * Run: pnpm exec tsx scripts/test-session-lang.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  detectSessionLangFromSample,
  findFirstSubstantiveUserLocale,
  isSubstantiveLanguageSample,
  nextLockedOutputLocale,
  resolvePivotSessionLang,
  SESSION_LANG_MIN_CJK,
  SESSION_LANG_MIN_LATIN_WORDS,
} from "../lib/poju/session-lang";
import {
  classifyLanguageSwitchRequest,
  resolvePojuSessionOutputLocale,
} from "../lib/prompts/language-directive";

assert.equal(isSubstantiveLanguageSample("短"), false);
assert.equal(
  isSubstantiveLanguageSample("我已经很多年没有收入了事业什么时候"),
  true,
);
assert.equal(detectSessionLangFromSample("我已经很多年没有收入了事业什么时候"), "zh");

const enLong = Array.from({ length: SESSION_LANG_MIN_LATIN_WORDS }, (_, i) => `word${i}`).join(" ");
assert.equal(isSubstantiveLanguageSample("hi there"), false);
assert.equal(isSubstantiveLanguageSample(enLong), true);
assert.equal(detectSessionLangFromSample(enLong), "en");

// Website lock: ZH user text on EN site still resolves to EN
const locked = nextLockedOutputLocale({
  locked: null,
  userInput: "我已经很多年没有收入了，事业方面什么时候能好起来？",
  uiLocale: "en",
});
assert.equal(locked.outputLocale, "en");
assert.equal(locked.nextLocked, "en");

const stay = nextLockedOutputLocale({
  locked: "zh",
  userInput: enLong,
  uiLocale: "en",
});
assert.equal(stay.outputLocale, "en");
assert.equal(stay.nextLocked, "en");

// Explicit in-range switch is a *client* website switch; resolver still follows uiLocale
const switched = nextLockedOutputLocale({
  locked: "zh",
  userInput: "please reply in English from now on",
  uiLocale: "en",
});
assert.equal(switched.outputLocale, "en");
assert.equal(switched.nextLocked, "en");

assert.equal(
  resolvePojuSessionOutputLocale({
    locked: "zh",
    uiLocale: "en",
    userInput: enLong,
  }),
  "en",
);

assert.equal(
  resolvePivotSessionLang(
    {
      locked_output_locale: "zh",
      messages: [],
      original_question: "New session",
    },
    "en",
  ),
  "en",
);

assert.equal(
  resolvePivotSessionLang(
    {
      locked_output_locale: undefined,
      messages: [
        {
          role: "user",
          content: "我已经很多年没有收入了，事业方面什么时候能好起来？",
          timestamp: "2026-01-01T00:00:00.000Z",
        },
      ],
      original_question: "New session",
    },
    "en",
  ),
  "en",
);

assert.equal(
  classifyLanguageSwitchRequest("please reply in Spanish").kind,
  "supported",
);
assert.equal(
  (classifyLanguageSwitchRequest("please reply in Spanish") as { locale: string }).locale,
  "es",
);
assert.equal(
  classifyLanguageSwitchRequest("请用日语回复我").kind,
  "unsupported",
);
assert.equal(
  classifyLanguageSwitchRequest("please respond in Japanese").kind,
  "unsupported",
);
assert.equal(classifyLanguageSwitchRequest("how is my career?").kind, "none");

assert.equal(
  findFirstSubstantiveUserLocale([
    { role: "user", content: "对", timestamp: "t0" },
    {
      role: "user",
      content: "我已经很多年没有收入了，事业方面什么时候能好起来？",
      timestamp: "t1",
    },
  ]),
  "zh",
);

const uiOnly = nextLockedOutputLocale({
  locked: null,
  userInput: "对",
  uiLocale: "fr",
  messages: [],
});
assert.equal(uiOnly.outputLocale, "fr");
assert.equal(uiOnly.nextLocked, "fr");

assert.ok(SESSION_LANG_MIN_CJK >= 10);
assert.ok(SESSION_LANG_MIN_LATIN_WORDS >= 10);

console.log("test-session-lang: all passed");

const root = process.cwd();
for (const rel of [
  "lib/poju/phases/segment2/control.ts",
  "lib/poju/phases/delivery/control.ts",
  "app/api/poju/chat/route.ts",
]) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  if (!src.includes("resolvePivotSessionLang")) {
    throw new Error(`${rel} must call resolvePivotSessionLang`);
  }
}
console.log("test-session-lang: segment2/delivery/chat resolve guard passed");
