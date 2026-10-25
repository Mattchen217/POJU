import { NextResponse } from "next/server";

import { generateSyncroMatrixLocal } from "@/lib/llm/services/syncro-reading-service";
import { parseSyncroComputeRequest } from "@/lib/syncro/syncro-compute-request";

/** @deprecated Prefer `/api/syncro/compute_local` + `/api/syncro/llm_batch`. Kept for compatibility: local matrix only. */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Parameters<typeof parseSyncroComputeRequest>[0];
    const parsed = parseSyncroComputeRequest(body);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.error, message: parsed.message },
        { status: parsed.status },
      );
    }

    const result = await generateSyncroMatrixLocal({
      profile_id: parsed.data.profile_id,
      task_description: parsed.data.task_description,
      user_location: parsed.data.user_location,
      locale: parsed.data.locale,
      user_profile: parsed.data.user_profile,
      base_analysis: parsed.data.base_analysis,
    });

    return NextResponse.json({
      success: true,
      matrix: result.matrix,
      local_matrix: result.local_matrix,
      compute_started_at: result.compute_started_at,
      true_solar_meta: result.true_solar_meta,
      meta: result.meta,
      deprecated: true,
      message: "Use /api/syncro/compute_local and /api/syncro/llm_batch for split pipeline.",
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[api/syncro/compute] error:", e);

    if (message.includes("base_analysis") || message.includes("Profile has no")) {
      return NextResponse.json({ error: "profile_not_ready", message }, { status: 400 });
    }

    if (message.includes("Matrix incomplete")) {
      return NextResponse.json({ error: "compute_failed", message }, { status: 502 });
    }

    return NextResponse.json({ error: "compute_failed", message }, { status: 500 });
  }
}
