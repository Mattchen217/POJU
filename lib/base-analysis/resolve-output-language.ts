import { detectAppLocaleFromText, type AppLocale } from "@/lib/prompts/language-directive";

/** Base analysis display language: user input text first, then browser preference — not URL locale. */
export function resolveBaseAnalysisOutputLanguage(userInput?: string): "zh" | "en" {
  if (userInput?.trim()) {
    const detected = detectAppLocaleFromText(userInput);
    if (detected === "zh") return "zh";
    if (detected === "en") return "en";
  }

  if (typeof navigator !== "undefined") {
    const nav = navigator.language.toLowerCase();
    if (nav.startsWith("zh")) return "zh";
  }

  return "en";
}

export function outputLanguageLabel(code: "zh" | "en"): string {
  return code === "zh" ? "Simplified Chinese (zh-CN)" : "English";
}

export function parseOutputLanguageCode(v: unknown): "zh" | "en" {
  if (v === "zh" || v === "en") return v;
  const s = String(v ?? "").toLowerCase();
  if (s.startsWith("zh") || s.includes("chinese") || s.includes("中文")) return "zh";
  return "en";
}

/** Narrow AppLocale to supported base-analysis output codes. */
export function appLocaleToOutputLanguage(locale: AppLocale): "zh" | "en" {
  return locale === "zh" ? "zh" : "en";
}
