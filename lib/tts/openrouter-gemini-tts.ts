/**
 * OpenRouter Kokoro TTS — segmented narration (title / body / silence).
 * Plain text input (no Gemini-style director prefix — Kokoro would speak it).
 */

import {
  buildDeliveryTtsSpeakQueue,
  extractDeliveryNarrationUnits,
  narrationUnitsPlainCorpus,
} from "@/lib/poju/delivery-narration-units";
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
  silencePcmBytes,
} from "@/lib/tts/pcm-wav";

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
  speech_calls: number;
};

async function fetchOpenRouterSpeechPcm(opts: {
  text: string;
  locale: string;
}): Promise<ReadableStream<Uint8Array>> {
  const model = resolveModel();
  const voice = deliveryTtsVoiceForLocale(opts.locale);
  const speed = deliveryTtsSpeedForLocale(opts.locale);
  const input = opts.text.replace(/\r\n/g, "\n").trim();

  const response = await fetch(OPENROUTER_SPEECH_URL, {
    method: "POST",
    headers: openRouterSpeechHeaders(),
    body: JSON.stringify({
      model,
      input,
      voice,
      speed,
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
  return response.body;
}

/**
 * Segmented TTS: title → silence → body chunks → silence → next.
 * Concatenates Kokoro PCM + silence into one Response body.
 */
export async function openRouterDeliveryTtsStream(opts: {
  fullText: string;
  locale: string;
}): Promise<OpenRouterTtsStreamResult> {
  const units = extractDeliveryNarrationUnits(opts.fullText, opts.locale);
  const corpus = narrationUnitsPlainCorpus(units);
  if (!corpus) {
    throw new Error("tts_empty_text");
  }
  if (corpus.length > DELIVERY_TTS_MAX_CHARS) {
    throw new Error(`tts_text_too_long:${corpus.length}`);
  }

  const queue = buildDeliveryTtsSpeakQueue(units);
  const speechPieces = queue.filter((p) => p.kind === "speech");
  if (speechPieces.length === 0) {
    throw new Error("tts_empty_text");
  }

  const model = resolveModel();
  const voice = deliveryTtsVoiceForLocale(opts.locale);
  const rate = DEFAULT_PCM_RATE;
  const channels = DEFAULT_PCM_CHANNELS;
  const contentType = `audio/pcm;rate=${rate};channels=${channels}`;

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (const piece of queue) {
          if (piece.kind === "silence") {
            const quiet = silencePcmBytes(piece.seconds, rate, channels);
            if (quiet.byteLength > 0) controller.enqueue(quiet);
            continue;
          }

          const upstream = await fetchOpenRouterSpeechPcm({
            text: piece.text,
            locale: opts.locale,
          });
          const reader = upstream.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value?.byteLength) controller.enqueue(value);
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return {
    response: new Response(body, {
      headers: {
        "Content-Type": contentType,
      },
    }),
    model,
    voice,
    char_count: corpus.length,
    content_type: contentType,
    rate,
    channels,
    speech_calls: speechPieces.length,
  };
}
