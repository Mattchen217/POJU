/**
 * POJU language detection + website-lock directive regression.
 *
 *   pnpm exec tsx scripts/test-poju-language-detect.ts
 */
import {
  classifyLanguageSwitchRequest,
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
  'getPojuChatLanguageDirective: English output for website en',
  pojuDir.outputLanguage.includes("English") && pojuDir.outputLocale === "en",
);
assert(
  "directive contains website lock",
  pojuDir.directive.includes("WEBSITE LOCK") && pojuDir.directive.includes("English"),
);

// ZH user text must NOT override EN website language
const zhOnEn = getPojuChatLanguageDirective({
  locale: "en",
  userInput: "我和合伙人闹翻了怎么办，已经冷战三个月了",
  conversationHistory: [],
  forcedOutputLocale: "en",
});
assert(
  "ZH message on EN website → still English output",
  zhOnEn.outputLocale === "en" && zhOnEn.directive.includes("English"),
);

assert("German with diacritics → en (content detect)", detectLanguage("Ich bin sehr müde und danke.") === "en");
assert(
  "German without diacritics (≥2 hits) → en (content detect)",
  detectLanguage("Hallo bitte danke") === "en",
);
assert(
  'single ambiguous "was" alone → en',
  detectLanguage("What was that?") === "en",
);

assert(
  "classify: reply in Spanish → supported es",
  classifyLanguageSwitchRequest("please reply in Spanish").kind === "supported" &&
    (classifyLanguageSwitchRequest("please reply in Spanish") as { locale: string }).locale === "es",
);
assert(
  "classify: 用日语回复 → unsupported",
  classifyLanguageSwitchRequest("请用日语回复我").kind === "unsupported",
);
assert(
  "classify: reply in Japanese → unsupported",
  classifyLanguageSwitchRequest("please respond in Japanese").kind === "unsupported",
);
assert(
  "classify: reply in German → unsupported (not a product locale)",
  classifyLanguageSwitchRequest("please reply in German").kind === "unsupported",
);

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll POJU language-detect checks passed.\n");
