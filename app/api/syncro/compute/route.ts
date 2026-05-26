import { NextResponse } from "next/server";

import { generateSyncroMatrix } from "@/lib/llm/services/syncro-reading-service";
import { parseAppLocale } from "@/lib/prompts/language-directive";
import type { UserProfile } from "@/lib/profile/types";

export const runtime = "nodejs";
export const maxDuration = 180;

type RequestBody = {
  profile_id?: string;
  task_description?: string;
  user_location?: {
    latitude: number;
    longitude: number;
    timezone: string;
  };
  locale?: unknown;
  user_profile?: UserProfile | null;
  base_analysis?: unknown | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const locale = parseAppLocale(body.locale);

    if (!body.profile_id?.trim() || !body.task_description?.trim() || !body.user_location) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const { latitude, longitude, timezone } = body.user_location;
    if (
      latitude == null ||
      longitude == null ||
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      !timezone?.trim()
    ) {
      return NextResponse.json(
        {
          error: "invalid_location",
          message: "Latitude, longitude, and timezone are required.",
        },
        { status: 400 },
      );
    }

    const result = await generateSyncroMatrix({
      profile_id: body.profile_id.trim(),
      task_description: body.task_description.trim(),
      user_location: { latitude, longitude, timezone: timezone.trim() },
      locale,
      user_profile: body.user_profile ?? null,
      base_analysis: body.base_analysis ?? null,
    });

    return NextResponse.json({
      success: true,
      matrix: result.matrix,
      meta: {
        ...result.meta,
        true_solar_time_diff_minutes: result.meta.true_solar_time_diff_minutes,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[api/syncro/compute] error:", e);

    if (message.includes("missing_openrouter_api_key")) {
      return NextResponse.json(
        { error: "compute_failed", message: "Server missing OPENROUTER_API_KEY." },
        { status: 500 },
      );
    }

    if (message.includes("base_analysis") || message.includes("Profile has no")) {
      return NextResponse.json({ error: "profile_not_ready", message }, { status: 400 });
    }

    if (message.includes("not valid JSON") || message.includes("Matrix incomplete")) {
      return NextResponse.json({ error: "compute_failed", message }, { status: 502 });
    }

    return NextResponse.json({ error: "compute_failed", message }, { status: 500 });
  }
}
