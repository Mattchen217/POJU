import { NextResponse } from "next/server";
import { z } from "zod";

import { AtmosEngineSnapshotSchema } from "@/lib/atmos/build-atmos-engine-snapshot";
import { generateAtmosDailyReading } from "@/lib/llm/services/atmos-daily-service";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  snapshot: AtmosEngineSnapshotSchema,
  locale: z.string().min(2).max(16).default("en"),
  profile_id: z.string().optional(),
  user_question: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  try {
    if (!isOpenRouterConfigured()) {
      return NextResponse.json({ error: "llm_not_configured" }, { status: 503 });
    }

    const json: unknown = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { snapshot, locale, profile_id, user_question } = parsed.data;
    const result = await generateAtmosDailyReading({
      snapshot,
      locale,
      profileId: profile_id,
      userQuestion: user_question,
    });

    return NextResponse.json({
      date_key: snapshot.asOf.baziDayDate,
      field_tone: result.reading.field_tone,
      what_to_watch: result.reading.what_to_watch,
      one_move: result.reading.one_move,
      full_text: result.fullText,
      meta: result.meta,
    });
  } catch (e) {
    console.error("[api/atmos/daily]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "atmos_daily_failed" },
      { status: 500 },
    );
  }
}
