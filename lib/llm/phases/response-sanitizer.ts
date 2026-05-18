import type { SanitizerStateSlice } from "@/lib/llm/phases/types";

/** No-profile greeting: personality / fortune-telling without chart data */
export const NO_PROFILE_HALLUCINATION_PATTERNS: RegExp[] = [
  /(?:你|您).{0,5}(?:其实|本质上|天性|内在|实际上).{0,10}(?:是|有|具有|表现|展现)/,
  /(?:你|您)(?:的|本)(?:个人特质|天性|天然|本性|本质|内在|能量|气质|气场)/,
  /从你(?:的)?(?:个人|内在|表现|状态).{0,5}(?:看|来看)/,
  /(?:你|您)(?:不缺|不缺乏|有|具有).{0,10}(?:力|能力|天赋|特质)/,
  /在你(?:的)?(?:模式|气场|内核|本质|结构)中/,
  /(?:你|您).{0,5}(?:擅长|不擅长|天生)/,
  /Your\s+(?:natural|true|inner|essential|fundamental)\s+(?:nature|pattern|self|essence|tendency)/i,
  /You\s+(?:are\s+typically|tend\s+to\s+be|naturally|inherently)/i,
  /In\s+your\s+(?:makeup|nature|essence|pattern|energy)/i,
  /From\s+what\s+I\s+see\s+in\s+you/i,
  /Your\s+(?:strength|gift|talent)\s+(?:is|lies)/i,
  /You\s+will\s+(?:succeed|fail|achieve|find|encounter)/i,
  /(?:你|您)?(?:将会|必将|肯定会|会).{0,10}(?:成功|失败|遇到|获得)/,
];

/** @deprecated use NO_PROFILE_HALLUCINATION_PATTERNS — kept for greeting-phase imports */
export const HALLUCINATION_PATTERNS = NO_PROFILE_HALLUCINATION_PATTERNS;

export function detectInitialLanguage(text: string): string {
  if (!text) return "Likely English.";
  if (/[\u4e00-\u9fa5]/.test(text)) return "User wrote in Chinese — respond in Chinese.";
  if (/[áéíóúñ¿¡]/i.test(text)) return "User wrote in Spanish — respond in Spanish.";
  if (/[àâäéèêëîïôöùûüÿç]/i.test(text)) return "User wrote in French — respond in French.";
  if (/[äöüß]/i.test(text)) return "User wrote in German — respond in German.";
  return "User wrote in English — respond in English.";
}

export function getSafeFallbackResponse(state: SanitizerStateSlice): string {
  const safe: Record<string, string> = {
    en: "I hear you. Tell me more — what specifically is happening, and how long has it been like this?",
    zh: "我听到了。能多告诉我一些吗——具体发生了什么？这种情况持续多久了？",
    es: "Te escucho. Cuéntame más — ¿qué está pasando específicamente, y desde hace cuánto?",
    fr: "Je vous entends. Dites-m'en plus — qu'est-ce qui se passe spécifiquement, et depuis combien de temps ?",
    de: "Ich höre Sie. Erzählen Sie mehr — was passiert genau, und wie lange schon?",
  };
  const q = state.original_question || "";
  if (/[\u4e00-\u9fa5]/.test(q)) return safe.zh;
  if (/[áéíóúñ]/.test(q)) return safe.es;
  if (/[àâäéèê]/.test(q)) return safe.fr;
  if (/[äöüß]/.test(q)) return safe.de;
  return safe.en;
}

/**
 * Step I: 有命盘后不再清洗命理术语；无命盘时仅拦截明显人格/预言幻觉。
 */
export function sanitizeResponse(response: string, state: SanitizerStateSlice): string {
  const trimmed = (response ?? "").trim();
  if (!trimmed) return getSafeFallbackResponse(state);

  if (state.selected_profile_id || state.profile_skipped) {
    return trimmed;
  }

  let issues = 0;
  for (const pattern of NO_PROFILE_HALLUCINATION_PATTERNS) {
    if (pattern.test(trimmed)) issues += 1;
  }

  if (issues >= 2) {
    console.warn("[sanitizer] Too many no-profile hallucination patterns, replacing response");
    return getSafeFallbackResponse(state);
  }

  if (issues === 0) return trimmed;

  let cleaned = trimmed;
  for (const pattern of NO_PROFILE_HALLUCINATION_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  cleaned = cleaned
    .replace(/\s{2,}/g, " ")
    .replace(/[—。,]{2,}/g, "。")
    .trim();

  return cleaned || getSafeFallbackResponse(state);
}
