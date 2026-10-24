/** 与 `i18n/routing.ts` 的 locales 保持一致 */
export type AppLocale = "en" | "es" | "zh" | "fr";

export function parseAppLocale(v: unknown): AppLocale {
  if (v === "en" || v === "es" || v === "zh" || v === "fr") return v;
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
};

/** Product locales (same set as `i18n/routing.ts`). Expanding locales later still uses this path. */
export const PRODUCT_LOCALES: readonly AppLocale[] = ["en", "es", "zh", "fr"] as const;

/** Chinese language names — product 4 + common out-of-range (→ unsupported notice). */
const ZH_LANG_TOKEN =
  "中文|简体中文|繁体中文|汉语|普通话|国语|英文|英语|英式英语|美式英语|西班牙语|西语|西班牙文|法语|法文|法式|日语|日文|日本語|韩语|韩文|한국어|德语|德文|葡萄牙语|意大利语|俄语|阿拉伯语";

/** Chinese imperative verbs after 用/改用/换成… */
const ZH_SWITCH_VERB = "回复|回答|输出|交流|对话|说|讲|聊|写";

/**
 * Latin language-name capture (1–3 words). Includes product locales + common
 * unsupported names so "reply in Japanese" still classifies as unsupported.
 */
const LAT_LANG =
  "simplified\\s+chinese|traditional\\s+chinese|mexican\\s+spanish|mandarin|chinese|english|spanish|french|francais|français|espanol|español|espagnol|ingles|inglés|anglais|chino|chinois|chino\\s+mandarin|japanese|korean|german|deutsch|portuguese|italian|russian|arabic|japones|japonés|aleman|alemán|coreano|portugues|português|italiano|ruso|arabe|árabe";

/**
 * Explicit "switch / reply in X" commands only — not "can you speak German?".
 * Product 4: en / es / fr / zh. Matched token → mapToLocale; unknown → unsupported.
 */
const switchPatterns: RegExp[] = [
  // —— English ——
  new RegExp(
    `please\\s+(?:respond|reply|answer|speak|write|talk|output|chat)\\s+in\\s+(${LAT_LANG})`,
    "i",
  ),
  new RegExp(
    `(?:respond|reply|answer|speak|write|talk|output|chat)\\s+in\\s+(${LAT_LANG})(?:\\s+please)?`,
    "i",
  ),
  new RegExp(`(?:use|using)\\s+(${LAT_LANG})(?:\\s+(?:please|from\\s+now\\s+on))?`, "i"),
  new RegExp(`switch\\s+(?:to|into)\\s+(${LAT_LANG})`, "i"),
  new RegExp(`change\\s+(?:to|into|over\\s+to)\\s+(${LAT_LANG})`, "i"),
  new RegExp(`(?:from\\s+now\\s+on[,]?\\s+)?in\\s+(${LAT_LANG})\\s+please`, "i"),

  // —— Chinese ——
  // Require 用/改用/换成… before the language name — avoids「你会说德语吗」false hits.
  new RegExp(
    `请?(?:用|改用|换成|改成|切换到|切到)(${ZH_LANG_TOKEN})(?:${ZH_SWITCH_VERB})?(?:我|吧|啊|哦)?`,
  ),
  new RegExp(`请?(?:用|改用)(${ZH_LANG_TOKEN})(?:来)?(?:${ZH_SWITCH_VERB})`),
  new RegExp(`(?:回复|回答|输出)(?:用|成)(${ZH_LANG_TOKEN})`),
  new RegExp(`改用(${ZH_LANG_TOKEN})`),

  // —— Spanish ——
  new RegExp(
    `(?:por\\s+favor[,]?\\s+)?(?:responde|contesta|habla|escribe|responde me|contéstame|contestame)\\s+en\\s+(${LAT_LANG})`,
    "i",
  ),
  new RegExp(
    `(?:responde|contesta|habla|escribe|responder|contestar)\\s+en\\s+(${LAT_LANG})(?:\\s+por\\s+favor)?`,
    "i",
  ),
  new RegExp(`(?:cambia|cambiar|pásate|pasate)\\s+a\\s+(${LAT_LANG})`, "i"),
  new RegExp(`(?:usa|utiliza)\\s+(?:el\\s+)?(${LAT_LANG})`, "i"),
  new RegExp(`en\\s+(${LAT_LANG})\\s+por\\s+favor`, "i"),

  // —— French ——
  new RegExp(
    `(?:s['']il\\s+(?:te|vous)\\s+pla[iî]t[,]?\\s+)?(?:réponds|reponds|répondre|parle|écris|ecris|écrivez|ecrivez)\\s+en\\s+(${LAT_LANG})`,
    "i",
  ),
  new RegExp(
    `(?:réponds|reponds|répondre|parle|écris|ecris)\\s+en\\s+(${LAT_LANG})(?:\\s+s['']il\\s+(?:te|vous)\\s+pla[iî]t)?`,
    "i",
  ),
  new RegExp(`(?:passe|passer|bascule|basculer)\\s+en\\s+(${LAT_LANG})`, "i"),
  new RegExp(`(?:utilise|utiliser)\\s+(?:le\\s+)?(${LAT_LANG})`, "i"),
  new RegExp(`en\\s+(${LAT_LANG})\\s+s['']il\\s+(?:te|vous)\\s+pla[iî]t`, "i"),
];

