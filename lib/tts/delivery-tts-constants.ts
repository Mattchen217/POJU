/** Shared TTS limits — safe for client + server imports. */

export const DELIVERY_TTS_MAX_CHARS = 10_000;

/** Neural TTS via OpenRouter (Kokoro-82M). */
export const DELIVERY_TTS_MODEL_DEFAULT = "hexgrad/kokoro-82m";

export type DeliveryTtsLangCode = "en" | "es" | "fr" | "zh";

/** Locale-bucket → Kokoro voice (broadcast-leaning). ZH: zm_yunyang (male anchor). */
export const DELIVERY_TTS_VOICE_BY_LANG: Record<DeliveryTtsLangCode, string> = {
  en: "af_heart",
  es: "ef_dora",
  fr: "ff_siwis",
  zh: "zm_yunyang",
};

/** Slight speed bump for report pacing (OpenRouter → Kokoro). */
export const DELIVERY_TTS_SPEED_BY_LANG: Record<DeliveryTtsLangCode, number> = {
  en: 1.05,
  es: 1.05,
  fr: 1.05,
  zh: 1.1,
};

/** Fallback export for older imports — EN default voice. */
export const DELIVERY_TTS_VOICE = DELIVERY_TTS_VOICE_BY_LANG.en;

/**
 * Per speech call. Title+body are merged into one call per card when possible
 * (fewer round-trips). Larger packs = fewer OpenRouter hops.
 */
export const DELIVERY_TTS_UTTERANCE_CHARS = 480;

/**
 * How many Kokoro utterances the browser fires in parallel.
 * Sequential felt “stuck”; 4× cuts wall time ~3–4× for ~10–20 clips.
 */
export const DELIVERY_TTS_FETCH_CONCURRENCY = 4;

/** Silence after a section heading (seconds) — only when title is a separate clip. */
export const DELIVERY_TTS_PAUSE_AFTER_TITLE_SEC = 0.7;

/** Silence after a section body, before the next heading (seconds). */
export const DELIVERY_TTS_PAUSE_AFTER_BODY_SEC = 0.65;

/** Tiny gap between body sub-utterances when a long body is split. */
export const DELIVERY_TTS_PAUSE_BODY_SPLIT_SEC = 0.3;

/** Cache / hash bump when model / voices / layout change. */
export const DELIVERY_TTS_CACHE_VERSION = "narration-v8-stream-first";

export function resolveDeliveryTtsLangCode(locale: string): DeliveryTtsLangCode {
  const l = (locale || "en").toLowerCase();
  if (l.startsWith("zh")) return "zh";
  if (l.startsWith("fr")) return "fr";
  if (l.startsWith("es")) return "es";
  return "en";
}

export function deliveryTtsVoiceForLocale(locale: string): string {
  return DELIVERY_TTS_VOICE_BY_LANG[resolveDeliveryTtsLangCode(locale)];
}

export function deliveryTtsSpeedForLocale(locale: string): number {
  return DELIVERY_TTS_SPEED_BY_LANG[resolveDeliveryTtsLangCode(locale)];
}
