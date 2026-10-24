/**
 * POJU language detection + website-lock + switch-command classification.
 *
 * Tests are matrix-style (templates × languages), not a copy of one-off bug reports.
 *
 *   pnpm exec tsx scripts/test-poju-language-detect.ts
 */
import {
  classifyLanguageSwitchRequest,
  detectAppLocaleFromText,
  detectLanguage,
  getPojuChatLanguageDirective,
  type AppLocale,
} from "@/lib/prompts/language-directive";

const failures: string[] = [];

function assert(name: string, ok: boolean): void {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}`);
  if (!ok) failures.push(name);
}

function expectSupported(input: string, locale: AppLocale): void {
  const r = classifyLanguageSwitchRequest(input);
  assert(
    `supported ${JSON.stringify(input)} → ${locale}`,
    r.kind === "supported" && r.locale === locale,
  );
}

function expectUnsupported(input: string): void {
  assert(
    `unsupported ${JSON.stringify(input)}`,
    classifyLanguageSwitchRequest(input).kind === "unsupported",
  );
}

function expectNone(input: string): void {
  assert(
    `none ${JSON.stringify(input)}`,
    classifyLanguageSwitchRequest(input).kind === "none",
  );
}

// ─── baseline detect / website lock ───────────────────────────────────────────

const englishWas = "I was terrified of losing money. What do you see?";
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
  "website lock English",
  pojuDir.outputLocale === "en" && pojuDir.directive.includes("WEBSITE LOCK"),
);
assert(
  "ZH user text on EN site still EN",
  getPojuChatLanguageDirective({
    locale: "en",
    userInput: "我和合伙人闹翻了怎么办，已经冷战三个月了",
    forcedOutputLocale: "en",
  }).outputLocale === "en",
);
assert("German orthography → en (content)", detectLanguage("Ich bin sehr müde und danke.") === "en");
assert('ambiguous "was" → en', detectLanguage("What was that?") === "en");

// ─── Product-4 switch commands: templates × locales ───────────────────────────
// Goal: every product locale accepts the same command families (ZH/EN/ES/FR surface forms).

type Named = { label: string; locale: AppLocale };

const productLangZh: Named[] = [
  { label: "中文", locale: "zh" },
  { label: "简体中文", locale: "zh" },
  { label: "英文", locale: "en" },
  { label: "英语", locale: "en" },
  { label: "西班牙语", locale: "es" },
  { label: "西语", locale: "es" },
  { label: "法语", locale: "fr" },
  { label: "法文", locale: "fr" },
];

const zhCommandTemplates = [
  (lang: string) => `请用${lang}回复我`,
  (lang: string) => `用${lang}回答`,
  (lang: string) => `用${lang}输出`,
  (lang: string) => `用${lang}说`,
  (lang: string) => `用${lang}写`,
  (lang: string) => `换成${lang}`,
  (lang: string) => `改成${lang}`,
  (lang: string) => `切换到${lang}`,
  (lang: string) => `改用${lang}`,
  (lang: string) => `以后用${lang}聊`,
  (lang: string) => `回复用${lang}`,
  (lang: string) => `回答成${lang}`,
];

console.log("\n=== switch · Chinese surface × product langs ===\n");
for (const { label, locale } of productLangZh) {
  for (const tmpl of zhCommandTemplates) {
    expectSupported(tmpl(label), locale);
  }
}

const productLangEn: Named[] = [
  { label: "Chinese", locale: "zh" },
  { label: "Mandarin", locale: "zh" },
  { label: "Simplified Chinese", locale: "zh" },
  { label: "English", locale: "en" },
  { label: "Spanish", locale: "es" },
  { label: "French", locale: "fr" },
];

const enCommandTemplates = [
  (lang: string) => `please reply in ${lang}`,
  (lang: string) => `please respond in ${lang}`,
  (lang: string) => `please answer in ${lang}`,
  (lang: string) => `reply in ${lang}`,
  (lang: string) => `respond in ${lang}`,
  (lang: string) => `answer in ${lang}`,
  (lang: string) => `speak in ${lang}`,
  (lang: string) => `write in ${lang}`,
  (lang: string) => `talk in ${lang}`,
  (lang: string) => `output in ${lang}`,
  (lang: string) => `can you reply in ${lang}`,
  (lang: string) => `could you please answer in ${lang}`,
  (lang: string) => `I want you to reply in ${lang}`,
  (lang: string) => `switch to ${lang}`,
  (lang: string) => `change to ${lang}`,
  (lang: string) => `use ${lang}`,
  (lang: string) => `in ${lang} please`,
  (lang: string) => `prefer ${lang}`,
];

console.log("\n=== switch · English surface × product langs ===\n");
for (const { label, locale } of productLangEn) {
  for (const tmpl of enCommandTemplates) {
    expectSupported(tmpl(label), locale);
  }
}

const productLangEs: Named[] = [
  { label: "español", locale: "es" },
  { label: "inglés", locale: "en" },
  { label: "chino", locale: "zh" },
  { label: "francés", locale: "fr" },
];

const esCommandTemplates = [
  (lang: string) => `responde en ${lang}`,
  (lang: string) => `contesta en ${lang}`,
  (lang: string) => `habla en ${lang}`,
  (lang: string) => `escribe en ${lang}`,
  (lang: string) => `por favor responde en ${lang}`,
  (lang: string) => `puedes responder en ${lang}`,
  (lang: string) => `cambia a ${lang}`,
  (lang: string) => `usa el ${lang}`,
  (lang: string) => `en ${lang} por favor`,
  (lang: string) => `prefiero ${lang}`,
];

console.log("\n=== switch · Spanish surface × product langs ===\n");
for (const { label, locale } of productLangEs) {
  for (const tmpl of esCommandTemplates) {
    expectSupported(tmpl(label), locale);
  }
}

const productLangFr: Named[] = [
  { label: "français", locale: "fr" },
  { label: "anglais", locale: "en" },
  { label: "chinois", locale: "zh" },
  { label: "espagnol", locale: "es" },
];

const frCommandTemplates = [
  (lang: string) => `réponds en ${lang}`,
  (lang: string) => `parle en ${lang}`,
  (lang: string) => `écris en ${lang}`,
  (lang: string) => `peux-tu répondre en ${lang}`,
  (lang: string) => `passe en ${lang}`,
  (lang: string) => `bascule en ${lang}`,
  (lang: string) => `utilise le ${lang}`,
  (lang: string) => `en ${lang} s'il te plaît`,
  (lang: string) => `en ${lang} s'il vous plaît`,
  (lang: string) => `je préfère ${lang}`,
];