export type LanguageSwitchRequest =
  | { kind: "none" }
  | { kind: "supported"; locale: AppLocale }
  | { kind: "unsupported"; requestedLabel: string };

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
  // German (unsupported locale) → treat as English for product output
  if (/[äöüß]/i.test(text)) return "en";

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

  // German detected → English (locale removed from product)
  if (countDistinctWordHits(text, deWords) >= 2) return "en";
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

/** Strip accents / collapse spaces for locale token matching. */
function normalizeLangToken(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
}

function mapToLocale(text: string): AppLocale | null {
  const raw = text.trim();
  const t = normalizeLangToken(raw);

  const zhTokens: Record<string, AppLocale> = {
    中文: "zh",
    简体中文: "zh",
    繁体中文: "zh",
    汉语: "zh",
    普通话: "zh",
    国语: "zh",
    英文: "en",
    英语: "en",
    英式英语: "en",
    美式英语: "en",
    西班牙语: "es",
    西语: "es",
    西班牙文: "es",
    法语: "fr",
    法文: "fr",
    法式: "fr",
  };
  if (raw in zhTokens) return zhTokens[raw as keyof typeof zhTokens];

  const map: Record<string, AppLocale> = {
    english: "en",
    ingles: "en",
    anglais: "en",
    en: "en",
    spanish: "es",
    espanol: "es",
    espagnol: "es",
    es: "es",
    mexican: "es",
    "mexican spanish": "es",
    chinese: "zh",
    mandarin: "zh",
    "simplified chinese": "zh",
    "traditional chinese": "zh",
    "chino mandarin": "zh",
    chino: "zh",
    chinois: "zh",
    zh: "zh",
    french: "fr",
    francais: "fr",
    frances: "fr",
    fr: "fr",
  };

  return map[t] ?? null;
}

/**
 * Classify an explicit "reply in X" request.
 * - supported → product locale (client should switch website language first)
 * - unsupported → outside product set (show notice; keep current website language)
 */
export function classifyLanguageSwitchRequest(
  userInput?: string,
): LanguageSwitchRequest {
  if (!userInput?.trim()) return { kind: "none" };
  for (const pattern of switchPatterns) {
    const match = userInput.match(pattern);
    if (match?.[1]) {
      const mapped = mapToLocale(match[1]);
      if (mapped) return { kind: "supported", locale: mapped };
      return { kind: "unsupported", requestedLabel: match[1].trim() };
    }
  }
  return { kind: "none" };
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

/** Explicit in-message switch to a **product** locale (e.g. "please respond in Chinese"). */
export function detectExplicitLanguageSwitch(userInput?: string): AppLocale | null {
  const classified = classifyLanguageSwitchRequest(userInput);
  return classified.kind === "supported" ? classified.locale : null;
}

/**
 * Pivot output locale ≡ website UI locale.
 * Supported "reply in X" is handled by auto-switching the website language first;
 * this resolver never follows message language or a divergent session lock.
 */
export function resolvePojuSessionOutputLocale(input: {
  locked?: AppLocale;
  uiLocale: AppLocale;
  userInput?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}): AppLocale {
  void input.locked;
  void input.userInput;
  void input.conversationHistory;
  return input.uiLocale;
}

/**
 * Pivot chat: output language ≡ website language only (Strict Language Constraint).
 * Context may be ZH/EN/mixed; never mirror it. Expanding product locales later still uses this path.
 */
export function getPojuChatLanguageDirective(
  input: LanguageDirectiveInput,
): LanguageDirectiveOutput {
  const outputLocale = input.forcedOutputLocale ?? input.locale;
  const language = localeNames[outputLocale];
  return {
    outputLanguage: language,
    outputLocale,
    directive: `
# Pivot OUTPUT LANGUAGE — WEBSITE LOCK (absolute)

The website language is **${language}** (${outputLocale}).
Output language ≡ website language. There is no second language track.

STRICT RULES (override every other cue):
- Write **every** user-visible field (\`response\`, \`options[]\`, narrative, summaries, CTA copy) **only** in **${language}**.
- Structured fields users will hear back (core_dilemma / desired_direction / agenda text) must also be in **${language}**.
- Context (system/task prompts, profile, base_analysis, 命盘, prior bubbles) may be Chinese, English, or mixed — **understand** them, **never mirror** them.
- Do **not** mix languages in one reply. Do **not** leave Chinese terms untranslated when the website language is not Chinese (brand names below are the only English exceptions).
- Do **not** switch output language because the user wrote in another language. Website language changes are handled by the product UI; you only follow the website language above.
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
