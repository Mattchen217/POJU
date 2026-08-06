/**
 * v5 — no response sanitization or hardcoded fallback copy.
 * Language detection for phase prompts.
 */

import { detectLanguage } from "@/lib/prompts/language-directive";

const INITIAL_LANGUAGE_HINT: Record<
  ReturnType<typeof detectLanguage>,
  string
> = {
  zh: "User wrote in Chinese — respond in Chinese.",
  es: "User wrote in Spanish — respond in Spanish.",
  fr: "User wrote in French — respond in French.",
  en: "User wrote in English — respond in English.",
};

export function detectInitialLanguage(text: string): string {
  if (!text) return "Likely English.";
  return INITIAL_LANGUAGE_HINT[detectLanguage(text)];
}
