import type { SanitizerStateSlice } from "@/lib/llm/phases/types";

export const HALLUCINATION_PATTERNS: RegExp[] = [
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
  /(?:八字|五行|日主|大运|十神|卦|爻|用神|忌神)/,
  /(?:bazi|wu\s*xing|day\s*master|da\s*yun|ten\s*gods|hexagram|yong\s*shen)/i,
];

const METAPHYSICS_ONLY_PATTERNS = HALLUCINATION_PATTERNS.slice(-2);

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
 * 双层保护之一：无 profile 时严格拦截人格/命理幻觉；有 profile 后仅屏蔽术语暴露。
 */
export function sanitizeResponse(response: string, state: SanitizerStateSlice): string {
  if (!response) return response;

  const hasProfile = Boolean(state.selected_profile_id);
  const skipped = state.profile_skipped;

  if (hasProfile || skipped) {
    let cleaned = response;
    for (const pattern of METAPHYSICS_ONLY_PATTERNS) {
      cleaned = cleaned.replace(pattern, "[modern translation needed]");
    }
    return cleaned;
  }

  let issues = 0;
  for (const pattern of HALLUCINATION_PATTERNS) {
    if (pattern.test(response)) issues += 1;
  }

  if (issues >= 2) {
    console.warn("[sanitizer] Too many hallucination patterns detected, replacing response");
    return getSafeFallbackResponse(state);
  }

  let cleaned = response;
  for (const pattern of HALLUCINATION_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  cleaned = cleaned
    .replace(/\s{2,}/g, " ")
    .replace(/[—。,]{2,}/g, "。")
    .trim();

  return cleaned || getSafeFallbackResponse(state);
}
