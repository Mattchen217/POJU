/**
 * OpenRouter Gemini TTS — single-shot request, HTTP body stream (no text slicing).
 * Gemini on OpenRouter: response_format must be pcm.
 */

import { buildDeliveryTtsSpeechInput } from "@/lib/tts/delivery-tts-prompt";
import {
  DELIVERY_TTS_MAX_CHARS,
  DELIVERY_TTS_MODEL_DEFAULT,
  DELIVERY_TTS_VOICE,
} from "@/lib/tts/delivery-tts-constants";
import { parsePcmContentType } from "@/lib/tts/pcm-wav";

const OPENROUTER_SPEECH_URL = "https://openrouter.ai/api/v1/audio/speech";

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

export type OpenRouterTtsStreamResult = {
  response: Response;
  model: string;
  voice: string;
  char_count: number;
  content_type: string;
  rate: number;
  channels: number;
};

/**
 * Start one OpenRouter speech request for the full body (no text chunking).
 * Returns the upstream Response whose body is a PCM byte stream — pipe to client.
 */
export async function openRouterDeliveryTtsStream(opts: {
  mainText: string;
  locale: string;
}): Promise<OpenRouterTtsStreamResult> {
  const main = opts.mainText.replace(/\r\n/g, "\n").trim();
  if (!main) {
    throw new Error("tts_empty_text");
  }
  if (main.length > DELIVERY_TTS_MAX_CHARS) {
    throw new Error(`tts_text_too_long:${main.length}`);
  }

  const model = resolveModel();
  const input = buildDeliveryTtsSpeechInput(main, opts.locale);

  const response = await fetch(OPENROUTER_SPEECH_URL, {
    method: "POST",
    headers: openRouterSpeechHeaders(),
    body: JSON.stringify({
      model,
      input,
      voice: DELIVERY_TTS_VOICE,
      response_format: "pcm",
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(summarizeUpstreamTtsError(response.status, errText));
  }

  if (!response.body) {
    throw new Error("tts_empty_audio");
  }

  const contentType =
    response.headers.get("content-type") || "audio/pcm;rate=24000;channels=1";
  const meta = parsePcmContentType(contentType);

  return {
    response,
    model,
    voice: DELIVERY_TTS_VOICE,
    char_count: main.length,
    content_type: contentType,
    rate: meta.rate,
    channels: meta.channels,
  };
}
