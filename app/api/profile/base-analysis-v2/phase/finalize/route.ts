import { NextResponse } from "next/server";

import { releaseLock } from "@/lib/base-analysis/job-store";
import {
  applyTranslatedSummary,
  runTranslate,
} from "@/lib/base-analysis-v2/translate/translate-call";
import {
  ensurePhasedLock,
  finalizeReportMarkdown,
  requireReportComputed,
  requireSegmentTree,
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
  report_computed: unknown;
  narrative: unknown;
  evidence: unknown;
};

/**
 * Phase 3 · 可选翻译 + merge + 清洗。完成后释放锁。
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
  const locale = String(body.locale ?? "").trim() || "en";
  if (!profileId) {
    return NextResponse.json({ ok: false, error: "Missing profile_id" }, { status: 400 });
  }

  const structured = requireStructured(body.local_data?.structured);
  if ("error" in structured) {
    return NextResponse.json({ ok: false, error: structured.error }, { status: 400 });
  }

  let rc = requireReportComputed(body.report_computed);
  if ("error" in rc) {
    return NextResponse.json({ ok: false, error: rc.error }, { status: 400 });
  }

  const narrativeIn = requireSegmentTree(body.narrative, "narrative");
  if ("error" in narrativeIn) {
    return NextResponse.json({ ok: false, error: narrativeIn.error }, { status: 400 });
  }

  const evidenceIn = requireSegmentTree(body.evidence, "evidence");
  if ("error" in evidenceIn) {
    return NextResponse.json({ ok: false, error: evidenceIn.error }, { status: 400 });
  }

  const held = await ensurePhasedLock(profileId);
  if (!held) {
    return NextResponse.json(
      { ok: false, error: "Another analysis is in progress" },
      { status: 409 },
    );
  }

  const t0 = Date.now();
  const timings: { translate?: number; total?: number } = {};
  let translated = false;

  try {
    let finalNarrative = narrativeIn;
    let finalEvidence = evidenceIn;
    let reportComputed = rc;

    if (!locale.startsWith("zh")) {
      const sessionId = baseAnalysisCacheSessionId(profileId);
      const tTr = Date.now();
      const tr = await runTranslate(
        {
          narrative: narrativeIn,
          evidence: evidenceIn,
          summary: {
            keywords: reportComputed.summary.keywords,
            current_theme: reportComputed.summary.current_theme,
            dos: reportComputed.summary.dos,
            donts: reportComputed.summary.donts,
          },
        },
        locale,
        { session_id: sessionId, signal: req.signal },
      );
      timings.translate = Date.now() - tTr;
      if (!tr.ok) {
        return NextResponse.json(
          { ok: false, error: "translate_failed", detail: tr.reason },
          { status: 502 },
        );
      }
      finalNarrative = tr.narrative;
      finalEvidence = tr.evidence;
      reportComputed = applyTranslatedSummary(reportComputed, tr.summary);
      translated = true;
    }

    const markdown = finalizeReportMarkdown(
      reportComputed,
      finalNarrative,
      finalEvidence,
      locale,
      structured,
    );
    timings.total = Date.now() - t0;

    await releaseLock(profileId);

    return NextResponse.json({
      ok: true,
      phase: "finalize",
      markdown,
      translated,
      timings,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: "finalize_error", detail: message },
      { status: 500 },
    );
  }
}
