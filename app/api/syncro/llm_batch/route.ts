import { NextResponse } from "next/server";

import { runSyncroLlmBatch, getSyncroBatchKeyLists } from "@/lib/llm/services/syncro-reading-service";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
import { parseAppLocale } from "@/lib/prompts/language-directive";
import type { MatrixCell } from "@/lib/syncro/calculate-matrix";
import type { UserProfile } from "@/lib/profile/types";

export const runtime = "nodejs";
export const maxDuration = 120;

type LlmBatchBody = {
  session_id?: string;
  batch_index?: number;
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
  local_matrix?: Record<string, MatrixCell>;
  compute_started_at?: string;
  true_solar_meta?: import("@/lib/syncro/calculate-matrix").SyncroMatrixMetadata;
};

export async function POST(req: Request) {
  const started = Date.now();
  try {
    if (!isOpenRouterConfigured()) {
      return NextResponse.json(
        { error: "missing_openrouter", message: "OPENROUTER_API_KEY not configured." },
        { status: 503 },
      );
    }

    const body = (await req.json()) as LlmBatchBody;

    if (body.batch_index == null || !Number.isInteger(body.batch_index) || body.batch_index < 0) {
      return NextResponse.json({ error: "invalid_batch_index" }, { status: 400 });
    }

    if (
      !body.user_profile ||
      body.base_analysis == null ||
      !body.task_description?.trim() ||
      !body.user_location ||
      !body.local_matrix ||
      typeof body.local_matrix !== "object" ||
      Object.keys(body.local_matrix).length === 0
    ) {
      return NextResponse.json(
        {
          error: "invalid_request",
          message:
            "Requires user_profile, base_analysis, task_description, user_location, local_matrix, compute_started_at.",
        },
        { status: 400 },
      );
    }

    const { latitude, longitude, timezone } = body.user_location;
    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      !timezone?.trim()
    ) {
      return NextResponse.json({ error: "invalid_location" }, { status: 400 });
    }

    const locale = parseAppLocale(body.locale ?? "en");

    const batchKeyLists = getSyncroBatchKeyLists(body.local_matrix);
    const sliceKeys = batchKeyLists[body.batch_index] ?? [];
    const matrixSlice: Record<string, MatrixCell> = {};
    for (const key of sliceKeys) {
      matrixSlice[key] = body.local_matrix[key];
    }

    console.log("[llm_batch] received:", {
      batch_index: body.batch_index,
      slice_size: Object.keys(matrixSlice).length,
      slice_hour_periods: [
        ...new Set(Object.keys(matrixSlice).map((k) => k.split("__")[0]).filter(Boolean)),
      ],
    });

    const result = await runSyncroLlmBatch({
      batch_index: body.batch_index,
      profile: body.user_profile,
      base_analysis: body.base_analysis,
      task_description: body.task_description.trim(),
      user_location: { latitude, longitude, timezone: timezone.trim() },
      locale,
      local_matrix: body.local_matrix,
      compute_started_at: body.compute_started_at ?? new Date().toISOString(),
      true_solar: body.true_solar_meta,
    });

    const sampleAdvice = Object.values(result.advice)[0];
    console.log("[llm_batch] LLM returned:", {
      batch_index: body.batch_index,
      cells_with_advice: Object.keys(result.advice).length,
      sample_advice: sampleAdvice,
    });

    console.log(
      `[api/syncro/llm_batch] session=${body.session_id ?? "?"} batch=${body.batch_index} ok in ${Date.now() - started}ms keys=${Object.keys(result.advice).length}`,
    );

    return NextResponse.json({
      success: true,
      session_id: body.session_id ?? null,
      ...result,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[api/syncro/llm_batch] error:", e);

    if (
      message.includes("llm_timeout") ||
      message.includes("llm_batch_timeout") ||
      message.includes("AbortError")
    ) {
      return NextResponse.json({ error: "llm_timeout", message }, { status: 504 });
    }

    if (message.includes("missing_openrouter")) {
      return NextResponse.json({ error: "missing_openrouter", message }, { status: 503 });
    }

    if (message.includes("not valid JSON")) {
      return NextResponse.json({ error: "invalid_llm_json", message }, { status: 502 });
    }

    return NextResponse.json({ error: "llm_batch_failed", message }, { status: 500 });
  }
}
