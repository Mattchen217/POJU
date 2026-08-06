import { NextResponse } from "next/server";
import { z } from "zod";

import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
import { DELIVERY_TTS_MAX_CHARS } from "@/lib/tts/delivery-tts-constants";
import {
  synthesizeDeliveryTts,
} from "@/lib/tts/openrouter-gemini-tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BodySchema = z.object({
  text: z.string().min(1).max(DELIVERY_TTS_MAX_CHARS),
  locale: z.string().min(2).max(16),
  session_id: z.string().max(80).optional(),
});

/**
 * Delivery-report TTS — body-only text from client (already extracted / compliant).
 * Returns raw audio/mpeg. Ephemeral; client stores in IndexedDB.
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
    const result = await synthesizeDeliveryTts({
      mainText: parsed.data.text,
      locale: parsed.data.locale,
    });

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.mime,
        "Cache-Control": "no-store",
        "X-Delivery-Tts-Model": result.model,
        "X-Delivery-Tts-Voice": result.voice,
        "X-Delivery-Tts-Chars": String(result.char_count),
        "X-Delivery-Tts-Chunks": String(result.chunks),
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
