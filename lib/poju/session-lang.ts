/**
 * Pivot session language SSOT — output ≡ website UI locale.
 *
 * Product rule (stable for any future locale expansion):
 * 1. Model output always follows the current website language.
 * 2. In-range "reply in Spanish" → client auto-switches website locale, then hard-locks.
 * 3. Out-of-range "reply in Japanese" → notice only; do not switch; keep website language.
 *
 * `locked_output_locale` is kept in sync with the website locale for persistence /
 * diagnostics; it must never diverge from the UI locale as a second output track.
 */

import {
  classifyLanguageSwitchRequest,
  detectExplicitLanguageSwitch,
  detectLanguage,
  parseAppLocale,
  type AppLocale,
} from "@/lib/prompts/language-directive";
import type { POJUSessionState } from "@/lib/poju/types";

/** Min CJK characters to treat a sample as language-detectable (diagnostics / legacy). */
export const SESSION_LANG_MIN_CJK = 10;
/** Min whitespace-separated tokens for Latin-script samples (diagnostics / legacy). */
export const SESSION_LANG_MIN_LATIN_WORDS = 10;

const SYSTEMISH =
  /^(?:__OPENING__|\[SYSTEM:)/i;

export function isSubstantiveLanguageSample(text: string): boolean {
  const t = text.trim();
  if (!t || SYSTEMISH.test(t)) return false;
  const cjk = (t.match(/[\u4e00-\u9fff]/g) ?? []).length;
  if (cjk >= SESSION_LANG_MIN_CJK) return true;
  const words = t.split(/\s+/).filter(Boolean);
  return words.length >= SESSION_LANG_MIN_LATIN_WORDS;
}

/** Detect language only when the sample is long enough (diagnostics / legacy helpers). */
export function detectSessionLangFromSample(text: string): AppLocale | null {
  if (!isSubstantiveLanguageSample(text)) return null;
  return detectLanguage(text.trim());
}

type SessionLangSource = Pick<
  POJUSessionState,
  "locked_output_locale" | "messages" | "original_question"
>;

/** Chronological first substantive user sample — kept for tests / migration diagnostics. */
export function findFirstSubstantiveUserLocale(
  messages: SessionLangSource["messages"] | null | undefined,
): AppLocale | null {
  for (const m of messages ?? []) {
    if (!m || m.role !== "user" || m.is_rejected) continue;
    const hit = detectSessionLangFromSample(m.content);
    if (hit) return hit;
  }
  return null;
}

/**
 * Process language for Pivot chat / gates / delivery.
 * Always ≡ website UI locale (single SSOT).
 */
export function resolvePivotSessionLang(
  _session: SessionLangSource | null | undefined,
  uiLocale: string,
): AppLocale {
  return parseAppLocale(uiLocale);
}

/**
 * Resolve this turn's output locale and the value to persist as lock.
 * Always ≡ website UI locale. Supported "reply in X" is applied by switching
 * the website language first (client); by the time we run, uiLocale is already new.
 */
export function nextLockedOutputLocale(input: {
  locked?: AppLocale | null;
  userInput?: string;
  uiLocale: AppLocale;
  messages?: SessionLangSource["messages"] | null;
  original_question?: string | null;
}): { outputLocale: AppLocale; nextLocked: AppLocale } {
  void input.locked;
  void input.userInput;
  void input.messages;
  void input.original_question;
  return { outputLocale: input.uiLocale, nextLocked: input.uiLocale };
}

/** Re-export for callers that only need the supported-locale detector. */
export { detectExplicitLanguageSwitch, classifyLanguageSwitchRequest };
