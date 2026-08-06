import { NextResponse } from "next/server";
import { z } from "zod";

import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
import {
  DELIVERY_TTS_UTTERANCE_MAX_CHARS,
  openRouterDeliveryTtsUtterance,
} from "@/lib/tts/openrouter-gemini-tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Single utterance only — client stitches the full report. */
export const maxDuration = 60;

const BodySchema = z.object({
  /** One speech piece (title or body chunk), not the full report. */
  text: z.string().min(1).max(DELIVERY_TTS_UTTERANCE_MAX_CHARS),
  locale: z.string().min(2).max(16),
  session_id: z.string().max(80).optional(),
});

/**
 * Delivery TTS — one Kokoro utterance → PCM bytes.
 * Client builds the title/body/silence queue and concatenates.
 */
export async function POST(req: Request) {
  if (!isOpenRouterConfigured()) {
    return NextResponse.json(
      { ok: false, error: "tts_not_configured" },
      { status: 503 },
    );
  }

  const raw = (await req.json().catch(() => null)) as unknown;
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  try {
    const utterance = await openRouterDeliveryTtsUtterance({
      text: parsed.data.text,
      locale: parsed.data.locale,
      signal: req.signal,
    });

    return new NextResponse(Buffer.from(utterance.pcm), {
      status: 200,
      headers: {
        "Content-Type": utterance.content_type,
        "Cache-Control": "no-store",
        "X-Delivery-Tts-Model": utterance.model,
        "X-Delivery-Tts-Voice": utterance.voice,
        "X-Delivery-Tts-Chars": String(utterance.char_count),
        "X-Delivery-Tts-Rate": String(utterance.rate),
        "X-Delivery-Tts-Channels": String(utterance.channels),
        "X-Delivery-Tts-Speech-Calls": "1",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[delivery-tts]", msg.slice(0, 800));
    if (msg.startsWith("tts_text_too_long")) {
      return NextResponse.json({ ok: false, error: "text_too_long" }, { status: 413 });
    }
    if (msg.startsWith("tts_empty")) {
      return NextResponse.json({ ok: false, error: "empty_text" }, { status: 400 });
    }
    return NextResponse.json(
      { ok: false, error: "tts_failed", detail: msg.slice(0, 240) },
      { status: 502 },
    );
  }
}
