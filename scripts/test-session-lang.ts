/**
 * Session language lock — substantive first sample + SSOT resolution.
 * Run: pnpm exec tsx scripts/test-session-lang.ts
 */
import assert from "node:assert/strict";
import {
  detectSessionLangFromSample,
  isSubstantiveLanguageSample,
  nextLockedOutputLocale,
  resolvePivotSessionLang,
  SESSION_LANG_MIN_CJK,
  SESSION_LANG_MIN_LATIN_WORDS,
} from "../lib/poju/session-lang";
import { resolvePojuSessionOutputLocale } from "../lib/prompts/language-directive";

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

const locked = nextLockedOutputLocale({
  locked: null,
  userInput: "我已经很多年没有收入了，事业方面什么时候能好起来？",
  uiLocale: "en",
});
assert.equal(locked.outputLocale, "zh");
assert.equal(locked.nextLocked, "zh");

const stay = nextLockedOutputLocale({
  locked: "zh",
  userInput: enLong,
  uiLocale: "en",
});
assert.equal(stay.outputLocale, "zh");
assert.equal(stay.nextLocked, "zh");

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
  "zh",
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
  "zh",
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
  "zh",
);

assert.ok(SESSION_LANG_MIN_CJK >= 10);
assert.ok(SESSION_LANG_MIN_LATIN_WORDS >= 10);

console.log("test-session-lang: all passed");
