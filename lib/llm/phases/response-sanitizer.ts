/**
 * v5 — no response sanitization or hardcoded fallback copy.
 * Only language detection for greeting-phase prompts.
 */

export function detectInitialLanguage(text: string): string {
  if (!text) return "Likely English.";
  if (/[\u4e00-\u9fa5]/.test(text)) return "User wrote in Chinese — respond in Chinese.";
  if (/[áéíóúñ¿¡]/i.test(text)) return "User wrote in Spanish — respond in Spanish.";
  if (/[àâäéèêëîïôöùûüÿç]/i.test(text)) return "User wrote in French — respond in French.";
  if (/[äöüß]/i.test(text)) return "User wrote in German — respond in German.";
  return "User wrote in English — respond in English.";
}
