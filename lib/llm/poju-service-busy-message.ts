/** User-facing copy when LLM infra is exhausted after retries (not conversational coaching). */
export const POJU_SERVICE_BUSY_MESSAGES = {
  zh: "现在使用的人有点多，服务繁忙，请稍等片刻后重试。你的会话已保存。",
  en: "We're experiencing high demand right now. Please wait a moment and try again. Your session is saved.",
  es: "Hay mucha demanda en este momento. Espera un momento e inténtalo de nuevo. Tu sesión está guardada.",
} as const;

export function resolvePojuBusyLocale(locale?: string): keyof typeof POJU_SERVICE_BUSY_MESSAGES {
  const loc = (locale ?? "en").toLowerCase();
  if (loc.startsWith("zh")) return "zh";
  if (loc.startsWith("es")) return "es";
  return "en";
}

/** Single friendly busy message — replaces legacy "未能生成" copy. */
export function getPojuServiceBusyMessage(locale?: string): string {
  const key = resolvePojuBusyLocale(locale);
  return POJU_SERVICE_BUSY_MESSAGES[key] ?? POJU_SERVICE_BUSY_MESSAGES.en;
}

/** True for infra failure placeholders (never append conversational follow-ups). */
export function isPojuInfrastructureFailureMessage(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (t.includes("服务繁忙") || t.includes("high demand")) return true;
  if (t.startsWith("[POJU]") && t.includes("未能生成")) return true;
  if (t.startsWith("[POJU]") && t.includes("could not be generated")) return true;
  if (t.startsWith("[POJU]") && t.includes("No se pudo generar")) return true;
  return false;
}
