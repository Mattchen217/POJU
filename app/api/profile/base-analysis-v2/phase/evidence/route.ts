import { NextResponse } from "next/server";

import { runEvidence } from "@/lib/base-analysis-v2/evidence/evidence-call";
import {
  ensurePhasedLock,
  PIPELINE_LOCALE,
  requireReportComputed,
} from "@/lib/base-analysis-v2/phased/phase-shared";
import { baseAnalysisCacheSessionId } from "@/lib/llm/cache-session-id";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Body = {
  profile_id: string;
  report_computed: unknown;
};

/**
 * Phase 2b · 依据（中文）。可与 narrative 并行由客户端发起。
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

  const rc = requireReportComputed(body.report_computed);
  if ("error" in rc) {
    return NextResponse.json({ ok: false, error: rc.error }, { status: 400 });
  }

  const held = await ensurePhasedLock(profileId);
  if (!held) {
    return NextResponse.json(
      { ok: false, error: "Another analysis is in progress" },
      { status: 409 },
    );
  }

  const t0 = Date.now();
  try {
    const sessionId = baseAnalysisCacheSessionId(profileId);
    const result = await runEvidence(rc, PIPELINE_LOCALE, {
      session_id: sessionId,
      signal: req.signal,
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: "evidence_failed", detail: result.reason },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ok: true,
      phase: "evidence",
      evidence: result.value,
      timing_ms: Date.now() - t0,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: "evidence_error", detail: message },
      { status: 500 },
    );
  }
}
