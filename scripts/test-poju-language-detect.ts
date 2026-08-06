/**
 * POJU language detection regression — English "was" must not drift to German.
 *
 *   pnpm exec tsx scripts/test-poju-language-detect.ts
 */
import {
  detectAppLocaleFromText,
  detectLanguage,
  getPojuChatLanguageDirective,
} from "@/lib/prompts/language-directive";

const failures: string[] = [];

function assert(name: string, ok: boolean): void {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}`);
  if (!ok) failures.push(name);
}

const englishWas =
  "I was terrified of losing money. What do you see?";

assert('detectLanguage: "I was terrified…" → en', detectLanguage(englishWas) === "en");
assert(
  'detectAppLocaleFromText: "I was terrified…" → en',
  detectAppLocaleFromText(englishWas) === "en",
);

const pojuDir = getPojuChatLanguageDirective({
  locale: "en",
  userInput: englishWas,
  conversationHistory: [],
});
assert(
  'getPojuChatLanguageDirective: English output for "I was…"',
  pojuDir.outputLanguage.includes("English"),
);
assert(
  "directive contains ONLY-in-English lock",
  pojuDir.directive.includes("Respond **ONLY**") && pojuDir.directive.includes("English"),
);

assert("German with diacritics → en (locale removed)", detectLanguage("Ich bin sehr müde und danke.") === "en");
assert(
  "German without diacritics (≥2 hits) → en (locale removed)",
  detectLanguage("Hallo bitte danke") === "en",
);
assert(
  'single ambiguous "was" alone → en',
  detectLanguage("What was that?") === "en",
);

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll POJU language-detect checks passed.\n");
