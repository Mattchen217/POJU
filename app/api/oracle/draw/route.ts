import { NextResponse } from "next/server";
import { drawGlyphFromPool } from "@/lib/glyph/draw";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      profile_id?: string;
      question?: string;
      session_type?: string;
      locale?: string;
    };

    if (!body.profile_id || !body.question?.trim()) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const question = body.question.trim();
    if (question.length < 10 || question.length > 200) {
      return NextResponse.json({ error: "question_length" }, { status: 400 });
    }

    const sign = drawGlyphFromPool();
    const readingId = crypto.randomUUID();

    return NextResponse.json({
      reading_id: readingId,
      glyph: {
        sign_number: sign.sign_number,
        level: sign.level,
        verse_lines_en: sign.verse_lines_en,
        summary_line_en: sign.summary_line_en,
        story_figure: sign.story_figure,
        level_zh: sign.level_zh,
      },
      sign,
      profile_id: body.profile_id,
      question,
      session_type: body.session_type === "paid" ? "paid" : "free",
      locale: typeof body.locale === "string" ? body.locale : "en",
    });
  } catch (e) {
    console.error("[oracle/draw]", e);
    return NextResponse.json(
      { error: "draw_failed", message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
