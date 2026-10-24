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

function expectSupported(input: string, locale: string): void {
  const r = classifyLanguageSwitchRequest(input);
  assert(
    `classify supported: ${JSON.stringify(input)} → ${locale}`,
    r.kind === "supported" && r.kind === "supported" && r.locale === locale,
  );
}

function expectUnsupported(input: string): void {
  assert(
    `classify unsupported: ${JSON.stringify(input)}`,
    classifyLanguageSwitchRequest(input).kind === "unsupported",
  );
}

function expectNone(input: string): void {
  assert(
    `classify none: ${JSON.stringify(input)}`,
    classifyLanguageSwitchRequest(input).kind === "none",
  );
}

// —— Product 4: zh ——
expectSupported("请用中文回复我", "zh");
expectSupported("用中文回答", "zh");
expectSupported("用中文输出", "zh");
expectSupported("换成中文", "zh");
expectSupported("请用简体中文说", "zh");
expectSupported("reply in Chinese", "zh");
expectSupported("please write in Mandarin", "zh");
expectSupported("in Chinese please", "zh");

// —— Product 4: en ——
expectSupported("请用英文回复", "en");
expectSupported("用英语回答我", "en");
expectSupported("改用英文输出", "en");
expectSupported("please reply in English", "en");
expectSupported("speak in English", "en");
expectSupported("switch to English", "en");
expectSupported("responde en inglés", "en");
expectSupported("réponds en anglais", "en");

// —— Product 4: es ——
expectSupported("请用西班牙语回复", "es");
expectSupported("用西语回答", "es");
expectSupported("please reply in Spanish", "es");
expectSupported("responde en español", "es");
expectSupported("contesta en español por favor", "es");
expectSupported("cambia a español", "es");
expectSupported("en español por favor", "es");

// —— Product 4: fr ——
expectSupported("请用法语回复我", "fr");
expectSupported("用法文输出", "fr");
expectSupported("please answer in French", "fr");
expectSupported("réponds en français", "fr");
expectSupported("parle en français", "fr");
expectSupported("en français s'il te plaît", "fr");

// —— Out of range ——
expectUnsupported("请用日语回复我");
expectUnsupported("please respond in Japanese");
expectUnsupported("please reply in German");
expectUnsupported("用韩语回答");

// —— Not a switch command (model handles) ——
expectNone("你会说德语吗");
expectNone("how is my career?");
expectNone("Do you speak Japanese?");

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll POJU language-detect checks passed.\n");
