/** 与 `i18n/routing.ts` 的 locales 保持一致 */
export type AppLocale = "en" | "es" | "zh" | "fr" | "de";

export function parseAppLocale(v: unknown): AppLocale {
  if (v === "en" || v === "es" || v === "zh" || v === "fr" || v === "de")
    return v;
  return "en";
}

export interface LanguageDirectiveInput {
  locale: AppLocale;
  /** POJU / Glyph 有；Syncro 不传 */
  userInput?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

export interface LanguageDirectiveOutput {
  outputLanguage: string;
  directive: string;
}

const localeNames: Record<AppLocale, string> = {
  en: "English",
  es: "Mexican Spanish (es-MX) — warm and contemporary",
  zh: "Simplified Chinese (zh-CN) — preserve poetic depth",
  fr: "French — eloquent, slightly philosophical",
  de: "German — precise but warm",
};

const switchPatterns: RegExp[] = [
  /please respond in (\w+)/i,
  /answer in (\w+)/i,
  /reply in (\w+)/i,
  /用(中文|英文|西班牙语|法语|德语)(?:回复|回答)/,
  /改用(中文|英文|西班牙语|法语|德语)/,
  /switch to (\w+)/i,
  /(?:^|\s)(?:in|en|auf)\s+(Spanish|Chinese|French|German|English|español|chino|francés|alemán|inglés)(?:\s|$|[,.!?])/i,
];

/**
 * 3 级语言判断 + 生成追加到 System Prompt 末尾的指令（不替换英文主体 Prompt）
 */
export function getLanguageDirective(
  input: LanguageDirectiveInput,
): LanguageDirectiveOutput {
  const allMessages = [
    ...(input.conversationHistory ?? []),
    ...(input.userInput
      ? [{ role: "user" as const, content: input.userInput }]
      : []),
  ];

  const userMessages = allMessages
    .filter((m) => m.role === "user" || m.role === "User")
    .reverse();

  for (const msg of userMessages) {
    for (const pattern of switchPatterns) {
      const match = msg.content.match(pattern);
      if (match?.[1]) {
        const detectedLang = mapToLocale(match[1]);
        if (detectedLang) {
          const name = localeNames[detectedLang];
          return {
            outputLanguage: name,
            directive: buildDirective(name, "priority_3"),
          };
        }
      }
    }
  }

  if (input.userInput && input.userInput.length >= 5) {
    const detectedLocale = detectLanguage(input.userInput);
    if (detectedLocale && detectedLocale !== input.locale) {
      const uiName = localeNames[input.locale];
      const inputLangName = localeNames[detectedLocale];
      return {
        outputLanguage: uiName,
        directive: buildDirective(
          uiName,
          "priority_1_with_input_note",
          inputLangName,
        ),
      };
    }
  }

  const name = localeNames[input.locale];
  return {
    outputLanguage: name,
    directive: buildDirective(name, "priority_1"),
  };
}

function mapToLocale(text: string): AppLocale | null {
  const raw = text.trim();
  const t = raw.toLowerCase();

  const zhTokens: Record<string, AppLocale> = {
    中文: "zh",
    英文: "en",
    西班牙语: "es",
    法语: "fr",
    德语: "de",
  };
  if (raw in zhTokens) return zhTokens[raw as keyof typeof zhTokens];

  const map: Record<string, AppLocale> = {
    english: "en",
    inglés: "en",
    en: "en",
    spanish: "es",
    español: "es",
    es: "es",
    mexican: "es",
    chinese: "zh",
    mandarin: "zh",
    zh: "zh",
    french: "fr",
    français: "fr",
    francés: "fr",
    fr: "fr",
    german: "de",
    deutsch: "de",
    alemán: "de",
    de: "de",
  };

  return map[t] ?? null;
}

function detectLanguage(text: string): AppLocale | null {
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";
  const lower = text.toLowerCase();
  if (/\b(hola|cómo|qué|por|para|hacer|sí|gracias)\b/.test(lower)) return "es";
  if (/\b(bonjour|comment|pour|faire|merci|oui|est-ce)\b/.test(lower))
    return "fr";
  if (/\b(hallo|wie|was|bitte|danke|ja|nein|machen)\b/.test(lower))
    return "de";
  return "en";
}

function buildDirective(
  language: string,
  priorityType: "priority_1" | "priority_1_with_input_note" | "priority_3",
  userInputLanguageName?: string,
): string {
  let priorityNote = "";

  if (priorityType === "priority_3") {
    priorityNote = `
The user has explicitly requested a response in this language.
Honor this request immediately.`;
  } else if (
    priorityType === "priority_1_with_input_note" &&
    userInputLanguageName
  ) {
    priorityNote = `
Note: The user wrote their question in ${userInputLanguageName},
but they have selected ${language} as their interface language.
Respond in ${language}, but understand their question in
${userInputLanguageName}.`;
  } else {
    priorityNote = `
This is the user's selected interface language.`;
  }

  return `

# OUTPUT LANGUAGE INSTRUCTION

Respond entirely in ${language}.
${priorityNote}

CRITICAL — Do NOT translate these brand names; keep them in English:
- POJU
- Glyph
- Syncro
- Divine Tailwind
- Fair Sky
- Still Water
- Crosswind
- Eye of Storm

When using these names mid-sentence, integrate them naturally
into the target language's grammar. Examples:

  Spanish:  "El patrón de Divine Tailwind sugiere..."
  Chinese:  "Divine Tailwind 这个图案暗示..."
  French:   "Le motif Divine Tailwind suggère..."
  German:   "Das Muster von Divine Tailwind deutet darauf hin..."

Maintain the brand voice across all languages:
- Warm but not effusive
- Direct but not harsh
- Wise but not preachy
- Poetic but not flowery

The user may have written in any language. Understand them in
their language. Respond in the language specified above.
`;
}
