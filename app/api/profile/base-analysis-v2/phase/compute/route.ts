import { NextResponse } from "next/server";

import { acquireLock, releaseLock } from "@/lib/base-analysis/job-store";
import { runCompute } from "@/lib/base-analysis-v2/compute/compute-call";
import {
  PIPELINE_LOCALE,
  requireStructured,
} from "@/lib/base-analysis-v2/phased/phase-shared";
import { baseAnalysisCacheSessionId } from "@/lib/llm/cache-session-id";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Body = {
  profile_id: string;
  locale: string;
  local_data: { structured: unknown };
};

/**
 * Phase 1 · 真算（中文）。成功后客户端把 ReportComputed 存 IndexedDB。
 */
export async function POST(req: Request) {
  if (!isOpenRouterConfigured()) {
    return NextResponse.json(
      { ok: false, error: "OpenRouter is not configured" },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const profileId = String(body.profile_id ?? "").trim();
  if (!profileId) {
    return NextResponse.json({ ok: false, error: "Missing profile_id" }, { status: 400 });
  }

  const structured = requireStructured(body.local_data?.structured);
  if ("error" in structured) {
    return NextResponse.json({ ok: false, error: structured.error }, { status: 400 });
  }

  const locked = await acquireLock(profileId);
  if (!locked) {
    return NextResponse.json(
      { ok: false, error: "Another analysis is in progress" },
      { status: 409 },
    );
  }

  const t0 = Date.now();
  try {
    const sessionId = baseAnalysisCacheSessionId(profileId);
    const result = await runCompute(structured, PIPELINE_LOCALE, {
      session_id: sessionId,
      signal: req.signal,
    });
    if (!result.ok) {
      await releaseLock(profileId);
      return NextResponse.json(
        { ok: false, error: "compute_failed", detail: result.reason },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ok: true,
      phase: "compute",
      report_computed: result.value,
      timing_ms: Date.now() - t0,
    });
  } catch (e) {
    await releaseLock(profileId);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: "compute_error", detail: message },
      { status: 500 },
    );
  }
}
