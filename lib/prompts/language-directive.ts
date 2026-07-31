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
  /** Session-locked output locale — skip message re-detection when set (prefix-cache stability). */
  forcedOutputLocale?: AppLocale;
}

export interface LanguageDirectiveOutput {
  outputLanguage: string;
  outputLocale: AppLocale;
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

/** Escape literal for RegExp word-boundary match. */
function wb(word: string): RegExp {
  return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
}

/** Count how many distinct function words from `words` appear in text. */
function countDistinctWordHits(text: string, words: readonly string[]): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const w of words) {
    if (wb(w).test(lower)) hits++;
  }
  return hits;
}

/**
 * Detect primary locale from user text.
 * Conservative for Latin scripts: ambiguous English (e.g. "I was…", "fiancé", "résumé", "café")
 * must not map to de/es/fr — English reuses those accents as loanwords.
 */
export function detectLanguage(text: string): AppLocale {
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";

  // Orthography that almost never appears in English prose (not áéíóú / café / résumé).
  if (/[¿¡]/.test(text)) return "es";
  if (/[äöüß]/i.test(text)) return "de";

  // ≥2 independent function words (exclude EN false positives: was, ja, nein, wie, machen, por, para, comment, etc.)
  const deWords = [
    "hallo",
    "bitte",
    "danke",
    "nicht",
    "und",
    "der",
    "die",
    "das",
    "ist",
    "sind",
    "aber",
    "auch",
    "noch",
    "schon",
    "sehr",
    "ich",
    "wir",
    "sie",
    "haben",
    "werden",
    "können",
    "konnen",
    "müssen",
    "mussen",
  ] as const;
  const esWords = [
    "hola",
    "gracias",
    "porque",
    "también",
    "tambien",
    "estoy",
    "está",
    "esta",
    "pero",
    "muy",
    "bien",
    "ahora",
    "señor",
    "señora",
    "cómo",
    "como",
    "qué",
    "que",
  ] as const;
  const frWords = [
    "bonjour",
    "merci",
    "pourquoi",
    "très",
    "tres",
    "nous",
    "vous",
    "avec",
    "sans",
    "aussi",
    "être",
    "etre",
    "cette",
    "cela",
    "peut",
    "faire",
  ] as const;

  if (countDistinctWordHits(text, deWords) >= 2) return "de";
  if (countDistinctWordHits(text, esWords) >= 2) return "es";
  if (countDistinctWordHits(text, frWords) >= 2) return "fr";

  return "en";
}

/** Detect primary locale from free text (defaults to English when ambiguous). */
export function detectAppLocaleFromText(text: string): AppLocale {
  const trimmed = text.trim();
  if (trimmed.length < 2) return "en";
  return detectLanguage(trimmed);
}

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
            outputLocale: detectedLang,
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
        outputLocale: input.locale,
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
    outputLocale: input.locale,
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

/**
 * Syncro: matrix copy follows the **task question** language (Priority 2),
 * not the website UI locale when they differ.
 */
export function resolveSyncroOutputLocale(
  locale: AppLocale,
  taskDescription: string,
): AppLocale {
  const task = taskDescription.trim();
  if (!task) return locale;

  for (const pattern of switchPatterns) {
    const match = task.match(pattern);
    if (match?.[1]) {
      const mapped = mapToLocale(match[1]);
      if (mapped) return mapped;
    }
  }

  if (task.length >= 3) {
    return detectLanguage(task);
  }

  return locale;
}

export function getSyncroLanguageDirective(
  locale: AppLocale,
  taskDescription: string,
): LanguageDirectiveOutput {
  const outputLocale = resolveSyncroOutputLocale(locale, taskDescription);
  const language = localeNames[outputLocale];
  const taskPreview = taskDescription.trim().replace(/"/g, '\\"').slice(0, 400);

  return {
    outputLanguage: language,
    outputLocale,
    directive: `
# SYNCRO OUTPUT LANGUAGE (task-driven)

The user described what they plan to do in the next ~24 hours:
"${taskPreview}"

Write **every** user-visible string in this response in **${language}**:
- short_advice, detailed_advice, rationale for each matrix key

Match the **language of the task description** (e.g. English task → English advice; Chinese task → Chinese advice).
The website UI locale is ${localeNames[locale]} — use that only if the task has no clear language signal.

You may read 命主基础分析 JSON in whatever language it was stored; express insights for the user in **${language}**.
${buildDirective(language, "priority_1")}`,
  };
}

/**
 * POJU chat: reply language follows the user's messages, not the UI locale.
 * Bazi / matrix reports use UI locale separately.
 */
/** CJK (Chinese / Japanese kana / Korean hangul) in user text → zh output. */
const CJK_PATTERN =
  /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/;

function inferLocaleFromUserMessages(input: {
  userInput?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}): AppLocale | null {
  const texts: string[] = [];
  if (input.userInput?.trim() && input.userInput.trim() !== "__OPENING__") {
    texts.push(input.userInput.trim());
  }
  for (const msg of [...(input.conversationHistory ?? [])].reverse()) {
    if (msg.role !== "user" && msg.role !== "User") continue;
    const t = msg.content.trim();
    if (t && !texts.includes(t)) texts.push(t);
  }

  for (const text of texts) {
    if (CJK_PATTERN.test(text)) return "zh";
    for (const pattern of switchPatterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const mapped = mapToLocale(match[1]);
        if (mapped) return mapped;
      }
    }
    if (text.length >= 2) return detectLanguage(text);
  }
  return null;
}

