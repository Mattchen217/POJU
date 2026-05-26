import { NextResponse } from "next/server";
import { calculateProfile } from "@/lib/calculations";
import { parseRegenerateChartBody } from "@/lib/profile/stored-birth-info";

export const runtime = "nodejs";

/**
 * Recalculate BaZi chart with birth location (Step 4).
 * Client loads profile from IndexedDB, sends birth + location, receives updated chart + tst_meta.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = parseRegenerateChartBody(body);

    if ("error" in parsed) {
      const status = parsed.error === "invalid_location" ? 400 : 400;
      return NextResponse.json({ success: false, error: parsed.error }, { status });
    }

    const profile = await calculateProfile(parsed.birth);

    return NextResponse.json({
      success: true,
      profile,
      base_analysis: null,
      tst_meta: profile.tst_meta,
      used_true_solar_time: profile.used_true_solar_time ?? false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "regenerate_failed",
      },
      { status: 500 },
    );
  }
}
