/** User-facing copy when LLM infra is exhausted after retries (not conversational coaching). */
export const POJU_SERVICE_BUSY_MESSAGES = {
  zh: "现在使用的人有点多，服务繁忙，请稍等片刻后重试。你的会话已保存。",
  en: "We're experiencing high demand right now. Please wait a moment and try again. Your session is saved.",
  es: "Hay mucha demanda en este momento. Espera un momento e inténtalo de nuevo. Tu sesión está guardada.",
  de: "Aktuell ist die Nachfrage hoch. Bitte einen Moment warten und erneut versuchen. Deine Sitzung ist gespeichert.",
  fr: "La demande est élevée en ce moment. Merci de patienter un instant et de réessayer. Votre session est enregistrée.",
} as const;

/** User-facing copy when the model ran but returned no visible body (not supplier queue busy). */
export const POJU_EMPTY_GENERATION_MESSAGES = {
  zh: "这一条没有完整生成，请点下方重试。你的会话已保存。",
  en: "This response didn't fully generate—please tap retry below. Your session is saved.",
  es: "Esta respuesta no se generó por completo—pulsa reintentar abajo. Tu sesión está guardada.",
  de: "Diese Antwort wurde nicht vollständig erzeugt—bitte unten erneut versuchen. Deine Sitzung ist gespeichert.",
  fr: "Cette réponse n'a pas été entièrement générée—appuyez sur réessayer ci-dessous. Votre session est enregistrée.",
} as const;

export type PojuBusyLocale = keyof typeof POJU_SERVICE_BUSY_MESSAGES;

export function resolvePojuBusyLocale(locale?: string): PojuBusyLocale {
  const loc = (locale ?? "en").toLowerCase();
  if (loc.startsWith("zh")) return "zh";
  if (loc.startsWith("es")) return "es";
  if (loc.startsWith("de")) return "de";
  if (loc.startsWith("fr")) return "fr";
  return "en";
}

/** Single friendly busy message — replaces legacy "未能生成" copy. */
export function getPojuServiceBusyMessage(locale?: string): string {
  const key = resolvePojuBusyLocale(locale);
  return POJU_SERVICE_BUSY_MESSAGES[key] ?? POJU_SERVICE_BUSY_MESSAGES.en;
}

export function getPojuEmptyGenerationMessage(locale?: string): string {
  const key = resolvePojuBusyLocale(locale);
  return POJU_EMPTY_GENERATION_MESSAGES[key] ?? POJU_EMPTY_GENERATION_MESSAGES.en;
}

/** True for empty-body generation failures (distinct from supplier queue busy). */
export function isPojuEmptyGenerationMessage(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (t.includes("没有完整生成") || t.includes("didn't fully generate")) return true;
  if (t.includes("no se generó por completo") || t.includes("nicht vollständig erzeugt")) return true;
  if (t.includes("pas été entièrement générée")) return true;
  if (t.includes("生成异常") || t.includes("empty model output")) return true;
  if (t.includes("salida vacía") || t.includes("leere Modellausgabe")) return true;
  if (t.includes("sortie vide")) return true;
  return false;
}

/** Infra / fallback placeholders — never append conversational follow-ups. */
export function isPojuFailurePlaceholderMessage(text: string): boolean {
  return isPojuInfrastructureFailureMessage(text) || isPojuEmptyGenerationMessage(text);
}

/** True for infra failure placeholders (never append conversational follow-ups). */
export function isPojuInfrastructureFailureMessage(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (t.includes("服务繁忙") || t.includes("high demand")) return true;
  if (t.includes("Nachfrage hoch") || t.includes("demande est élevée")) return true;
  if (t.includes("mucha demanda")) return true;
  if (t.startsWith("[POJU]") && t.includes("未能生成")) return true;
  if (t.startsWith("[POJU]") && t.includes("could not be generated")) return true;
  if (t.startsWith("[POJU]") && t.includes("No se pudo generar")) return true;
  return false;
}
