/**
 * Client helper: reuse IndexedDB delivery audio or synthesize once via API.
 */

import {
  blobToBase64,
  getDeliveryAudio,
  putDeliveryAudio,
} from "@/lib/poju/delivery-audio-store";
import { extractDeliveryMainText } from "@/lib/poju/delivery-main-text";
import { DELIVERY_TTS_MAX_CHARS } from "@/lib/tts/delivery-tts-constants";

export type EnsureDeliveryAudioResult = {
  blob: Blob;
  mime: string;
  objectUrl: string;
  base64: string;
  fromCache: boolean;
  charCount: number;
  contentHash: string;
};

const inflight = new Map<string, Promise<EnsureDeliveryAudioResult>>();

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

function revokeLater(url: string): void {
  window.setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }, 120_000);
}

export async function ensureDeliveryAudio(opts: {
  sessionId: string;
  fullText: string;
  locale: string;
}): Promise<EnsureDeliveryAudioResult> {
  const main = extractDeliveryMainText(opts.fullText, opts.locale).trim();
  if (!main) {
    throw new Error("tts_no_main_text");
  }
  if (main.length > DELIVERY_TTS_MAX_CHARS) {
    throw new Error("tts_text_too_long");
  }

  const contentHash = await sha256Hex(`${opts.locale}\n${main}`);
  const dedupeKey = `${opts.sessionId}::${contentHash}`;

  const existing = inflight.get(dedupeKey);
  if (existing) return existing;

  const run = (async (): Promise<EnsureDeliveryAudioResult> => {
    const cached = await getDeliveryAudio(opts.sessionId, contentHash);
    if (cached?.blob && cached.blob.size > 32) {
      const objectUrl = URL.createObjectURL(cached.blob);
      revokeLater(objectUrl);
      const base64 = await blobToBase64(cached.blob);
      return {
        blob: cached.blob,
        mime: cached.mime || "audio/mpeg",
        objectUrl,
        base64,
        fromCache: true,
        charCount: cached.char_count,
        contentHash,
      };
    }

    const res = await fetch("/api/poju/delivery-tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        text: main,
        locale: opts.locale,
        session_id: opts.sessionId,
      }),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || `tts_http_${res.status}`);
    }

    const mime = res.headers.get("Content-Type")?.split(";")[0]?.trim() || "audio/mpeg";
    const blob = await res.blob();
    if (blob.size < 32) {
      throw new Error("tts_empty_audio");
    }

    await putDeliveryAudio({
      sessionId: opts.sessionId,
      contentHash,
      locale: opts.locale,
      mime,
      blob,
      charCount: main.length,
    });

    const objectUrl = URL.createObjectURL(blob);
    revokeLater(objectUrl);
    const base64 = await blobToBase64(blob);
    return {
      blob,
      mime,
      objectUrl,
      base64,
      fromCache: false,
      charCount: main.length,
      contentHash,
    };
  })();

  inflight.set(dedupeKey, run);
  try {
    return await run;
  } finally {
    inflight.delete(dedupeKey);
  }
}
