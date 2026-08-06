import { NextResponse } from "next/server";
import { z } from "zod";

import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
import { openRouterDeliveryTtsStream } from "@/lib/tts/openrouter-gemini-tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Full delivery markdown (evidence included); server extracts title+body only. */
const BodySchema = z.object({
  text: z.string().min(1).max(80_000),
  locale: z.string().min(2).max(16),
  session_id: z.string().max(80).optional(),
});

/**
 * Delivery TTS — segmented title/body with pauses, PCM byte stream.
 * Client accumulates → WAV → IndexedDB.
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
    const stream = await openRouterDeliveryTtsStream({
      fullText: parsed.data.text,
      locale: parsed.data.locale,
    });

    return new NextResponse(stream.response.body, {
      status: 200,
      headers: {
        "Content-Type": stream.content_type,
        "Cache-Control": "no-store",
        "X-Delivery-Tts-Model": stream.model,
        "X-Delivery-Tts-Voice": stream.voice,
        "X-Delivery-Tts-Chars": String(stream.char_count),
        "X-Delivery-Tts-Rate": String(stream.rate),
        "X-Delivery-Tts-Channels": String(stream.channels),
        "X-Delivery-Tts-Speech-Calls": String(stream.speech_calls),
        "X-Delivery-Tts-Streaming": "1",
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
