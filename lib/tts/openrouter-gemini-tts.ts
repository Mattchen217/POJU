/**
 * OpenRouter Gemini TTS for Pivot delivery narration.
 * Gemini on OpenRouter only supports response_format=pcm (24 kHz mono).
 * We wrap PCM as WAV for browser / HTML embed / IndexedDB reuse.
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
const DEFAULT_PCM_RATE = 24_000;
const DEFAULT_PCM_CHANNELS = 1;

export type DeliveryTtsSynthesizeResult = {
  mime: "audio/wav";
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

/** Wrap little-endian 16-bit PCM as a WAV container (no ffmpeg needed). */
export function pcmToWav(
  pcm: Buffer,
  sampleRate = DEFAULT_PCM_RATE,
  channels = DEFAULT_PCM_CHANNELS,
  bitsPerSample = 16,
): Buffer {
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.length;
  const out = Buffer.alloc(44 + dataSize);
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + dataSize, 4);
  out.write("WAVE", 8);
  out.write("fmt ", 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(channels, 22);
  out.writeUInt32LE(sampleRate, 24);
  out.writeUInt32LE(byteRate, 28);
  out.writeUInt16LE(blockAlign, 32);
  out.writeUInt16LE(bitsPerSample, 34);
  out.write("data", 36);
  out.writeUInt32LE(dataSize, 40);
  pcm.copy(out, 44);
  return out;
}

function parsePcmMeta(contentType: string | null): { rate: number; channels: number } {
  const ct = contentType || "";
  const rateMatch = /rate=(\d+)/i.exec(ct);
  const chMatch = /channels=(\d+)/i.exec(ct);
  const rate = rateMatch ? Number(rateMatch[1]) : DEFAULT_PCM_RATE;
  const channels = chMatch ? Number(chMatch[1]) : DEFAULT_PCM_CHANNELS;
  return {
    rate: Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_PCM_RATE,
    channels: Number.isFinite(channels) && channels > 0 ? channels : DEFAULT_PCM_CHANNELS,
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

/** Split body on paragraph boundaries near CHUNK_TARGET. */
export function chunkDeliveryTtsText(text: string, maxChunk = CHUNK_TARGET): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  if (normalized.length <= maxChunk) return [normalized];

  const parts: string[] = [];
  let rest = normalized;
  while (rest.length > maxChunk) {
    const window = rest.slice(0, maxChunk);
    let cut = Math.max(
      window.lastIndexOf("\n\n"),
      window.lastIndexOf("\n"),
      window.lastIndexOf("。"),
      window.lastIndexOf(". "),
    );
    if (cut < maxChunk * 0.4) cut = maxChunk;
    else if (cut < window.length - 1 && (window[cut] === "." || window[cut] === "。")) cut += 1;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts.filter(Boolean);
}

async function synthesizeOneChunk(
  input: string,
  model: string,
): Promise<{ pcm: Buffer; rate: number; channels: number }> {
  const res = await fetch(OPENROUTER_SPEECH_URL, {
    method: "POST",
    headers: openRouterSpeechHeaders(),
    body: JSON.stringify({
      model,
      input,
      voice: DELIVERY_TTS_VOICE,
      // Gemini TTS on OpenRouter rejects mp3 — pcm only.
      response_format: "pcm",
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(summarizeUpstreamTtsError(res.status, errText));
  }

  const meta = parsePcmMeta(res.headers.get("content-type"));
  const ab = await res.arrayBuffer();
  if (!ab.byteLength) {
    throw new Error("tts_empty_audio");
  }
  return { pcm: Buffer.from(ab), rate: meta.rate, channels: meta.channels };
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
  const pcmParts: Buffer[] = [];
  let rate = DEFAULT_PCM_RATE;
  let channels = DEFAULT_PCM_CHANNELS;

  for (let i = 0; i < chunks.length; i++) {
    const piece = chunks[i]!;
    const input =
      i === 0
        ? buildDeliveryTtsSpeechInput(piece, opts.locale)
        : buildDeliveryTtsSpeechInput(piece, opts.locale).replace(
            /---REPORT---/,
            `---REPORT (part ${i + 1}/${chunks.length}; continue in the same voice and language, no recap)---`,
          );
    const part = await synthesizeOneChunk(input, model);
    rate = part.rate;
    channels = part.channels;
    pcmParts.push(part.pcm);
  }

  const wav = pcmToWav(Buffer.concat(pcmParts), rate, channels);

  return {
    mime: "audio/wav",
    buffer: wav,
    model,
    voice: DELIVERY_TTS_VOICE,
    char_count: main.length,
    chunks: pcmParts.length,
  };
}