/** Explicit in-message language switch (e.g. "please respond in Chinese"). */
export function detectExplicitLanguageSwitch(userInput?: string): AppLocale | null {
  if (!userInput?.trim()) return null;
  for (const pattern of switchPatterns) {
    const match = userInput.match(pattern);
    if (match?.[1]) {
      const mapped = mapToLocale(match[1]);
      if (mapped) return mapped;
    }
  }
  return null;
}

/**
 * Session output locale: explicit switch → latest user message language → locked → UI.
 * `locked` is set only when the user explicitly requests a language — not from UI locale.
 */
export function resolvePojuSessionOutputLocale(input: {
  locked?: AppLocale;
  uiLocale: AppLocale;
  userInput?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}): AppLocale {
  const explicitSwitch = detectExplicitLanguageSwitch(input.userInput);
  if (explicitSwitch) return explicitSwitch;

  const fromMessages = inferLocaleFromUserMessages({
    userInput: input.userInput,
    conversationHistory: input.conversationHistory,
  });
  if (fromMessages) return fromMessages;

  if (input.locked) return input.locked;
  return input.uiLocale;
}

export function getPojuChatLanguageDirective(
  input: LanguageDirectiveInput,
): LanguageDirectiveOutput {
  const uiLocale = input.locale;

  if (input.forcedOutputLocale) {
    const outputLocale = input.forcedOutputLocale;
    const language = localeNames[outputLocale];
    return {
      outputLanguage: language,
      outputLocale,
      directive: `
# Pivot OUTPUT LANGUAGE (message-driven · HARD LOCK)

Respond **ONLY** in **${language}**.
Ignore the language of these system/task instructions — they may be Chinese; your \`response\` must still be **${language}** only.

Write **every** user-visible sentence in this reply in **${language}**:
- Match the language of the user's question and recent messages (English question → English reply).
- The website UI locale is ${localeNames[uiLocale]} — use that only if the user has not written in a clear language yet.
- Never switch to German/French/Spanish unless the user's messages clearly use that language (not a single English word like "was").
- You may read stored profile / base-analysis JSON in any language; express insights for the user in **${language}**.
${buildDirective(language, "priority_1")}`,
    };
  }
  const userTexts = [
    ...(input.conversationHistory ?? [])
      .filter((m) => m.role === "user" || m.role === "User")
      .map((m) => m.content)
      .reverse(),
    ...(input.userInput && input.userInput !== "__OPENING__" ? [input.userInput] : []),
  ].filter((t) => t.trim().length > 0);

  let outputLocale: AppLocale = uiLocale;

  for (const text of userTexts) {
    for (const pattern of switchPatterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const mapped = mapToLocale(match[1]);
        if (mapped) {
          outputLocale = mapped;
          break;
        }
      }
    }
    if (outputLocale !== uiLocale) break;

    if (text.length >= 3) {
      outputLocale = detectLanguage(text);
      break;
    }
  }

  const language = localeNames[outputLocale];
  return {
    outputLanguage: language,
    outputLocale,
    directive: `
# Pivot OUTPUT LANGUAGE (message-driven · HARD LOCK)

Respond **ONLY** in **${language}**.
Ignore the language of these system/task instructions — they may be Chinese; your \`response\` must still be **${language}** only.

Write **every** user-visible sentence in this reply in **${language}**:
- Match the language of the user's question and recent messages (English question → English reply).
- The website UI locale is ${localeNames[uiLocale]} — use that only if the user has not written in a clear language yet.
- Never switch to German/French/Spanish unless the user's messages clearly use that language (not a single English word like "was").
- You may read stored profile / base-analysis JSON in any language; express insights for the user in **${language}**.
${buildDirective(language, "priority_1")}`,
  };
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
- Pivot
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
