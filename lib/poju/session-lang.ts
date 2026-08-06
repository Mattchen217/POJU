/**
 * Pivot session language SSOT (`locked_output_locale`).
 *
 * Website UI locale (nav / settings / marketing) stays independent.
 * Chat bubbles, understanding/delivery gate copy, delivery book, and
 * translate-on/off all read this lock once the first substantive user
 * message establishes it.
 *
 * HARD RULE: never persist the website UI locale as the lock just because
 * detection missed a turn — that permanently poisons EN-site + ZH-chat sessions.
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

/** Chronological first substantive user sample — design SSOT for first-input lock. */
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
 * Prefer persisted lock; reclaim UI-poisoned locks; else first substantive; else UI.
 */
export function resolvePivotSessionLang(
  session: SessionLangSource | null | undefined,
  uiLocale: string,
): AppLocale {
  const ui = parseAppLocale(uiLocale);
  const first = findFirstSubstantiveUserLocale(session?.messages);
  const oq = session?.original_question?.trim()
    ? detectSessionLangFromSample(session.original_question)
    : null;
  const firstOrOq = first ?? oq;

  if (session?.locked_output_locale) {
    const locked = parseAppLocale(session.locked_output_locale);
    // UI-poisoned lock: stored website locale without a matching substantive sample.
    if (firstOrOq && locked === ui && locked !== firstOrOq) {
      return firstOrOq;
    }
    return locked;
  }

  if (firstOrOq) return firstOrOq;
  return ui;
}

/**
 * Resolve this turn's output locale and the next value to persist as lock.
 * Priority: explicit switch → reclaim/existing lock → first substantive → UI (output only).
 * `nextLocked` is undefined when we only fell back to UI — never persist UI-only.
 */
export function nextLockedOutputLocale(input: {
  locked?: AppLocale | null;
  userInput?: string;
  uiLocale: AppLocale;
  messages?: SessionLangSource["messages"] | null;
  original_question?: string | null;
}): { outputLocale: AppLocale; nextLocked: AppLocale | undefined } {
  const explicit = detectExplicitLanguageSwitch(input.userInput);
  if (explicit) {
    return { outputLocale: explicit, nextLocked: explicit };
  }

  const first =
    findFirstSubstantiveUserLocale(input.messages) ??
    (input.original_question
      ? detectSessionLangFromSample(input.original_question)
      : null) ??
    (input.userInput ? detectSessionLangFromSample(input.userInput) : null);

  if (input.locked) {
    const locked = parseAppLocale(input.locked);
    // Reclaim UI-poisoned lock toward first substantive sample.
    if (first && locked === input.uiLocale && locked !== first) {
      return { outputLocale: first, nextLocked: first };
    }
    return { outputLocale: locked, nextLocked: locked };
  }

  if (first) {
    return { outputLocale: first, nextLocked: first };
  }

  return { outputLocale: input.uiLocale, nextLocked: undefined };
}
