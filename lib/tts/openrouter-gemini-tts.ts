/**
 * OpenRouter Kokoro TTS — single utterance (PCM).
 * Long reports: client plans the queue and calls this once per speech piece
 * (avoids Vercel 300s timeout on multi-segment server streams).
 */

import {
  DELIVERY_TTS_MAX_CHARS,
  DELIVERY_TTS_MODEL_DEFAULT,
  DELIVERY_TTS_VOICE,
  deliveryTtsSpeedForLocale,
  deliveryTtsVoiceForLocale,
} from "@/lib/tts/delivery-tts-constants";
import {
  DEFAULT_PCM_CHANNELS,
  DEFAULT_PCM_RATE,
  parsePcmContentType,
} from "@/lib/tts/pcm-wav";

const OPENROUTER_SPEECH_URL = "https://openrouter.ai/api/v1/audio/speech";

/** Soft cap per single OpenRouter speech call. */
export const DELIVERY_TTS_UTTERANCE_MAX_CHARS = 2_000;

export { DELIVERY_TTS_MAX_CHARS, DELIVERY_TTS_VOICE, DELIVERY_TTS_MODEL_DEFAULT };

function resolveModel(): string {
  return process.env.DELIVERY_TTS_MODEL?.trim() || DELIVERY_TTS_MODEL_DEFAULT;
}

function openRouterSpeechHeaders(): Record<string, string> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }
  const referer = process.env.OPENROUTER_HTTP_REFERER?.trim() || "https://easternos.com";
  const title = process.env.OPENROUTER_APP_TITLE?.trim() || "Pojulife";
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": referer,
    "X-Title": title,
  };
}

export function summarizeUpstreamTtsError(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string; code?: number } };
    const msg = parsed.error?.message?.trim();
    if (msg) return `tts_upstream_${status}:${msg}`;
  } catch {
    /* plain */
  }
  return `tts_upstream_${status}:${body.slice(0, 400)}`;
}

export type OpenRouterTtsUtteranceResult = {
  pcm: Uint8Array;
  model: string;
  voice: string;
  char_count: number;
  content_type: string;
  rate: number;
  channels: number;
};

/**
 * Synthesize one plain-text utterance to PCM (buffered; not a multi-segment stream).
 */
export async function openRouterDeliveryTtsUtterance(opts: {
  text: string;
  locale: string;
  signal?: AbortSignal;
}): Promise<OpenRouterTtsUtteranceResult> {
  const input = opts.text.replace(/\r\n/g, "\n").trim();
  if (!input) {
    throw new Error("tts_empty_text");
  }
  if (input.length > DELIVERY_TTS_UTTERANCE_MAX_CHARS) {
    throw new Error(`tts_text_too_long:${input.length}`);
  }

  const model = resolveModel();
  const voice = deliveryTtsVoiceForLocale(opts.locale);
  const speed = deliveryTtsSpeedForLocale(opts.locale);

  const t0 = Date.now();
  // Prefer DeepInfra (Kokoro host); allow fallback if that slug is unavailable.
  const response = await fetch(OPENROUTER_SPEECH_URL, {
    method: "POST",
    headers: openRouterSpeechHeaders(),
    body: JSON.stringify({
      model,
      input,
      voice,
      speed,
      response_format: "pcm",
      provider: {
        order: ["DeepInfra", "Together"],
        allow_fallbacks: true,
      },
    }),
    signal: opts.signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(summarizeUpstreamTtsError(response.status, errText));
  }

  const buf = new Uint8Array(await response.arrayBuffer());
  if (buf.byteLength < 32) {
    throw new Error("tts_empty_audio");
  }

  const contentType =
    response.headers.get("content-type") || "audio/pcm;rate=24000;channels=1";
  const meta = parsePcmContentType(contentType);
  const ms = Date.now() - t0;
  console.info(
    `[delivery-tts] kokoro ok chars=${input.length} voice=${voice} bytes=${buf.byteLength} ${ms}ms`,
  );

  return {
    pcm: buf,
    model,
    voice,
    char_count: input.length,
    content_type: contentType,
    rate: meta.rate || DEFAULT_PCM_RATE,
    channels: meta.channels || DEFAULT_PCM_CHANNELS,
  };
}

/** @deprecated Use openRouterDeliveryTtsUtterance — kept name for older imports. */
export async function openRouterDeliveryTtsStream(opts: {
  fullText: string;
  locale: string;
}): Promise<{
  response: Response;
  model: string;
  voice: string;
  char_count: number;
  content_type: string;
  rate: number;
  channels: number;
  speech_calls: number;
}> {
  const result = await openRouterDeliveryTtsUtterance({
    text: opts.fullText,
    locale: opts.locale,
  });
  return {
    response: new Response(Buffer.from(result.pcm), {
      headers: { "Content-Type": result.content_type },
    }),
    model: result.model,
    voice: result.voice,
    char_count: result.char_count,
    content_type: result.content_type,
    rate: result.rate,
    channels: result.channels,
    speech_calls: 1,
  };
}