console.log("\n=== switch · French surface × product langs ===\n");
for (const { label, locale } of productLangFr) {
  for (const tmpl of frCommandTemplates) {
    expectSupported(tmpl(label), locale);
  }
}

// ─── Out-of-range: same command families → unsupported (not model, not none) ─

const outOfRangeZh = [
  "日语",
  "日文",
  "韩语",
  "德语",
  "葡萄牙语",
  "意大利语",
  "俄语",
  "阿拉伯语",
  "荷兰语",
  "泰语",
  "越南语",
];

const outOfRangeEn = [
  "Japanese",
  "Korean",
  "German",
  "Portuguese",
  "Italian",
  "Russian",
  "Arabic",
  "Dutch",
  "Thai",
  "Vietnamese",
  "Hindi",
  "Turkish",
  "Polish",
];

/** Representative command shells — not every template × every lang (combinatorial blast). */
const outZhShells = [
  (lang: string) => `请用${lang}回复我`,
  (lang: string) => `用${lang}回答`,
  (lang: string) => `用${lang}输出`,
  (lang: string) => `换成${lang}`,
  (lang: string) => `切换到${lang}`,
];

const outEnShells = [
  (lang: string) => `please reply in ${lang}`,
  (lang: string) => `please respond in ${lang}`,
  (lang: string) => `speak in ${lang}`,
  (lang: string) => `switch to ${lang}`,
  (lang: string) => `can you reply in ${lang}`,
];

console.log("\n=== unsupported · out-of-range × command shells ===\n");
for (const lang of outOfRangeZh) {
  for (const shell of outZhShells) expectUnsupported(shell(lang));
}
for (const lang of outOfRangeEn) {
  for (const shell of outEnShells) expectUnsupported(shell(lang));
}
// ES / FR surfaces asking for out-of-range
for (const lang of ["japonés", "alemán", "coreano", "portugués"]) {
  expectUnsupported(`responde en ${lang}`);
  expectUnsupported(`cambia a ${lang}`);
}
for (const lang of ["japonais", "allemand", "coréen", "néerlandais"]) {
  expectUnsupported(`réponds en ${lang}`);
  expectUnsupported(`passe en ${lang}`);
}

// ─── Not a switch command → none (model handles) ─────────────────────────────
// Capability / curiosity / normal dialogue — must not trip switchPatterns.

console.log("\n=== none · capability & normal dialogue ===\n");

const capabilityNone = [
  // ZH — ability / knowledge questions
  "你会说德语吗",
  "你会说日语吗？",
  "你能说韩语吗",
  "你会不会法语",
  "懂日语吗",
  "你懂德语吗",
  "日语你会吗",
  "你支持日语吗",
  // EN
  "Do you speak Japanese?",
  "Can you speak German?",
  "Are you fluent in Korean?",
  "Do you know Arabic?",
  "What languages do you support?",
  "Which languages can you use?",
  // ES
  "¿Hablas alemán?",
  "¿Sabes japonés?",
  "¿Puedes hablar coreano?",
  // FR
  "Parles-tu allemand ?",
  "Sais-tu parler japonais ?",
  "Tu parles coréen ?",
  // Normal product dialogue (must never look like a switch)
  "how is my career?",
  "我和合伙人闹翻了怎么办",
  "Estoy atrapado en mi trabajo",
  "Je me sens bloqué dans ma carrière",
  "I was stuck for three years",
];

for (const s of capabilityNone) expectNone(s);

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll POJU language-detect checks passed.\n");
