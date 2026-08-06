/**
 * OpenRouter Gemini TTS for Pivot delivery narration.
 * Returns MP3 bytes (response_format: mp3). Client/IndexedDB store for reuse.
 */

import { buildDeliveryTtsSpeechInput } from "@/lib/tts/delivery-tts-prompt";
import {
  DELIVERY_TTS_MAX_CHARS,
  DELIVERY_TTS_MODEL_DEFAULT,
  DELIVERY_TTS_VOICE,
} from "@/lib/tts/delivery-tts-constants";

const OPENROUTER_SPEECH_URL = "https://openrouter.ai/api/v1/audio/speech";

export { DELIVERY_TTS_MAX_CHARS, DELIVERY_TTS_VOICE, DELIVERY_TTS_MODEL_DEFAULT };

const CHUNK_TARGET = 3500;

export type DeliveryTtsSynthesizeResult = {
  mime: "audio/mpeg";
  buffer: Buffer;
  model: string;
  voice: string;
  char_count: number;
  chunks: number;
};

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

/** Split body on paragraph boundaries near CHUNK_TARGET. */
export function chunkDeliveryTtsText(text: string, maxChunk = CHUNK_TARGET): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  if (normalized.length <= maxChunk) return [normalized];

  const parts: string[] = [];
  let rest = normalized;
  while (rest.length > maxChunk) {
    const window = rest.slice(0, maxChunk);
    let cut = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf("\n"), window.lastIndexOf("。"), window.lastIndexOf(". "));
    if (cut < maxChunk * 0.4) cut = maxChunk;
    else if (cut < window.length - 1 && (window[cut] === "." || window[cut] === "。")) cut += 1;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts.filter(Boolean);
}

async function synthesizeOneChunk(input: string, model: string): Promise<Buffer> {
  const res = await fetch(OPENROUTER_SPEECH_URL, {
    method: "POST",
    headers: openRouterSpeechHeaders(),
    body: JSON.stringify({
      model,
      input,
      voice: DELIVERY_TTS_VOICE,
      response_format: "mp3",
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`tts_upstream_${res.status}:${errText.slice(0, 400)}`);
  }

  const ab = await res.arrayBuffer();
  if (!ab.byteLength) {
    throw new Error("tts_empty_audio");
  }
  return Buffer.from(ab);
}

/**
 * Synthesize delivery main body. Director prompt applied once on first chunk;
 * continuation chunks get a short “continue narrating” preface.
 */
export async function synthesizeDeliveryTts(opts: {
  mainText: string;
  locale: string;
}): Promise<DeliveryTtsSynthesizeResult> {
  const main = opts.mainText.replace(/\r\n/g, "\n").trim();
  if (!main) {
    throw new Error("tts_empty_text");
  }
  if (main.length > DELIVERY_TTS_MAX_CHARS) {
    throw new Error(`tts_text_too_long:${main.length}`);
  }

  const model = resolveModel();
  const chunks = chunkDeliveryTtsText(main);
  const buffers: Buffer[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const piece = chunks[i]!;
    const input =
      i === 0
        ? buildDeliveryTtsSpeechInput(piece, opts.locale)
        : buildDeliveryTtsSpeechInput(
            piece,
            opts.locale,
          ).replace(
            /---REPORT---/,
            `---REPORT (part ${i + 1}/${chunks.length}; continue in the same voice and language, no recap)---`,
          );
    buffers.push(await synthesizeOneChunk(input, model));
  }

  return {
    mime: "audio/mpeg",
    buffer: Buffer.concat(buffers),
    model,
    voice: DELIVERY_TTS_VOICE,
    char_count: main.length,
    chunks: buffers.length,
  };
}
