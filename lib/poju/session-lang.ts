/**
 * Pivot session language SSOT (`locked_output_locale`).
 *
 * Website UI locale (nav / settings / marketing) stays independent.
 * Chat bubbles, understanding/delivery gate copy, delivery book, and
 * translate-on/off all read this lock once the first substantive user
 * message establishes it.
 */

import {
  detectExplicitLanguageSwitch,
  detectLanguage,
  parseAppLocale,
  type AppLocale,
} from "@/lib/prompts/language-directive";
import type { POJUSessionState } from "@/lib/poju/types";

/** Min CJK characters to lock session language from a Chinese-dominant sample. */
export const SESSION_LANG_MIN_CJK = 10;
/** Min whitespace-separated tokens to lock from a Latin-script sample. */
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

/** Detect language only when the sample is long enough to lock confidently. */
export function detectSessionLangFromSample(text: string): AppLocale | null {
  if (!isSubstantiveLanguageSample(text)) return null;
  return detectLanguage(text.trim());
}

type SessionLangSource = Pick<
  POJUSessionState,
  "locked_output_locale" | "messages" | "original_question"
>;

/**
 * Process language for Pivot chat / gates / delivery.
 * Prefer persisted lock; else scan substantive user turns; else UI locale.
 */
export function resolvePivotSessionLang(
  session: SessionLangSource | null | undefined,
  uiLocale: string,
): AppLocale {
  const ui = parseAppLocale(uiLocale);
  if (session?.locked_output_locale) {
    return parseAppLocale(session.locked_output_locale);
  }

  const msgs = session?.messages ?? [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (!m || m.role !== "user" || m.is_rejected) continue;
    const hit = detectSessionLangFromSample(m.content);
    if (hit) return hit;
  }

  const oq = session?.original_question?.trim();
  if (oq) {
    const hit = detectSessionLangFromSample(oq);
    if (hit) return hit;
  }

  return ui;
}

/**
 * Resolve this turn's output locale and the next value to persist as lock.
 * Priority: explicit switch → existing lock → first substantive sample → UI.
 */
export function nextLockedOutputLocale(input: {
  locked?: AppLocale | null;
  userInput?: string;
  uiLocale: AppLocale;
}): { outputLocale: AppLocale; nextLocked: AppLocale | undefined } {
  const explicit = detectExplicitLanguageSwitch(input.userInput);
  if (explicit) {
    return { outputLocale: explicit, nextLocked: explicit };
  }

  if (input.locked) {
    const locked = parseAppLocale(input.locked);
    return { outputLocale: locked, nextLocked: locked };
  }

  const detected = input.userInput
    ? detectSessionLangFromSample(input.userInput)
    : null;
  if (detected) {
    return { outputLocale: detected, nextLocked: detected };
  }

  return { outputLocale: input.uiLocale, nextLocked: undefined };
}
